import test from "node:test";
import assert from "node:assert/strict";
import {
  accountView,
  hasGuestRecords,
  persistAccount,
  readAccount,
  clearAccountCache,
} from "./accountRecords.js";
import { initialState } from "./model.js";

test("server balance replaces guest balance and guest data is not an account cache", () => {
  const view = accountView(
    { ...initialState, credits: 999 },
    { state: { credits: 5, nickname: "계정 학생" } },
  );
  assert.equal(view.credits, 5);
  assert.equal(view.nickname, "계정 학생");
  assert.equal(hasGuestRecords(initialState), false);
  assert.equal(hasGuestRecords({ ...initialState, nickname: "학생" }), true);
});
test("cached queue is isolated by account scope and storage failure is explicit", () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k),
    setItem: (k, v) => map.set(k, v),
    removeItem: k => map.delete(k),
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
  };
  assert.equal(
    persistAccount(storage, {
      scope: "A",
      queue: [{ operation_id: "one", scope: "A", changes: [] }],
    }),
    true,
  );
  persistAccount(storage, {
    scope: "B",
    queue: [{ operation_id: "two", scope: "B", changes: [] }],
  });
  clearAccountCache(storage, "B");
  assert.deepEqual(readAccount(storage, "B").queue, []);
  assert.equal(readAccount(storage, "A").queue.length, 1);
  assert.equal(
    persistAccount(
      {
        setItem() {
          throw Error("quota");
        },
      },
      { scope: "A", queue: [{ operation_id: "new", scope: "A", changes: [] }] },
    ),
    false,
  );
});

import { RecordSync, captureChanges, pendingView } from "./accountRecords.js";
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i],
  };
};
const doc = () => ({
  scope: "account-A",
  revision: 0,
  state: { ...structuredClone(initialState), catalog: undefined },
});
test("offline queue survives reload and retries the same operation UUID", async () => {
  const storage = memory();
  let online = false,
    ids = [];
  const request = async (path, method, item) => {
    ids.push(item.operation_id);
    if (!online) throw Error("offline");
    return { ...doc(), revision: 1 };
  };
  const first = new RecordSync({ storage, request, change() {} });
  await first.open(doc());
  first.enqueue([{ kind: "enroll", department: "khu-cse" }]);
  await assert.rejects(first.flush());
  assert.equal(first.queue.length, 1);
  const id = first.queue[0].operation_id;
  first.close();
  online = true;
  const second = new RecordSync({ storage, request, change() {} });
  await second.open(doc());
  assert.deepEqual(ids, [id, id]);
  assert.equal(second.queue.length, 0);
});
test("an edit queued during an in-flight save is sent in order", async () => {
  let release,
    seen = [];
  const gate = new Promise((r) => {
    release = r;
  });
  const sync = new RecordSync({
    storage: memory(),
    change() {},
    request: async (path, method, item) => {
      seen.push(item.changes[0].kind);
      if (seen.length === 1) await gate;
      return { ...doc(), revision: seen.length };
    },
  });
  await sync.open(doc());
  sync.enqueue([{ kind: "enroll", department: "khu-cse" }]);
  const saving = sync.flush();
  sync.enqueue([
    { kind: "draft", department: "khu-cse", subject: "이산구조", text: "메모" },
  ]);
  release();
  await saving;
  assert.deepEqual(seen, ["enroll", "draft"]);
  assert.equal(sync.queue.length, 0);
});
test("closing account A prevents its late response applying to account B", async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let notifications = 0;
  const sync = new RecordSync({
    storage: memory(),
    change() {
      notifications++;
    },
    request: async () => {
      await gate;
      return doc();
    },
  });
  await sync.open(doc());
  sync.enqueue([{ kind: "reset" }]);
  const saving = sync.flush();
  sync.close();
  const before = notifications;
  release();
  await saving;
  assert.equal(notifications, before);
  assert.equal(sync.queue.length, 1);
});
test("balance edits are never captured as commands and navigation stays local", () => {
  const before = structuredClone(initialState);
  assert.deepEqual(
    captureChanges(before, { ...before, credits: 100000, current: "khu-cse" }),
    [],
  );
  assert.deepEqual(
    captureChanges(before, { ...before, studying: "khu-cse" }),
    [],
  );
});
test("ambiguous profile response retries its original delivery UUID", async () => {
  let fail = true,
    ids = [];
  const sync = new RecordSync({
    storage: memory(),
    change() {},
    request: async (path, method, item) => {
      ids.push(item.operation_id);
      if (fail) throw Error("timeout");
      return {
        ...doc(),
        state: { ...doc().state, nickname: "학생", profileRevision: 1 },
      };
    },
  });
  await sync.open(doc());
  await assert.rejects(sync.saveProfile("학생", null));
  fail = false;
  await sync.saveProfile("학생", null);
  assert.equal(ids[0], ids[1]);
});

