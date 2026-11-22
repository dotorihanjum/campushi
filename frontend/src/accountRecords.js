import { initialState, normalize, enroll, leaveDepartment, completeCourse, savePlay, gameOf, departmentsOf } from './model.js';
import { loginRequest } from './login.js';

export const ACCOUNT_PREFIX = 'campushi-account-v1:';
export const IMPORT_KEY = 'campushi-import-v1';
export const hasGuestRecords = (s) => !!(s.nickname || s.profilePhoto || Object.keys(s.journeys || {}).length);
export function accountView(local, document) {
  const saved = document.state;
  const current = saved.journeys?.[local.current] ? local.current : Object.keys(saved.journeys || {})[0] || null;
  return normalize({ ...initialState, ...saved, catalog: local.catalog, current, onboarded: true, introSeen: true });
}
export function readAccount(storage, scope) {
  try { const value = JSON.parse(storage?.getItem(ACCOUNT_PREFIX + scope)); return value?.scope === scope && Array.isArray(value.queue) ? value : { scope, queue: [] }; }
  catch { return { scope, queue: [] }; }
}
export function persistAccount(storage, data) {
  // An unsaved queue must stay visible in memory if browser storage is blocked/full.
  if (!storage) return false;
  try { storage.setItem(ACCOUNT_PREFIX + data.scope, JSON.stringify(data)); return true; } catch { return false; }
}
export const recordsRequest = (path = '', method = 'GET', body) => loginRequest('/me/records' + path, method, body);

export function captureChanges(before, after, meta = {}) {
  if (meta.reset) return [{kind:'reset'}];
  const changes=[];
  for (const department of Object.keys(after.journeys)) if (!before.journeys[department]) changes.push({kind:'enroll',department});
  for (const department of Object.keys(before.journeys)) if (!after.journeys[department]) changes.push({kind:'leave',department});
  if (meta.completion) changes.push({kind:'complete',...meta.completion});
  for (const [field,kind] of [['notes','note'],['drafts','draft']]) for (const [key,text] of Object.entries(after[field] || {})) {
    if (before[field]?.[key]===text || meta.completion && key===`${meta.completion.department}|${meta.completion.subject}`) continue;
    const [department,...subject]=key.split('|'); changes.push({kind,department,subject:subject.join('|'),text});
  }
  if ((before.campus!==after.campus || before.studying!==after.studying) && (!after.studying || after.journeys[after.studying])) changes.push({kind:'preferences',campus:after.campus || 'khu-global',studying:after.studying});
  return changes;
}

export function pendingView(local, doc, queue) {
  let view=accountView(local,doc); view.plays=local.plays || {};
  for (const item of queue) for (const op of item.changes) {
    if (op.kind==='enroll') view=enroll(view,op.department);
    else if (op.kind==='leave') view=leaveDepartment(view,op.department);
    else if (op.kind==='reset') view={...structuredClone(initialState),catalog:local.catalog,credits:doc.state.credits,creditedAt:doc.state.creditedAt,onboarded:true,campus:'khu-global'};
    else if (op.kind==='complete') {
      const d=departmentsOf(view).find(d=>d.id===op.department);
      if (d) view=completeCourse(savePlay(view,op.department,op.subject,gameOf(d,op.subject),'',op.score),op.department,op.subject,op.note);
    } else if (op.kind==='draft' || op.kind==='note') {
      const field=op.kind==='draft'?'drafts':'notes'; view={...view,[field]:{...view[field],[`${op.department}|${op.subject}`]:op.text}};
    } else if (op.kind==='preferences') view={...view,campus:op.campus,studying:op.studying};
  }
  return {...view,credits:doc.state.credits || 0,creditedAt:doc.state.creditedAt || {}};
}

export class RecordSync {
  constructor({storage,request=recordsRequest,change}) {
    this.storage=storage; this.request=request; this.change=change; this.doc=null; this.queue=[]; this.inflight=null; this.active=true; this.memoryOnly=false;
  }
  notify(phase,error='') { if(this.active)this.change({phase,error,pending:this.queue.length,memoryOnly:this.memoryOnly,doc:this.doc,queue:this.queue}); }
  persist() { this.memoryOnly=!persistAccount(this.storage,{scope:this.doc.scope,queue:this.queue}); }
  async open(doc) { this.doc=doc; this.queue=readAccount(this.storage,doc.scope).queue; this.notify(this.queue.length?'waiting':'saved'); if(this.queue.length)await this.flush(); }
  enqueue(changes) {
    if(!changes.length)return;
    if(!this.active || !this.doc)throw new Error('계정 기록을 먼저 불러와 주세요.');
    for(let at=0;at<changes.length;at+=20)this.queue.push({operation_id:crypto.randomUUID(),scope:this.doc.scope,changes:changes.slice(at,at+20)});
    this.persist(); this.notify('waiting');
  }
  flush() {
    if(this.inflight)return this.inflight;
    this.inflight=this.drain().finally(()=>{this.inflight=null;}); return this.inflight;
  }
  async drain() {
    if(!this.active)return;
    try {
      while(this.active && this.queue.length) {
        this.notify('saving'); const item=this.queue[0]; const saved=await this.request('/operations','POST',item);
        if(!this.active)return;
        if(saved.scope!==this.doc.scope)throw new Error('로그인한 계정이 바뀌었어요.');
        this.doc=saved; this.queue.shift(); this.persist(); this.notify(this.queue.length?'saving':'saved');
      }
    } catch(error) { this.notify(error.status===401?'expired':error.status===400 || error.status===409?'error':'waiting',error.message); throw error; }
  }
  async refresh() {
    await this.flush(); const saved=await this.request(); if(!this.active)return;
    if(saved.scope!==this.doc.scope){this.notify('expired','로그인한 계정이 바뀌었어요. 다시 로그인해 주세요.');return;}
    this.doc=saved; this.notify(this.queue.length?'waiting':'saved'); if(this.queue.length)await this.flush();
  }
  async saveProfile(nickname,photo) {
    await this.flush();
    const item={scope:this.doc.scope,operation_id:crypto.randomUUID(),changes:[{kind:'profile',nickname,photo,expected:this.doc.state.profileRevision || 0}]};
    this.profileDelivery ??= item;
    if(JSON.stringify(this.profileDelivery.changes[0])!==JSON.stringify(item.changes[0]))this.profileDelivery=item;
    try {
      const saved=await this.request('/operations','POST',this.profileDelivery);
      if(!this.active || saved.scope!==this.doc.scope)throw new Error('계정이 바뀌었어요.');
      this.doc=saved; this.profileDelivery=null; this.notify('saved');
    } catch(error) { if(error.status===409){this.profileDelivery=null;await this.refresh();} throw error; }
  }
  close() { this.active=false; }
}
