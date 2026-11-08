"""이론 수업 문제 은행(data/theory_banks.jsonl)의 형식 검사와 검증 도구.

문제 은행은 AI가 강의계획서를 읽고 쓰고, 쓰지 않은 별도 에이전트가 정답을 가린 문제지를 풀어 검증한다.

    python -m backend.theory_banks check                 # 모든 은행의 형식 검사
    python -m backend.theory_banks blind 과목 > 문제지.json  # 정답을 가린 문제지
    python -m backend.theory_banks apply 과목 답안.json     # 답안과 대조해 틀리거나 지적된 항목을 빼고 상태를 정한다

답안 형식: {"reviewer": "...", "answers": {"term-0": "용어", "unit-0": "단원", "fact-0": true, "seq-0": ["단계", ...]},
           "flags": {"fact-3": "틀린 이유"}}
term-N은 뜻을 보고 고른 용어, unit-N은 용어가 속한 단원, fact-N은 문장의 참(true)·거짓(false), seq-N은 단계의 올바른 순서다.
답이 다르거나 flags에 있는 항목은 빼고, 남은 것이 형식을 만족하면 status를 verified로, 아니면 rejected로 둔다.
형식과 상한은 frontend/src/lessonGames.js의 cleanTheory와 같아야 한다.
"""

import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PATH = Path(__file__).parent / "data" / "theory_banks.jsonl"
KST = timezone(timedelta(hours=9))


def _text(value, limit):
    return isinstance(value, str) and value.strip() != "" and len(value) <= limit


def problems(bank):
    """형식 문제 목록. 비어 있으면 화면에서 쓸 수 있다."""
    found = []
    if not _text(bank.get("course_name"), 40):
        found.append("course_name이 없습니다.")
    if not _text(bank.get("title"), 20):
        found.append("title은 1~20자입니다.")
    if not _text(bank.get("explanation"), 120):
        found.append("explanation은 1~120자입니다.")
    units = bank.get("units")
    if not (isinstance(units, list) and 2 <= len(units) <= 6 and all(_text(u, 8) for u in units) and len(set(units)) == len(units)):
        found.append("units는 서로 다른 단원 이름(1~8자) 2~6개입니다.")
        units = []
    terms = bank.get("terms")
    if not (isinstance(terms, list) and 8 <= len(terms) <= 40):
        found.append("terms는 8~40개입니다.")
        terms = []
    for i, item in enumerate(terms):
        if not (isinstance(item, dict) and _text(item.get("term"), 10) and _text(item.get("meaning"), 22)
                and isinstance(item.get("unit"), int) and not isinstance(item.get("unit"), bool) and 0 <= item["unit"] < len(units)):
            found.append(f"terms[{i}]: term 1~10자, meaning 1~22자, unit은 단원 번호입니다.")
    good = [item for item in terms if isinstance(item, dict)]
    if len({item.get("term") for item in good}) != len(good) or len({item.get("meaning") for item in good}) != len(good):
        found.append("terms의 용어와 뜻은 서로 달라야 합니다.")
    facts = bank.get("facts")
    if not (isinstance(facts, list) and 5 <= len(facts) <= 40):
        found.append("facts는 5~40개입니다.")
        facts = []
    for i, item in enumerate(facts):
        if not (isinstance(item, dict) and _text(item.get("text"), 60) and isinstance(item.get("answer"), bool) and _text(item.get("explanation"), 80)):
            found.append(f"facts[{i}]: text 1~60자, answer는 참·거짓, explanation 1~80자입니다.")
    answers = [item.get("answer") for item in facts if isinstance(item, dict)]
    if answers.count(True) < 2 or answers.count(False) < 2:
        found.append("facts에는 맞는 문장과 틀린 문장이 2개 이상씩 있어야 합니다.")
    sequences = bank.get("sequences", [])
    if not (isinstance(sequences, list) and len(sequences) <= 10):
        found.append("sequences는 0~10개입니다.")
        sequences = []
    for i, item in enumerate(sequences):
        steps = item.get("steps") if isinstance(item, dict) else None
        if not (isinstance(item, dict) and _text(item.get("prompt"), 40) and _text(item.get("explanation"), 120)
                and isinstance(steps, list) and 4 <= len(steps) <= 5 and all(_text(s, 24) for s in steps) and len(set(steps)) == len(steps)):
            found.append(f"sequences[{i}]: prompt 1~40자, 서로 다른 단계(1~24자) 4~5개, explanation 1~120자입니다.")
    return found


