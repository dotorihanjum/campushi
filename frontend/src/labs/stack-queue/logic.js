// 스택·큐 체험의 순수 로직: 명령을 차례로 실행한 상태, 꺼낼 때 나오는 값, 생활 속 예시 채점.

/** 꺼내기를 할 때 나오는 값. kind가 stack이면 마지막에 넣은 것(맨 위), queue면 먼저 넣은 것(맨 앞). 비어 있으면 null. */
export const nextOut = (kind, items) => (items.length ? (kind === "stack" ? items.at(-1) : items[0]) : null);

/**
 * 명령 steps 중 앞의 count개를 실행한 상태: { items(넣은 순서대로), out(마지막으로 꺼낸 값 또는 null) }.
 * 비어 있을 때 꺼내기는 아무것도 하지 않는다.
 */
export function run(kind, steps, count) {
  let items = [];
  let out = null;
  for (const step of steps.slice(0, count)) {
    if (step.put !== undefined) {
      items = [...items, step.put];
      out = null;
    } else if (step.take) {
      out = nextOut(kind, items);
      if (out !== null) items = kind === "stack" ? items.slice(0, -1) : items.slice(1);
    }
  }
  return { items, out };
}

/** 생활 속 예시 블록. 스택·큐 블록을 예시 수만큼 만든다(같은 이름의 블록이 여러 개). 블록 id는 "stack-1"처럼 상자 id로 시작한다. */
export function blocksFor(boxes, uses) {
  return boxes.flatMap((box) =>
    uses.filter((use) => use.answer === box.id).map((_, i) => ({ id: `${box.id}-${i + 1}`, label: box.name })),
  );
}

/** 생활 속 예시 채점: { 예시id: true | false }. 넣은 블록의 상자가 정답이면 맞다. */
export const marksFor = (uses, value) =>
  Object.fromEntries(uses.map((use) => [use.id, typeof value?.[use.id] === "string" && value[use.id].replace(/-\d+$/, "") === use.answer]));
