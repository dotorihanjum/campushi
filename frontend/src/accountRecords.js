import { initialState, normalize } from './model.js';
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
