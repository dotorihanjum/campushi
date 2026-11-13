// 학년별 과목 목록과 해금 안내.
import { useState } from "react";
import { delay, Header, Screen } from "../ui.jsx";
import { YEARS, gameOf } from "../model.js";
import { PASS_GRADE } from "../grades.js";
import { experienceName, useGuard, view } from "./shared.jsx";

export function Courses({ active, nav, route, state }) {
  const v = view(state);
  const ok = !!v?.journey;
  const [year, setYear] = useState(() => (YEARS.includes(route?.params?.year) ? route.params.year : 1));
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d, progress } = v;
  const info = progress.years[year - 1];
  // 필수를 먼저, 그 안에서 체험이 있는 과목을 먼저 둔다. 같으면 편성표 순서다.
  const items = [...info.courses].sort((a, b) => b.required - a.required || a.planned - b.planned);
  const required = info.courses.filter((course) => course.required);
  const counted = required.filter((course) => !course.planned);
  const before = progress.years[year - 2];
  const guide = !info.open
    ? `${year - 1}학년 필수과목을 모두 ${PASS_GRADE} 이상으로 이수하면 열려요.${before?.open ? ` 남은 과목: ${before.left.map((course) => course.subject).join(", ")}` : ""}`
    : year < 4
      ? info.left.length
        ? `필수 ${counted.length}과목(체험이 있는 것) 중 ${info.left.length}과목이 남았어요. 모두 ${PASS_GRADE} 이상이면 ${year + 1}학년이 열려요.`
        : `${year}학년 필수과목을 모두 이수했어요. ${year + 1}학년이 열렸어요.`
      : progress.graduated
        ? "졸업 조건을 모두 채웠어요."
        : `4학년 필수과목을 ${PASS_GRADE} 이상으로 이수하고 졸업 과제(${d.finalSubject})를 마치면 졸업해요.`;
  const badge = (course) =>
    course.added && !course.record ? (
      <span className="flex h-[22px] shrink-0 items-center rounded-full border border-mint bg-mint px-[8px] text-[11px] font-bold text-white">새 체험</span>
    ) : course.record ? (
      <span
        className={`flex h-[22px] shrink-0 items-center rounded-full border px-[8px] text-[11px] font-bold ${
          course.passed ? "border-mint bg-mint-soft text-mint-deep" : "border-[#e8a33d] bg-cream text-[#9a5b00]"
        }`}
      >
        {course.passed ? course.record.grade : `${course.record.grade} · 재수강`}
      </span>
    ) : course.planned ? (
      <span className="flex h-[22px] shrink-0 items-center rounded-full border border-line bg-white px-[8px] text-[11px] font-semibold text-gray">구현 예정</span>
    ) : null;
  return (
    <Screen>
      <Header title={`${d.name} · 과목 듣기`} onBack={nav.back} />
      <div className="flow no-scrollbar absolute bottom-0 left-0 top-[100px] w-full overflow-y-auto px-[20px] pb-[32px] pt-[12px]">
        <div className="a-up grid grid-cols-4 gap-[6px]" role="tablist" aria-label="학년">
          {YEARS.map((item) => {
            const opened = progress.years[item - 1].open;
            return (
              <button
                key={item}
                role="tab"
                aria-selected={item === year}
                onClick={() => setYear(item)}
                className={`pressable h-[40px] rounded-full border text-[13.5px] font-semibold ${
                  item === year ? "border-mint bg-mint text-white" : opened ? "border-mint bg-white text-mint-deep" : "border-line bg-chalk text-mute"
                }`}
              >
                {`${item}학년${opened ? "" : " 🔒"}`}
              </button>
            );
          })}
        </div>
        <h1 className="a-up mt-[18px] text-[22px] font-bold leading-[32px] text-navy">{`${year}학년 과목 ${info.courses.length}개`}</h1>
        <p className="a-up mt-[6px] text-[13.5px] leading-[21px] text-gray" style={delay(0.06)}>
          {guide}
        </p>
        <ul className="mt-[18px] grid gap-[10px]">
          {items.map((course, i) => (
            <li key={course.subject} className="a-up" style={delay(0.1 + Math.min(i, 8) * 0.03)}>
              <button
                onClick={() => nav.push("lesson", { subject: course.subject })}
                disabled={!info.open}
                className={`pressable flex min-h-[62px] w-full items-center gap-[10px] rounded-[14px] border px-[16px] py-[10px] text-left disabled:opacity-60 ${
                  course.planned ? "border-line bg-white active:bg-chalk" : "border-cream-line bg-cream active:bg-cream-2"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-[6px]">
                    <span className="truncate text-[15px] font-semibold leading-[22px] text-ink-2">{course.subject}</span>
                    {course.required && <span className="shrink-0 text-[11px] font-bold text-mint">필수</span>}
                  </span>
                  <span className="block text-[12px] leading-[18px] text-gray">
                    {course.final
                      ? `졸업 과제 · ${d.final.name}`
                      : `${course.kind} · ${course.planned ? "체험을 만들고 있어요" : `${experienceName(d, gameOf(d, course.subject))}로 체험해요`}`}
                    {course.record && course.record.attempts > 1 ? ` · ${course.record.attempts}번 들음` : ""}
                    {course.added ? " · 새 체험이 추가됐어요. 다음 학년은 그대로 열려 있고, 다시 해볼 수 있어요" : ""}
                  </span>
                </span>
                {badge(course)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
