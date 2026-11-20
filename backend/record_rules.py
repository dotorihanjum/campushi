"""Account record rules. Client catalogs, balances and unlock exceptions are never authority."""
import base64
import copy
import io
import math
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException

GRADES = [('A+',95),('A0',90),('A-',85),('B+',80),('B0',75),('B-',70),('C+',65),('C0',60),('C-',55),('D+',50),('D0',45),('D-',40),('F',0)]
NAMES = [g for g, _ in GRADES]

def empty_state():
    return {'journeys':{}, 'records':{}, 'notes':{}, 'drafts':{}, 'exempt':{}, 'nickname':'', 'profilePhoto':None, 'credits':0, 'creditedAt':{}, 'conditions':3, 'campus':'khu-global', 'studying':None}

def fail(message='저장할 기록의 형식이 올바르지 않아요.'):
    raise HTTPException(400, message)

def text(value, limit):
    if not isinstance(value,str) or len(value)>limit: fail()
    return value

def photo(value):
    if value is None: return None
    if not isinstance(value,str) or len(value)>200000 or not value.startswith('data:image/jpeg;base64,'): fail('사진을 다시 선택해 주세요.')
    try:
        raw=base64.b64decode(value.split(',',1)[1],validate=True)
        with Image.open(io.BytesIO(raw)) as image:
            if image.format!='JPEG' or not (1<=image.width<=512 and 1<=image.height<=512): raise ValueError()
            image.load()
            image=image.convert('RGB'); image.thumbnail((256,256))
            out=io.BytesIO(); image.save(out,format='JPEG',quality=85)
        return 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
    except (ValueError,OSError,UnidentifiedImageError): fail('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.')

def passes(grade):
    return grade=='P' or grade in NAMES[:6]

def grade(score):
    if score=='P': return {'grade':'P','percent':None}
    if not isinstance(score,dict) or set(score)!={'correct','total'}: fail()
    c,t=score['correct'],score['total']
    if type(c)!=int or type(t)!=int or not 0<=c<=t<=10000 or t==0: fail()
    percent=math.floor(c*100/t+0.5)
    return {'grade':next(g for g,minimum in GRADES if percent>=minimum),'percent':percent}

def better(a,b):
    if a['grade']=='P' or b['grade']=='P':
        other=b if a['grade']=='P' else a
        return other if passes(other['grade']) and other['grade']!='P' else (a if a['grade']=='P' else b)
    return min((a,b),key=lambda r:(NAMES.index(r['grade']),-(r.get('percent') or 0)))

def available(d,subject):
    return subject in d.get('games',{}) or subject in (d.get('practice'),d['final'])

def open_years(state,d):
    opened=[]
    for year in range(1,5):
        if year>1:
            required=set(d['kinds'].get('전공기초',[])+d['kinds'].get('전공필수',[]))
            left=[s for s in d['years'][str(year-1)] if s in required and available(d,s) and not passes(state['records'].get(d['id']+'|'+s,{}).get('grade')) and not state['exempt'].get(d['id']+'|'+s)]
            if left: break
        opened.append(year)
    return opened

def course(state,catalog,department,subject):
    d=next((d for d in catalog if d['id']==department),None)
    year=next((y for y in range(1,5) if subject in d['years'][str(y)]),None) if d else None
    if not d or department not in state['journeys'] or not year or year not in open_years(state,d): fail('입학한 학과의 열린 학년 과목만 저장할 수 있어요.')
    return d,department+'|'+subject

