// 버튼 연타 막기: 같은 동작(key)을 짧은 시간(windowMs) 안에 다시 부르면 한 번으로 묶는다.
// 시간이 지나면 다시 동작한다. 시계(now)는 테스트에서 바꿔 끼울 수 있게 받는다.

/** 연타 막기 함수를 만든다. 돌려준 함수는 key로 부를 때 이번에 동작해도 되면 true, 묶어야 하면 false를 돌려준다. */
export function createTapGuard(windowMs, now = () => Date.now()) {
  const last = new Map();
  return (key) => {
    const time = now();
    const previous = last.get(key);
    if (previous !== undefined && time - previous < windowMs) return false;
    last.set(key, time);
    return true;
  };
}