def load(path=PATH):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def save(banks, path=PATH):
    path.write_text("".join(json.dumps(bank, ensure_ascii=False) + "\n" for bank in banks), encoding="utf-8")


def find(banks, course):
    for bank in banks:
        if bank.get("course_name") == course:
            return bank
    raise SystemExit(f"{course}: 문제 은행이 없습니다.")


def blind(bank, seed=None):
    """정답을 가린 문제지. 용어·단원 보기는 은행 전체에서, 문항 순서와 단계 순서는 섞는다."""
    rng = random.Random(seed)
    terms = [item["term"] for item in bank["terms"]]
    questions = []
    for i, item in enumerate(bank["terms"]):
        questions.append({"id": f"term-{i}", "kind": "뜻에 맞는 용어 고르기", "meaning": item["meaning"], "options": rng.sample(terms, len(terms))})
        questions.append({"id": f"unit-{i}", "kind": "용어가 속한 단원 고르기", "term": item["term"], "options": bank["units"]})
    for i, item in enumerate(bank["facts"]):
        questions.append({"id": f"fact-{i}", "kind": "문장이 맞으면 true, 틀리면 false", "text": item["text"]})
    for i, item in enumerate(bank.get("sequences", [])):
        questions.append({"id": f"seq-{i}", "kind": "단계를 올바른 순서로", "prompt": item["prompt"], "steps": rng.sample(item["steps"], len(item["steps"]))})
    rng.shuffle(questions)
    return {"course_name": bank["course_name"], "units": bank["units"], "questions": questions}


def apply(bank, review):
    """답안과 대조해 틀리거나 지적된 항목을 뺀 은행을 돌려준다."""
    answers = review.get("answers", {})
    flags = review.get("flags", {})
    removed = []

    def keep(prefix, i, expected):
        ok = answers.get(f"{prefix}-{i}") == expected and f"{prefix}-{i}" not in flags
        if not ok:
            removed.append(f"{prefix}-{i}")
        return ok

    terms = []
    for i, item in enumerate(bank["terms"]):
        # 뜻→용어와 용어→단원을 모두 맞혀야 남긴다(용어 고르기와 분류하기에 함께 쓰므로).
        term_ok = keep("term", i, item["term"])
        unit_ok = keep("unit", i, bank["units"][item["unit"]])
        if term_ok and unit_ok:
            terms.append(item)
    facts = [item for i, item in enumerate(bank["facts"]) if keep("fact", i, item["answer"])]
    sequences = [item for i, item in enumerate(bank.get("sequences", [])) if keep("seq", i, item["steps"])]
    result = {**bank, "terms": terms, "facts": facts, "sequences": sequences}
    issues = problems(result)
    result["status"] = "verified" if not issues else "rejected"
    result["check"] = {
        "reviewer": review.get("reviewer", ""),
        "removed": removed,
        "flags": flags,
        "issues": issues,
        "checked_at": datetime.now(KST).isoformat(timespec="seconds"),
    }
    return result


def main(argv):
    if not argv or argv[0] not in ("check", "blind", "apply"):
        raise SystemExit(__doc__)
    banks = load()
    if argv[0] == "check":
        bad = 0
        for bank in banks:
            for issue in problems(bank):
                bad += 1
                print(f"{bank.get('course_name')}: {issue}")
        print(f"문제 은행 {len(banks)}개, 형식 문제 {bad}건")
        return 1 if bad else 0
    if argv[0] == "blind":
        print(json.dumps(blind(find(banks, argv[1])), ensure_ascii=False, indent=1))
        return 0
    bank = find(banks, argv[1])
    review = json.loads(Path(argv[2]).read_text(encoding="utf-8"))
    result = apply(bank, review)
    save([result if item is bank else item for item in banks])
    check = result["check"]
    print(f"{argv[1]}: {result['status']} · 뺀 항목 {len(check['removed'])}개 {check['removed']} · 형식 문제 {check['issues']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
