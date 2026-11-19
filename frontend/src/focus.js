// 체험 화면이 함께 쓰는 키보드 초점 도우미. 컴포넌트가 없는 파일이라 고쳐도 화면의 빠른 새로고침이 깨지지 않는다(#74).

// 코드로 초점을 옮기는 글(문항 글, 라운드 결과 문장)의 테두리: 키보드로 왔을 때만(:focus-visible) 민트 2px로 보인다(#61, #65, #69, #74).
export const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[3px] focus-visible:outline-mint-deep";

// 새 문항·라운드가 나온 뒤 보기를 고를 수 있기까지의 시간(ms). "다음 문제"·"N라운드 시작"을 연타한 두 번째 입력이
// 새 화면의 보기를 고르지 않게 한다(#20). 사람이 읽고 고르는 데는 이보다 오래 걸린다.
export const SETTLE_MS = 400;
