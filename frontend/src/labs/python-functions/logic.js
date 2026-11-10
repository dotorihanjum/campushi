// 함수 고르기 체험의 순수 로직: 보기 섞기, 채점.

/** 보기 블록 순서. 문항 순서와 같지 않게 섞는다(문항이 하나면 그대로). random은 0 이상 1 미만을 돌려주는 함수. */
export function shuffledBlocks(items, random = Math.random) {
  const ids = items.map((item) => item.id);
  if (ids.length < 2) return ids;
  for (let tries = 0; tries < 20; tries += 1) {
    const order = [...ids];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((id, i) => id !== ids[i])) return order;
  }
  // 섞어도 계속 같은 순서가 나오면(고정된 random 등) 한 칸씩 민다.
  return [...ids.slice(1), ids[0]];
}

/** 빈칸마다 맞았는지: { 문항id: true | false }. 비어 있는 빈칸은 false. value는 { 문항id: 넣은 블록id }. */
export const marksOf = (items, value) => Object.fromEntries(items.map((item) => [item.id, value?.[item.id] === item.id]));

/** 모든 빈칸이 채워졌는지. */
export const filled = (items, value) => items.every((item) => typeof value?.[item.id] === "string");

/** 맞힌 수(기록 요약용, 성적에는 쓰지 않는다). */
export const scoreOf = (items, value) => ({ correct: items.filter((item) => value?.[item.id] === item.id).length, total: items.length });

/**
 * 블록을 빈칸에 넣는다. 그 블록이 다른 빈칸에 있었으면 거기서 빼고, 빈칸에 있던 블록은 보기로 돌려보낸다.
 * slot이 null이면 블록을 보기로 돌려보낸다.
 */
export function place(value, block, slot) {
  const next = Object.fromEntries(Object.entries(value || {}).filter(([, placed]) => placed !== block));
  if (slot) next[slot] = block;
  return next;
}
