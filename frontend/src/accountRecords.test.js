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
