// 마이페이지: 프로필, 나의 학과 체험, 설정, 도움말.
import { useEffect, useRef, useState } from "react";
import { prepareProfilePhoto } from "../profilePhoto.js";
import { yearCharacter } from "../assets.js";
import { delay, Screen, Dialog, Toast } from "../ui.jsx";
import { CREDIT_PER_PASS, NICKNAME_MAX, STORAGE_KEY, cleanNickname, courseKey, initialState, progressOf } from "../model.js";
import { CAMPUS } from "../campus.js";
import { Chevron, INPUT, ProgressBar, TAB_H, TAB_TOP, TabBar, all, download, gradeText, josa, latestJourney, reportText } from "./shared.jsx";

// 마이페이지 목록 한 줄(누르면 창을 열거나 화면을 옮긴다).
function MenuRow({ label, value, onClick, tone = "text-ink-2" }) {
  return (
    <li>
      <button onClick={onClick} className="my-menu-row pressable">
        <span className={`min-w-0 flex-1 ${tone}`}>{label}</span>
        {value && <span className="my-menu-value">{value}</span>}
        <Chevron />
      </button>
    </li>
  );
}

function MenuGroup({ title, children, d = 0 }) {
  return (
    <section className="my-section a-up" style={delay(d)}>
      <h2>{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}

export function My({ nav, state, setState }) {
  // 열려 있는 창: profile, credit, storage, sources, reset, record:<학과id>.
  const [sheet, setSheet] = useState(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const photoInput = useRef(null);
  const photoRequest = useRef(0);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    photoRequest.current++;
  }, []);
  const say = (text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };
  const departments = all(state);
  const journeys = Object.keys(state.journeys)
    .map((id) => departments.find((item) => item.id === id && item.school))
    .filter(Boolean)
    .map((d) => ({ d, progress: progressOf(state, d) }));
  // 지금 체험 중인 학과(홈과 같다: 홈에 보여 주던 학과, 없으면 가장 최근에 입학한 학과).
  const studyingId = state.journeys[state.studying] ? state.studying : latestJourney(state);
  const studying = journeys.find((item) => item.d.id === studyingId) || null;
  const character = yearCharacter(studying?.progress.openYear || 1);
  const passed = journeys.reduce((sum, item) => sum + item.progress.passedCount, 0);
  const graduated = journeys.filter((item) => item.progress.graduated).length;
  const sources = departments.filter((d) => d.source.url);
  const nickname = state.nickname || "";
  const selectedRecord = journeys.find(({ d }) => sheet === `record:${d.id}`);
  const openRecord = (d, screen) => {
    setState((s) => ({ ...s, current: d.id }));
    nav.push(screen);
  };

  const openProfile = () => {
    photoRequest.current++;
    setName(nickname);
    setPhoto(state.profilePhoto || null);
    setPhotoBusy(false);
    setProfileError("");
    setSheet("profile");
  };
  const saveProfile = (e) => {
    e.preventDefault();
    if (photoBusy) return;
    const next = cleanNickname(name);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, nickname: next, profilePhoto: photo }));
    } catch {
      setProfileError("프로필을 저장하지 못했어요. 브라우저의 저장 공간과 사이트 저장 권한을 확인해 주세요.");
      return;
    }
    setState((s) => ({ ...s, nickname: next, profilePhoto: photo }));
    setSheet(null);
    say("프로필을 저장했어요.");
  };
  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const request = ++photoRequest.current;
    setPhotoBusy(true);
    setProfileError("");
    try {
      const result = await prepareProfilePhoto(file);
      if (request === photoRequest.current) setPhoto(result);
    } catch (error) {
      if (request === photoRequest.current) setProfileError(error.message);
    } finally {
      if (request === photoRequest.current) setPhotoBusy(false);
    }
  };
  const close = () => {
    photoRequest.current++;
    setSheet(null);
  };
  const closeButton = (
    <button className="button ghost" onClick={close}>
      닫기
    </button>
  );
  const link = "text-mint-deep underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-mint-deep";

  const dialogs = {
    profile: (
      <Dialog
        title="프로필 편집"
        onClose={close}
        actions={
          <>
            <button type="submit" form="profile-form" className="button" disabled={photoBusy}>
              {photoBusy ? "사진 준비 중…" : "저장하기"}
            </button>
            <button className="button ghost" onClick={close}>
              취소
            </button>
          </>
        }
      >
        <form id="profile-form" onSubmit={saveProfile} className="my-profile-editor" style={{ maxHeight: "calc((var(--vh) - 240) * 1px)" }}>
          <div className="my-photo-preview">
            <img src={photo || character.src} alt={photo ? "선택한 프로필 사진 미리보기" : character.alt} className={photo ? "is-photo" : ""} />
          </div>
          <div className="my-photo-options" role="group" aria-label="프로필 이미지 선택">
            <button type="button" aria-pressed={!photo} data-autofocus onClick={() => {
              photoRequest.current++;
              setPhoto(null);
              setPhotoBusy(false);
              setProfileError("");
            }}>기본 캐릭터 {!photo && <span aria-hidden>✓</span>}</button>
            <button type="button" aria-pressed={!!photo} disabled={photoBusy} onClick={() => photoInput.current?.click()}>
              내 사진 업로드 {photo && <span aria-hidden>✓</span>}
            </button>
          </div>
          <p className="my-photo-help">{photo ? "사진 가운데를 정사각형으로 맞춰 보여드려요." : "기본 캐릭터는 학년이 올라가면 함께 바뀌어요."}</p>
          <p className="my-photo-help">JPG·PNG·WebP, 최대 10MB · 이 브라우저에만 저장돼요.</p>
          {photoBusy && <p role="status" className="my-photo-help">사진을 준비하고 있어요…</p>}
          {profileError && <p role="alert" className="my-profile-error">{profileError}</p>}
          <label htmlFor="nickname" className="block">
            이름 <span className="my-photo-help">(선택, 최대 {NICKNAME_MAX}자)</span>
          </label>
          <input
            id="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NICKNAME_MAX * 2}
            autoComplete="nickname"
            placeholder="예: 미래의 개발자"
            className={`${INPUT} mt-[12px] h-[48px] w-full`}
          />
          <p className={`mt-[6px] text-right text-[12px] tabular-nums ${[...name.trim()].length > NICKNAME_MAX ? "text-[#c62a2f]" : "text-gray"}`} aria-live="polite">
            {[...name.trim()].length > NICKNAME_MAX ? `${NICKNAME_MAX}자까지만 저장돼요` : `${[...name.trim()].length} / ${NICKNAME_MAX}`}
          </p>
          <p className="my-photo-help">비워 두면 ‘나의 프로필’로 보여요.</p>
        </form>
      </Dialog>
    ),
    credit: (
      <Dialog title="크레딧은 어디에 쓰나요?" onClose={close} actions={closeButton}>
        {`과목을 이수할 때마다 크레딧 ${josa(String(CREDIT_PER_PASS), "을", "를")} 받아요. 같은 과목을 다시 해서 이수해도 받아요. 모은 크레딧은 모든 학과에서 함께 쓰고, 재학생 멘토링이 열리면 쓸 수 있어요.`}
      </Dialog>
    ),
    storage: (
      <Dialog title="기록은 어디에 저장되나요?" onClose={close} actions={closeButton}>
        체험 기록, 한 줄 기록, 크레딧, 이름, 프로필 사진은 지금 쓰는 이 브라우저에만 저장돼요. 다른 기기나 브라우저에서는 보이지 않고, 브라우저의 사이트 데이터를 지우면 함께 사라져요. 남겨 두고 싶은 기록은 체험 기록의 &lsquo;리포트 내려받기&rsquo;로 저장해 주세요.
      </Dialog>
    ),
    sources: (
      <Dialog title="자료 출처" onClose={close} actions={closeButton}>
        <p>학년별 과목은 학교의 공식 교육과정 편성표를 따라요.</p>
        <ul className="mt-[10px] grid gap-[8px]">
          {sources.map((d) => (
            <li key={d.id}>
              <a href={d.source.url} target="_blank" rel="noopener noreferrer" className={link}>
                {`${d.name}${d.source.year ? ` ${d.source.year} 교육과정` : " 교육과정"}`}
              </a>
            </li>
          ))}
          <li>
            <a href={CAMPUS.source} target="_blank" rel="noopener noreferrer" className={link}>
              {`${CAMPUS.school} ${CAMPUS.name} 캠퍼스맵(건물 이름·번호)`}
            </a>
          </li>
          <li>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className={link}>
              지도 모양 © OpenStreetMap 기여자
            </a>
          </li>
        </ul>
      </Dialog>
    ),
    reset: (
      <Dialog
        title="처음부터 다시 시작할까요?"
        onClose={close}
        actions={
          <>
            <button className="button ghost" onClick={close}>
              그대로 두기
            </button>
            <button
              className="button danger"
              onClick={() => {
                // 학과 데이터는 남겨 두어 처음부터 다시 시작해도 바로 학과를 볼 수 있게 한다.
                setState((s) => ({ ...structuredClone(initialState), catalog: s.catalog }));
                nav.reset(["splash"]);
              }}
            >
              모두 지우기
            </button>
          </>
        }
      >
        입학한 학과, 성적, 한 줄 기록, 크레딧, 이름, 프로필 사진이 모두 지워지고 되돌릴 수 없어요. 남겨 둘 리포트는 먼저 내려받아 주세요.
      </Dialog>
    ),
  };

  return (
    <Screen
      foot={TAB_TOP}
      veil={false}
      footer={<TabBar active="my" nav={nav} state={state} />}
      overlay={
        <>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto} />
          {sheet && dialogs[sheet]}
          {selectedRecord && (
            <Dialog title={`${selectedRecord.d.name} 체험 기록`} onClose={close} actions={
              <>
                <button className="button" onClick={() => { close(); openRecord(selectedRecord.d, "major"); }}>학과 홈 보기</button>
                {closeButton}
              </>
            }>
              <div className="my-record-notes" style={{ maxHeight: "calc((var(--vh) - 300) * 1px)" }}>
                {selectedRecord.progress.taken.length === 0 ? (
                  <p>아직 남긴 과목 기록이 없어요. 학과 홈에서 수업을 체험하고 한 줄 기록을 남겨 보세요.</p>
                ) : (
                  <ul>
                    {selectedRecord.progress.taken.map((course) => (
                      <li key={course.subject}>
                        <h3>{course.subject}</h3>
                        <p className="my-secondary">{`${course.year}학년 · ${gradeText(course.record)}`}</p>
                        <p>{state.notes[courseKey(selectedRecord.d.id, course.subject)] || "남긴 한 줄 기록이 없어요."}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Dialog>
          )}
          <Toast>{toast}</Toast>
        </>
      }
    >
      <div
        className="my-page flow no-scrollbar absolute left-0 top-[48px] w-full overflow-y-auto px-[20px] pb-[32px]"
        style={{ bottom: `calc(${TAB_H}px - var(--bt) * 1px)` }}
      >
        <h1 className="my-title">마이페이지</h1>
        <section aria-label="프로필" className="my-profile a-up">
          <button className={`my-avatar ${state.profilePhoto ? "has-photo" : ""}`} onClick={openProfile} aria-label="프로필 이미지 변경">
            <img src={state.profilePhoto || character.src} alt={state.profilePhoto ? "내 프로필 사진" : character.alt} />
            <span className="my-avatar-edit" aria-hidden>✎</span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="my-name-row">
              <p className="my-name">{nickname || "나의 프로필"}</p>
              <button className="my-edit" onClick={openProfile} aria-label="프로필 편집" title="프로필 편집">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="my-secondary">{`${CAMPUS.school} ${CAMPUS.name}`}</p>
            <p className="my-profile-status">
              {studying
                ? `${studying.d.name} · ${studying.progress.graduated ? "졸업" : `${studying.progress.openYear}학년`}`
                : "첫 학과 체험을 기다리고 있어요"}
            </p>
          </div>
          <button className="my-profile-credit" onClick={() => setSheet("credit")} aria-label={`내 크레딧 ${state.credits || 0}, 크레딧 안내 보기`}>
            <span>내 크레딧</span>
            <span className="my-credit-value"><strong>{state.credits || 0}</strong><span>크레딧</span><Chevron /></span>
          </button>
        </section>

        <section className="my-section a-up" aria-labelledby="my-records-title" style={delay(0.06)}>
          <div className="my-section-heading">
            <h2 id="my-records-title">내 체험 기록</h2>
            {journeys.length > 0 && <span className="my-secondary">{journeys.length}개 학과</span>}
          </div>
          {journeys.length === 0 ? (
            <div className="my-empty">
              <p className="my-empty-title">어떤 학과가 나에게 맞을까요?</p>
              <p className="my-secondary">학과에 체험 입학하면 해본 활동과<br />남긴 기록이 여기에 모여요.</p>
              <button className="my-action primary" onClick={() => nav.reset([["home", { focus: "departments" }]], "fade")}>
                학과 둘러보기 <span aria-hidden>→</span>
              </button>
            </div>
          ) : (
            <>
              <p className="my-record-summary">이수한 과목 <strong>{passed}</strong> · 졸업한 학과 <strong>{graduated}</strong></p>
              <ul className="my-journeys">
                {journeys.map(({ d, progress }) => (
                  <li key={d.id} className={`my-journey ${progress.graduated ? "is-graduated" : ""}`}>
                    <div className="my-section-heading">
                      <h3>{d.name}</h3>
                      <span className="my-year">{progress.graduated ? "졸업" : `${progress.openYear}학년`}</span>
                    </div>
                    <p className="my-secondary">{`이수 ${progress.passedCount}과목 · ${progress.graduated ? "졸업 완료" : `졸업까지 ${progress.percent}%`}`}</p>
                    <ProgressBar percent={progress.percent} label={`${d.name} 졸업까지 진행률`} />
                    <div className="my-record-actions">
                      <button className="my-action" onClick={() => progress.graduated ? openRecord(d, "graduation") : setSheet(`record:${d.id}`)} aria-label={`${d.name} ${progress.graduated ? "졸업 리포트" : "체험 기록"} 보기`}>
                        {progress.graduated ? "졸업 리포트 보기" : "체험 기록 보기"}<Chevron />
                      </button>
                      {progress.taken.length > 0 && (
                        <button className="my-action" onClick={() => download(`${d.school}-${d.name}-체험-리포트.txt`, reportText(state, d))} aria-label={`${d.name} 리포트 내려받기`}>
                          리포트 받기 (.txt) <span aria-hidden>↓</span>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="my-storage" onClick={() => setSheet("storage")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 7v4M8 4.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>기록은 이 브라우저에만 저장돼요</span><Chevron />
          </button>
        </section>

        <MenuGroup title="설정 및 도움말" d={0.12}>
          <MenuRow label="학교 바꾸기" onClick={() => nav.push("school", { change: true })} />
          <MenuRow label="자료 출처" onClick={() => setSheet("sources")} />
        </MenuGroup>
        <div className="my-reset">
          <button onClick={() => setSheet("reset")}>처음부터 다시 시작하기</button>
          <p>프로필과 모든 체험 기록을 지워요.</p>
        </div>
      </div>
    </Screen>
  );
}