test("logout warns on unsent records; cancellation keeps the session and queue", async () => {
  let ended = 0;
  const sync = new RecordSync({
    storage: memory(),
    change() {},
    request: async () => {
      throw Error("offline");
    },
  });
  await sync.open(doc());
  sync.enqueue([{ kind: "reset" }]);
  await assert.rejects(
    sync.logout(async () => {
      ended++;
    }),
    (e) => e.unsaved === true,
  );
  assert.equal(ended, 0);
  assert.equal(sync.active, true);
  assert.equal(sync.queue.length, 1);
  await sync.logout(
    async () => {
      ended++;
    },
    { discard: true },
  );
  assert.equal(ended, 1);
  assert.equal(sync.active, false);
});
test("failed session termination keeps local pending data", async () => {
  const sync = new RecordSync({ storage: memory(), change() {} });
  await sync.open(doc());
  await assert.rejects(
    sync.logout(async () => {
      throw Error("session server unavailable");
    }),
  );
  assert.equal(sync.active, true);
});
test("two tabs use different queue keys for the same account", async () => {
  const storage = memory();
  const first = new RecordSync({ storage, client: "tab-A", change() {} });
  const second = new RecordSync({ storage, client: "tab-B", change() {} });
  await first.open(doc());
  await second.open(doc());
  first.enqueue([{ kind: "reset" }]);
  second.enqueue([{ kind: "enroll", department: "khu-cse" }]);
  assert.deepEqual(
    readAccount(storage, "account-A")
      .queue.map((item) => item.changes[0].kind)
      .sort(),
    ["enroll", "reset"],
  );
});

import { RAW_CSE, RAW_ID } from "./testFixtures.js";
test("server acknowledgement preserves the department being browsed before enrollment", () => {
  const local = {
    ...initialState,
    catalog: [RAW_CSE, RAW_ID],
    current: "khu-id",
  };
  const saved = {
    state: { ...structuredClone(initialState), journeys: { "khu-cse": {} } },
  };
  assert.equal(accountView(local, saved).current, "khu-id");
});
test("another account never inherits private unfinished plays", () => {
  const local = {
    ...initialState,
    plays: { "khu-cse|이산구조": { summary: "계정 A의 비공개 기록" } },
  };
  assert.deepEqual(pendingView(local, doc(), []).plays, {});
});
test("logout lock synchronously blocks another tab from adding unsaved work", async () => {
  const storage = memory();
  const a = new RecordSync({ storage, change() {} }),
    b = new RecordSync({ storage, change() {} });
  await a.open(doc());
  await b.open(doc());
  a.signal("lock");
  assert.equal(b.enqueue([{ kind: "reset" }]), false);
  assert.equal(b.queue.length, 0);
  a.signal("release");
  b.enqueue([{ kind: "reset" }]);
  assert.equal(b.queue.length, 1);
});
test("a duplicated tab recovers immutable deliveries without overwriting other work", async () => {
  const storage = memory();
  const a = new RecordSync({ storage, client: "copied-id", change() {} });
  await a.open(doc());
  a.enqueue([{ kind: "enroll", department: "khu-cse" }]);
  const b = new RecordSync({
    storage,
    client: "copied-id",
    change() {},
    request: async () => {
      throw Error("offline");
    },
  });
  await assert.rejects(b.open(doc()));
  b.enqueue([
    {
      kind: "draft",
      department: "khu-cse",
      subject: "이산구조",
      text: "새 기록",
    },
  ]);
  a.enqueue([
    {
      kind: "note",
      department: "khu-cse",
      subject: "이산구조",
      text: "다른 창 기록",
    },
  ]);
  assert.equal(readAccount(storage, "account-A").queue.length, 3);
});

