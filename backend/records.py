"""Session-scoped account storage. Writes are validated then atomically compared and committed."""
import hmac
import time
from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from backend import accounts
from backend.login import signing_key, same_origin
from backend.record_rules import empty_state, imported

router=APIRouter(prefix='/api/me/records')

class ImportRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    operation_id: UUID
    scope: str=Field(min_length=64,max_length=64)
    state: dict

def owner(store,request):
    user=accounts.current_user(store,request,internal=True)
    return user['id'],hmac.digest(signing_key(),('account-records:'+user['id']).encode(),'sha256').hex()

def document(store,user_id):
    rows=store.call('GET','account_records',params={'user_id':'eq.'+user_id,'select':'revision,state','limit':'1'}).json()
    return rows[0] if rows else {'revision':0,'state':empty_state()}

def public_document(doc,scope):
    return {'scope':scope,'revision':doc['revision'],'state':{**empty_state(),**doc['state']}}

def commit(store,user_id,operation_id,change):
    doc=document(store,user_id)
    for _ in range(5):
        state=change({**empty_state(),**doc['state']})
        saved=store.call('POST','rpc/commit_account_records',body={'p_user_id':user_id,'p_revision':doc['revision'],'p_operation_id':str(operation_id),'p_state':state}).json()
        if saved['status']!='conflict': return saved
        doc=saved
    raise HTTPException(409,'다른 기기에서 기록을 저장 중이에요. 잠시 후 다시 시도해 주세요.')

@router.get('')
def get_records(request:Request,store=Depends(accounts.account_store)):
    user_id,scope=owner(store,request)
    return public_document(document(store,user_id),scope)

@router.post('/import')
def import_records(body:ImportRequest,request:Request,store=Depends(accounts.account_store)):
    same_origin(request)
    user_id,scope=owner(store,request)
    if not hmac.compare_digest(scope,body.scope): raise HTTPException(409,'로그인한 계정이 바뀌었어요. 다시 확인해 주세요.')
    from backend.main import department_list
    raw=body.state
    if any(not isinstance(raw.get(key,{}),dict) for key in ('journeys','records','notes')): raise HTTPException(400,'가져올 기록을 확인해 주세요.')
    saved=commit(store,user_id,body.operation_id,lambda state: imported(state,raw,department_list()['departments'],int(time.time()*1000)))
    return public_document(saved,scope)
