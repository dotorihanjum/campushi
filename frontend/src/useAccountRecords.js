import { useCallback, useEffect, useRef, useState } from 'react';
import { initialState, STORAGE_KEY } from './model.js';
import { captureChanges, hasGuestRecords, IMPORT_KEY, pendingView, RecordSync, recordsRequest } from './accountRecords.js';

export function useAccountRecords(auth,state,setState,storage,catalogReady) {
  const context=useRef(null), engine=useRef(null), local=useRef(state), guest=useRef(state), generation=useRef(0);
  local.current=state;
  const [status,setStatus]=useState({phase:'checking',error:'',pending:0,importAvailable:false});
  const display=useCallback(s=>{local.current=s;setState(s);},[setState]);
  useEffect(()=>{
    if(auth.loading || !catalogReady)return;
    const request=++generation.current;
    if(!auth.user){setStatus(s=>({...s,phase:'guest'}));return;}
    setStatus(s=>({...s,phase:'loading',error:''}));
    let sync;
    const change=({doc,queue,...next})=>{
      if(request!==generation.current)return;
      context.current=doc; display(pendingView(local.current,doc,queue));
      setStatus(s=>({...s,...next,importAvailable:hasGuestRecords(guest.current)}));
    };
    recordsRequest().then(async doc=>{
      if(request!==generation.current)return;
      sync=new RecordSync({storage,change});engine.current=sync;await sync.open(doc);
    }).catch(error=>{if(request===generation.current)setStatus(s=>({...s,phase:'error',error:error.message}));});
    return ()=>{generation.current++;sync?.close();};
  },[auth.loading,auth.user,catalogReady,display,storage]);
  useEffect(()=>{
    const retry=()=>engine.current?.active && engine.current.refresh().catch(()=>{});
    window.addEventListener('online',retry);window.addEventListener('focus',retry);
    const timer=window.setInterval(retry,30000);
    return ()=>{window.removeEventListener('online',retry);window.removeEventListener('focus',retry);window.clearInterval(timer);};
  },[]);
  const update=useCallback((value,meta)=>{
    const before=local.current,after=typeof value==='function'?value(before):value;
    if(auth.user){
      const sync=engine.current;if(!sync?.active)return;
      const changes=captureChanges(before,after,meta);sync.enqueue(changes);
      display({...after,credits:sync.doc.state.credits || 0,creditedAt:sync.doc.state.creditedAt || {}});
      if(changes.length)sync.flush().catch(()=>{});
    }else{guest.current=after;display(after);}
  },[auth.user,display]);
  const importGuest=useCallback(async()=>{
    const sync=engine.current;if(!sync?.active)throw new Error('계정 기록을 먼저 불러와 주세요.');
    await sync.flush();let operation_id;
    try{operation_id=storage?.getItem(IMPORT_KEY);}catch{/* memory-only visit */}
    operation_id ||= crypto.randomUUID();
    try{storage?.setItem(IMPORT_KEY,operation_id);}catch{/* no durable guest storage */}
    const saved=await recordsRequest('/import','POST',{scope:sync.doc.scope,operation_id,state:guest.current});
    if(!sync.active)return;
    sync.doc=saved;guest.current=structuredClone(initialState);
    try{storage?.removeItem(STORAGE_KEY);storage?.removeItem(IMPORT_KEY);}catch{/* local storage is blocked */}
    display(pendingView(local.current,saved,sync.queue));context.current=saved;
    setStatus(s=>({...s,phase:'saved',error:'',importAvailable:false,imported:true}));
  },[display,storage]);
  return {...status,context,engine,importGuest,update,retry:()=>engine.current?.refresh(),saveProfile:(name,photo)=>engine.current.saveProfile(name,photo)};
}
