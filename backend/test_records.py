import copy
import io
import base64
import unittest
from unittest.mock import patch
from uuid import uuid4
import httpx
from PIL import Image
from fastapi.testclient import TestClient
from backend import accounts, main, records
from backend.record_rules import empty_state, imported, photo
from backend.test_login import ENV, HEADERS, USER

class RecordStore:
    def __init__(self):
        self.docs={}; self.operations=set(); self.conflicts=0
    def call(self,method,table,params=None,body=None,prefer=None):
        if table=='record_operations':
            return httpx.Response(200,json=[{'operation_id':params['operation_id'][3:]}] if (params['user_id'][3:],params['operation_id'][3:]) in self.operations else [])
        if table=='account_records':
            value=self.docs.get(params['user_id'][3:]); return httpx.Response(200,json=[value] if value else [])
        if table=='rpc/commit_account_records':
            owner=body['p_user_id']; doc=self.docs.get(owner,{'revision':0,'state':empty_state()}); key=(owner,body['p_operation_id'])
            if key in self.operations: return httpx.Response(200,json={**doc,'status':'duplicate'})
            if self.conflicts:
                self.conflicts-=1; doc={**doc,'revision':doc['revision']+1}; self.docs[owner]=doc
            if body['p_revision']!=doc['revision']: return httpx.Response(200,json={**doc,'status':'conflict'})
            self.operations.add(key); doc={'revision':doc['revision']+1,'state':copy.deepcopy(body['p_state'])}; self.docs[owner]=doc
            return httpx.Response(200,json={**doc,'status':'saved'})
        raise AssertionError(table)

