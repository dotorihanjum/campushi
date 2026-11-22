import { useCallback, useEffect, useRef, useState } from 'react';
import { initialState, STORAGE_KEY } from './model.js';
import { accountView, hasGuestRecords, IMPORT_KEY, recordsRequest } from './accountRecords.js';

export function useAccountRecords(auth, state, setState, storage, catalogReady) {
  const context = useRef(null);
  const local = useRef(state); local.current = state;
  const guest = useRef(state);
  const generation = useRef(0);
  const [status, setStatus] = useState({ phase: 'checking', error: '', importAvailable: false });
  useEffect(() => {
    if (auth.loading || !catalogReady) return;
    const request = ++generation.current;
    if (!auth.user) {
      context.current = null;
      setStatus({ phase: 'guest', error: '', importAvailable: false });
      return;
    }
    setStatus(s => ({ ...s, phase: 'loading', error: '' }));
    recordsRequest().then(doc => {
      if (request !== generation.current) return;
      context.current = doc;
      setState(s => accountView(s, doc));
      setStatus({ phase: 'saved', error: '', importAvailable: hasGuestRecords(guest.current) });
    }).catch(error => { if (request === generation.current) setStatus(s => ({ ...s, phase: 'error', error: error.message })); });
    return () => { generation.current++; };
  }, [auth.loading, auth.user, catalogReady, setState]);
  const importGuest = useCallback(async () => {
    const doc = context.current;
    if (!doc) throw new Error('계정 기록을 먼저 불러와 주세요.');
    let operation_id;
    try { operation_id = storage?.getItem(IMPORT_KEY); } catch { /* memory-only visit */ }
    operation_id ||= crypto.randomUUID();
    try { storage?.setItem(IMPORT_KEY, operation_id); } catch { /* retry remains safe in this visit */ }
    const saved = await recordsRequest('/import', 'POST', { scope: doc.scope, operation_id, state: guest.current });
    if (context.current?.scope !== doc.scope) return;
    context.current = saved;
    setState(s => accountView(s, saved));
    guest.current = structuredClone(initialState);
    storage?.removeItem(STORAGE_KEY); storage?.removeItem(IMPORT_KEY);
    setStatus({ phase: 'saved', error: '', importAvailable: false, imported: true });
  }, [setState, storage]);
  return { ...status, context, importGuest, update: setState };
}