test("a session rejected during periodic refresh hides the active account", async () => {
  const phases = [];
  const sync = new RecordSync({
    storage: memory(),
    change: (state) => phases.push(state.phase),
    request: async () => {
      const error = new Error("expired");
      error.status = 401;
      throw error;
    },
  });
  await sync.open(doc());
  await assert.rejects(sync.refresh());
  assert.equal(phases.at(-1), "expired");
});

test("a rejected course change rolls back while valid siblings and later writes save", async () => {
  const storage = memory();
  const sent = [];
  const received = [];
  const enrollment = { kind: "enroll", department: "khu-cse" };
  const bad = { kind: "complete", department: "khu-cse", subject: "빠진 과목" };
  const note = { kind: "note", department: "khu-cse", subject: "이산구조", text: "계속 저장" };
  const sync = new RecordSync({
    storage,
    change: (next) => received.push(next.rejectedRecord),
    request: async (_path, _method, item) => {
      sent.push(item);
      if (item.changes.includes(bad)) {
        throw Object.assign(new Error("과목을 저장할 수 없어요."), {
          status: 400, code: "record_change_rejected", changeIndex: 1,
        });
      }
      return { ...doc(), revision: sent.length,
        state: { ...doc().state, notes: { "khu-cse|이산구조": note.text } } };
    },
  });
  await sync.open(doc());
  sync.enqueue([enrollment, bad]);
  sync.enqueue([note]);
  await sync.flush();
  assert.deepEqual(sent.map((item) => item.changes), [[enrollment, bad], [enrollment], [note]]);
  assert.equal(sent[0].operation_id, sent[1].operation_id);
  assert.equal(sync.doc.state.notes["khu-cse|이산구조"], "계속 저장");
  assert.equal(readAccount(storage, sync.doc.scope).queue.length, 0);
  assert.match(received.at(-1), /빠진 과목.*과목을 저장할 수 없어요/);
  sync.dismissRejected();
  sync.enqueue([{ ...note, text: "다음 기록" }]);
  await sync.flush();
  assert.equal(received.at(-1), "");
});

test("a terminal rejection rolls back to current server state while transient 409 stays queued", async () => {
  const storage = memory();
  const latest = { ...doc(), revision: 2, state: { ...doc().state, nickname: "다른 기기 변경" } };
  let transient = true;
  let sawFetch = false;
  const sync = new RecordSync({
    storage,
    change() {},
    request: async (path) => {
      if (path === undefined) { sawFetch = true; return latest; }
      const error = Object.assign(new Error("저장 충돌"), { status: 409 });
      if (!transient) Object.assign(error, { code: "record_change_rejected", changeIndex: 0 });
      throw error;
    },
  });
  await sync.open(doc());
  sync.enqueue([{ kind: "reset" }]);
  await assert.rejects(sync.flush(), /저장 충돌/);
  assert.equal(readAccount(storage, sync.doc.scope).queue.length, 1);
  transient = false;
  await sync.flush();
  assert.equal(sawFetch, true);
  assert.equal(sync.doc.state.nickname, "다른 기기 변경");
  assert.equal(readAccount(storage, sync.doc.scope).queue.length, 0);
});