class RecordTest(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict('os.environ',ENV,clear=True); self.env.start(); self.addCleanup(self.env.stop)
        self.store=RecordStore(); main.app.dependency_overrides[accounts.account_store]=lambda:self.store
        self.addCleanup(main.app.dependency_overrides.clear)
        self.identity=patch.object(accounts,'current_user',return_value=USER); self.identity.start(); self.addCleanup(self.identity.stop)
        self.client=TestClient(main.app,base_url='https://testserver')
        self.scope=self.client.get('/api/me/records').json()['scope']
        self.catalog=main.department_list()['departments']; self.id='khu-cse'
        self.subject=next(s for s in self.catalog[0]['years']['1'] if s in self.catalog[0]['games'])
    def guest(self):
        return {'nickname':'로컬 학생','journeys':{self.id:{}},'records':{self.id+'|'+self.subject:{'grade':'A+','percent':100,'attempts':2}},'credits':999999,'creditedAt':{self.id+'|'+self.subject:1}}
    def import_request(self,body=None,operation_id=None):
        return self.client.post('/api/me/records/import',json={'scope':self.scope,'operation_id':operation_id or str(uuid4()),'state':body or self.guest()},headers=HEADERS)
    def test_import_is_persisted_without_browser_credits_and_retry_is_idempotent(self):
        op=str(uuid4()); r=self.import_request(operation_id=op); self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['state']['credits'],0); self.assertEqual(r.json()['state']['creditedAt'],{})
        self.assertEqual(r.json()['state']['records'][self.id+'|'+self.subject]['source'],'imported')
        self.assertEqual(self.import_request(operation_id=op).json()['revision'],1)
        self.assertEqual(self.client.get('/api/me/records').json()['state']['nickname'],'로컬 학생')
    def test_unknown_locked_or_malformed_import_rows_are_dropped(self):
        raw=self.guest(); d=self.catalog[0]
        locked=d['years']['4'][0]
        raw['journeys']['forged']={}; raw['records'][self.id+'|'+locked]={'grade':'A+','percent':100,'attempts':1}
        raw['records']['forged|bad']={'grade':'P'}; raw['records'][self.id+'|'+self.subject]['percent']=20
        saved=self.import_request(raw).json()['state']; self.assertNotIn('forged',saved['journeys']); self.assertEqual(saved['records'],{})
    def test_wrong_scope_and_origin_denied(self):
        self.scope='0'*64; self.assertEqual(self.import_request().status_code,409)
        self.assertEqual(self.client.post('/api/me/records/import',json={'scope':self.scope,'operation_id':str(uuid4()),'state':{}}).status_code,403)
    def test_compare_and_swap_retries_without_losing_server_revision(self):
        self.store.conflicts=1; self.assertEqual(self.import_request().json()['revision'],2)
    def test_photo_decoder_rejects_html_svg_and_oversized_dimensions(self):
        for value in ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,PHNjcmlwdD4=']:
            with self.assertRaises(Exception): photo(value)
        img=Image.new('RGB',(256,256),'teal'); out=io.BytesIO(); img.save(out,format='JPEG')
        value='data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
        self.assertTrue(photo(value).startswith('data:image/jpeg;base64,'))
        raw=self.guest(); raw['profilePhoto']=value
        self.assertEqual(self.import_request(raw).status_code,200)

    def operation(self,changes,operation_id=None):
        return self.client.post('/api/me/records/operations',json={'scope':self.scope,'operation_id':operation_id or str(uuid4()),'changes':changes},headers=HEADERS)
    def test_live_pass_after_import_grants_once_and_retries_do_not_increase_attempts(self):
        self.import_request(); op=str(uuid4())
        changes=[{'kind':'complete','department':self.id,'subject':self.subject,'score':{'correct':10,'total':10},'note':'내 기록'}]
        first=self.operation(changes,op); self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(first.json()['state']['credits'],5)
        again=self.operation(changes,op).json()['state']; self.assertEqual(again['credits'],5)
        self.assertEqual(again['records'][self.id+'|'+self.subject]['attempts'],3)
        next_attempt=self.operation(changes).json()['state']; self.assertEqual(next_attempt['credits'],5)
        self.assertEqual(next_attempt['records'][self.id+'|'+self.subject]['attempts'],4)
    def test_two_devices_merge_attempts_and_keep_the_better_grade(self):
        self.import_request()
        for correct in (7,9):
            result=self.operation([{'kind':'complete','department':self.id,'subject':self.subject,'score':{'correct':correct,'total':10}}])
            self.assertEqual(result.status_code,200,result.text)
        row=result.json()['state']['records'][self.id+'|'+self.subject]
        self.assertEqual(row['attempts'],4); self.assertEqual(row['grade'],'A+')
    def test_clients_cannot_assign_balance_or_arbitrary_unlocks(self):
        r=self.operation([{'kind':'preferences','campus':'khu-global','studying':None,'credits':1000}]); self.assertEqual(r.status_code,400)
        r=self.operation([{'kind':'complete','department':self.id,'subject':self.catalog[0]['final'],'score':'P'}]); self.assertEqual(r.status_code,400)
        r=self.operation([{'kind':'enroll','department':self.id},{'kind':'complete','department':self.id,'subject':self.subject,'score':'P'}]); self.assertEqual(r.status_code,400)
        self.assertEqual(self.client.get('/api/me/records').json()['state']['journeys'],{})
    def test_profile_conflict_keeps_existing_server_profile(self):
        first=self.operation([{'kind':'profile','nickname':'학생 A','photo':None,'expected':0}]); self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(self.operation([{'kind':'profile','nickname':'학생 B','photo':None,'expected':0}]).status_code,409)
        self.assertEqual(self.client.get('/api/me/records').json()['state']['nickname'],'학생 A')
    def test_leave_and_reset_keep_server_credit_history(self):
        self.import_request(); self.operation([{'kind':'complete','department':self.id,'subject':self.subject,'score':{'correct':10,'total':10}}])
        saved=self.operation([{'kind':'leave','department':self.id}]).json()['state']
        self.assertEqual(saved['records'],{}); self.assertEqual(saved['credits'],5); self.assertTrue(saved['creditedAt'])
        saved=self.operation([{'kind':'reset'}]).json()['state']; self.assertEqual(saved['credits'],5); self.assertEqual(saved['nickname'],'')
