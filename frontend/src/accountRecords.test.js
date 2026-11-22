import test from 'node:test';
import assert from 'node:assert/strict';
import { accountView, hasGuestRecords, persistAccount, readAccount } from './accountRecords.js';
import { initialState } from './model.js';

test('server balance replaces guest balance and guest data is not an account cache', () => {
  const view=accountView({...initialState,credits:999}, {state:{credits:5,nickname:'계정 학생'}});
  assert.equal(view.credits,5); assert.equal(view.nickname,'계정 학생');
  assert.equal(hasGuestRecords(initialState),false); assert.equal(hasGuestRecords({...initialState,nickname:'학생'}),true);
});
test('cached queue is isolated by account scope and storage failure is explicit',()=>{
  const map=new Map(); const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  assert.equal(persistAccount(storage,{scope:'A',queue:[{id:'one'}]}),true);
  assert.deepEqual(readAccount(storage,'B').queue,[]); assert.equal(readAccount(storage,'A').queue.length,1);
  assert.equal(persistAccount({setItem(){throw Error('quota')}},{scope:'A',queue:[]}),false);
});

import { RecordSync, captureChanges, pendingView } from './accountRecords.js';
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const doc=()=>({scope:'account-A',revision:0,state:{...structuredClone(initialState),catalog:undefined}});
test('offline queue survives reload and retries the same operation UUID',async()=>{
  const storage=memory();let online=false,ids=[];
  const request=async(path,method,item)=>{ids.push(item.operation_id);if(!online)throw Error('offline');return {...doc(),revision:1}};
  const first=new RecordSync({storage,request,change(){}});await first.open(doc());first.enqueue([{kind:'enroll',department:'khu-cse'}]);
  await assert.rejects(first.flush());assert.equal(first.queue.length,1);const id=first.queue[0].operation_id;first.close();
  online=true;const second=new RecordSync({storage,request,change(){}});await second.open(doc());
  assert.deepEqual(ids,[id,id]);assert.equal(second.queue.length,0);
});
test('an edit queued during an in-flight save is sent in order',async()=>{
  let release,seen=[];const gate=new Promise(r=>{release=r});
  const sync=new RecordSync({storage:memory(),change(){},request:async(path,method,item)=>{seen.push(item.changes[0].kind);if(seen.length===1)await gate;return {...doc(),revision:seen.length}}});
  await sync.open(doc());sync.enqueue([{kind:'enroll',department:'khu-cse'}]);const saving=sync.flush();
  sync.enqueue([{kind:'draft',department:'khu-cse',subject:'이산구조',text:'메모'}]);release();await saving;
  assert.deepEqual(seen,['enroll','draft']);assert.equal(sync.queue.length,0);
});
test('closing account A prevents its late response applying to account B',async()=>{
  let release;const gate=new Promise(r=>{release=r});let notifications=0;
  const sync=new RecordSync({storage:memory(),change(){notifications++},request:async()=>{await gate;return doc()}});
  await sync.open(doc());sync.enqueue([{kind:'reset'}]);const saving=sync.flush();sync.close();const before=notifications;release();await saving;
  assert.equal(notifications,before);assert.equal(sync.queue.length,1);
});
test('balance edits are never captured as commands and navigation stays local',()=>{
  const before=structuredClone(initialState);assert.deepEqual(captureChanges(before,{...before,credits:100000,current:'khu-cse'}),[]);
  assert.deepEqual(captureChanges(before,{...before,studying:'khu-cse'}),[]);
});
test('ambiguous profile response retries its original delivery UUID',async()=>{
  let fail=true,ids=[];const sync=new RecordSync({storage:memory(),change(){},request:async(path,method,item)=>{ids.push(item.operation_id);if(fail)throw Error('timeout');return {...doc(),state:{...doc().state,nickname:'학생',profileRevision:1}}}});
  await sync.open(doc());await assert.rejects(sync.saveProfile('학생',null));fail=false;await sync.saveProfile('학생',null);assert.equal(ids[0],ids[1]);
});