def imported(state,raw,catalog,now):
    result=copy.deepcopy(state)
    ids={d['id'] for d in catalog}
    for id,item in raw.get('journeys',{}).items():
        if id in ids:
            at=item.get('enrolledAt') if isinstance(item,dict) else None
            result['journeys'].setdefault(id,{'enrolledAt':at} if type(at) in (int,float) and 0<at<=now else {})
    # Validate lower years first, so a forged high-year grade cannot unlock itself.
    for d in catalog:
        if d['id'] not in result['journeys']: continue
        for year in range(1,5):
            if year not in open_years(result,d): break
            for subject in d['years'][str(year)]:
                key=d['id']+'|'+subject; row=raw.get('records',{}).get(key)
                if not isinstance(row,dict) or row.get('grade') not in NAMES+['P']: continue
                percent=row.get('percent')
                if row['grade']=='P': percent=None
                elif type(percent)!=int or not 0<=percent<=100 or grade({'correct':percent,'total':100})['grade']!=row['grade']: continue
                attempts=row.get('attempts',1)
                if type(attempts)!=int or not 1<=attempts<=100000: continue
                clean={'grade':row['grade'],'percent':percent,'attempts':attempts,'last':row['grade'],'source':'imported'}
                old=result['records'].get(key)
                if old: clean={**better(old,clean),'attempts':max(old['attempts'],attempts)}
                result['records'][key]=clean
                note=raw.get('notes',{}).get(key)
                if isinstance(note,str) and len(note)<=3000 and key not in result['notes']: result['notes'][key]=note
    if not result['nickname'] and isinstance(raw.get('nickname'),str): result['nickname']=' '.join(raw['nickname'].split())[:12]
    if not result['profilePhoto'] and raw.get('profilePhoto'):
        result['profilePhoto']=photo(raw['profilePhoto'])
    result['studying']=result['studying'] or next(iter(result['journeys']),None)
    return result

def apply_operation(state,op,catalog,now):
    if not isinstance(op,dict): fail()
    allowed={
        'enroll':{'kind','department','enrolledAt'}, 'leave':{'kind','department'},
        'complete':{'kind','department','subject','score','note'},
        'profile':{'kind','nickname','photo','expected'},
        'note':{'kind','department','subject','text'}, 'draft':{'kind','department','subject','text'},
        'reset':{'kind'}, 'preferences':{'kind','campus','studying'},
    }
    kind=op.get('kind')
    if kind not in allowed or set(op)-allowed[kind]: fail()
    result=copy.deepcopy(state); awards=[]
    if kind=='profile':
        if type(op.get('expected'))!=int or op['expected']!=state.get('profileRevision',0):
            raise HTTPException(409,'다른 기기에서 프로필을 바꿨어요. 최신 프로필을 확인하고 다시 저장해 주세요.')
        nickname=' '.join(text(op.get('nickname'),100).split())
        if len(nickname)>12: fail('이름은 12자 이내로 작성해 주세요.')
        result.update(nickname=nickname,profilePhoto=photo(op.get('photo')),profileRevision=state.get('profileRevision',0)+1)
    elif kind=='enroll':
        id=op.get('department')
        if id not in {d['id'] for d in catalog}: fail()
        result['journeys'].setdefault(id,{'enrolledAt':now})
    elif kind=='leave':
        id=op.get('department')
        if id not in {d['id'] for d in catalog}: fail()
        result['journeys'].pop(id,None)
        for name in ('records','notes','drafts','exempt'):
            result[name]={k:v for k,v in result[name].items() if not k.startswith(id+'|')}
        if result['studying']==id: result['studying']=next(iter(result['journeys']),None)
    elif kind=='reset':
        result={**empty_state(),'credits':state['credits'],'creditedAt':state['creditedAt'],'profileRevision':state.get('profileRevision',0)+1}
    elif kind=='preferences':
        if op.get('campus')!='khu-global' or op.get('studying') is not None and op['studying'] not in state['journeys']: fail()
        result.update(campus=op['campus'],studying=op.get('studying'))
    else:
        d,key=course(result,catalog,op.get('department'),op.get('subject'))
        if kind in ('note','draft'):
            result['notes' if kind=='note' else 'drafts'][key]=text(op.get('text'),3000)
        else:
            if not available(d,op['subject']): fail('아직 체험이 없는 과목이에요.')
            got=grade(op.get('score'))
            if got['grade']=='P' and op['subject'] in d.get('games',{}) and op['subject'] not in (d.get('practice'),d['final']): fail()
            old=result['records'].get(key)
            best=better(old,got) if old else got
            result['records'][key]={**best,'attempts':(old['attempts'] if old else 0)+1,'last':got['grade'],'source':'earned'}
            note=text(op.get('note',''),3000).strip()
            if note: result['notes'][key]=note
            result['drafts'].pop(key,None)
            if passes(got['grade']) and now-result['creditedAt'].get(key,-7*86400000)>=7*86400000:
                result['credits']+=5; result['creditedAt'][key]=now
                awards.append({'course_key':key,'awarded_at':now})
    return result,awards
