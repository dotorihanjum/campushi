import {
  initialState,
  normalize,
  enroll,
  leaveDepartment,
  completeCourse,
  savePlay,
  gameOf,
  departmentsOf,
} from "./model.js";
import { loginRequest } from "./login.js";

export const ACCOUNT_PREFIX = "campushi-account-v1:";
export const IMPORT_KEY = "campushi-import-v1";
export const hasGuestRecords = (s) =>
  !!(s.nickname || s.profilePhoto || Object.keys(s.journeys || {}).length);
export function accountView(local, document) {
  const saved = {
    ...document.state,
    journeys: Object.fromEntries(
      Object.entries(document.state.journeys || {}).sort(
        (a, b) => (a[1].enrolledAt || 0) - (b[1].enrolledAt || 0),
      ),
    ),
  };
  // Browsing a department does not require enrollment; an acknowledgement must not change the open screen.
  const current =
    local.current ||
    saved.studying ||
    Object.keys(saved.journeys || {})[0] ||
    null;
  return normalize({
    ...initialState,
    ...saved,
    catalog: local.catalog,
    current,
    onboarded: true,
    introSeen: true,
  });
}
export function readAccount(storage, scope) {
  const queue = [];
  if (!storage) return { scope, queue };
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(ACCOUNT_PREFIX + scope + ":")) continue;
      const value = JSON.parse(storage.getItem(key));
      if (
        value?.scope === scope &&
        value.item?.scope === scope &&
        Array.isArray(value.item.changes)
      )
        queue.push(value.item);
    }
  } catch {
    /* damaged local queue does not become server authority */
  }
  queue.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { scope, queue };
}
export function persistAccount(storage, data) {
  if (!storage) return false;
  try {
    for (const item of data.queue)
      storage.setItem(
        ACCOUNT_PREFIX + data.scope + ":" + item.operation_id,
        JSON.stringify({ scope: data.scope, item }),
      );
    return true;
  } catch {
    return false;
  }
}
export const LOGOUT_SIGNAL = "campushi-account-logout-v1";
export function clearAccountCache(storage, scope) {
  if (!storage) return;
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (
      (!scope && key?.startsWith(ACCOUNT_PREFIX)) ||
      key === ACCOUNT_PREFIX + scope ||
      key?.startsWith(ACCOUNT_PREFIX + scope + ":")
    )
      storage.removeItem(key);
  }
}
export const recordsRequest = (path = "", method = "GET", body) =>
  loginRequest("/me/records" + path, method, body);

export function captureChanges(before, after, meta = {}) {
  if (meta.reset) return [{ kind: "reset" }];
  const changes = [];
  for (const department of Object.keys(after.journeys))
    if (!before.journeys[department])
      changes.push({ kind: "enroll", department });
  for (const department of Object.keys(before.journeys))
    if (!after.journeys[department])
      changes.push({ kind: "leave", department });
  if (meta.completion) changes.push({ kind: "complete", ...meta.completion });
  for (const [field, kind] of [
    ["notes", "note"],
    ["drafts", "draft"],
  ])
    for (const [key, text] of Object.entries(after[field] || {})) {
      if (
        before[field]?.[key] === text ||
        (meta.completion &&
          key === `${meta.completion.department}|${meta.completion.subject}`)
      )
        continue;
      const [department, ...subject] = key.split("|");
      changes.push({ kind, department, subject: subject.join("|"), text });
    }
  if (
    (before.campus !== after.campus ||
      before.studying !== after.studying ||
      changes.some((op) => op.kind === "enroll")) &&
    (!after.studying || after.journeys[after.studying])
  )
    changes.push({
      kind: "preferences",
      campus: after.campus || "khu-global",
      studying: after.studying,
    });
  return changes;
}

export function pendingView(local, doc, queue, preservePlays = false) {
  let view = accountView(local, doc);
  view.plays = preservePlays ? local.plays || {} : {};
  for (const item of queue)
    for (const op of item.changes) {
      if (op.kind === "enroll") view = enroll(view, op.department);
      else if (op.kind === "leave") view = leaveDepartment(view, op.department);
      else if (op.kind === "reset")
        view = {
          ...structuredClone(initialState),
          catalog: local.catalog,
          credits: doc.state.credits,
          creditedAt: doc.state.creditedAt,
          onboarded: true,
          campus: "khu-global",
        };
      else if (op.kind === "complete") {
        const d = departmentsOf(view).find((d) => d.id === op.department);
        if (d)
          view = completeCourse(
            savePlay(
              view,
              op.department,
              op.subject,
              gameOf(d, op.subject),
              "",
              op.score,
            ),
            op.department,
            op.subject,
            op.note,
          );
      } else if (op.kind === "draft" || op.kind === "note") {
        const field = op.kind === "draft" ? "drafts" : "notes";
        view = {
          ...view,
          [field]: {
            ...view[field],
            [`${op.department}|${op.subject}`]: op.text,
          },
        };
      } else if (op.kind === "preferences")
        view = { ...view, campus: op.campus, studying: op.studying };
    }
  return {
    ...view,
    credits: doc.state.credits || 0,
    creditedAt: doc.state.creditedAt || {},
  };
}

export class RecordSync {
  constructor({ storage, request = recordsRequest, change }) {
    this.storage = storage;
    this.request = request;
    this.change = change;
    this.doc = null;
    this.queue = [];
    this.inflight = null;
    this.active = true;
    this.memoryOnly = false;
    this.rejectedRecord = "";
  }
  notify(phase, error = "") {
    if (this.active)
      this.change({
        phase,
        error,
        pending: this.queue.length,
        memoryOnly: this.memoryOnly,
        rejectedRecord: this.rejectedRecord,
        doc: this.doc,
        queue: this.queue,
      });
  }
  persist() {
    this.memoryOnly = !persistAccount(this.storage, {
      scope: this.doc.scope,
      queue: this.queue,
    });
  }
  async open(doc) {
    this.doc = doc;
    this.queue = readAccount(this.storage, doc.scope).queue;
    this.notify(this.queue.length ? "waiting" : "saved");
    if (this.queue.length) await this.flush();
  }
  adopt(saved) {
    if (saved.revision >= this.doc.revision) this.doc = saved;
  }
  enqueue(changes) {
    if (!changes.length) return;
    if (this.isLocked()) {
      this.notify("locking", "다른 창에서 로그아웃을 진행하고 있어요.");
      return false;
    }
    if (!this.active || !this.doc)
      throw new Error("계정 기록을 먼저 불러와 주세요.");
    for (let at = 0; at < changes.length; at += 20)
      this.queue.push({
        operation_id: crypto.randomUUID(),
        order: Date.now() + at,
        scope: this.doc.scope,
        changes: changes.slice(at, at + 20),
      });
    this.persist();
    this.notify("waiting");
  }
  flush() {
    if (this.inflight) return this.inflight;
    this.inflight = this.drain().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }
  removeHead(item) {
    this.queue.shift();
    try {
      this.storage?.removeItem(ACCOUNT_PREFIX + item.scope + ":" + item.operation_id);
    } catch {
      /* The delivery ID still makes any retry of an acknowledged write safe. */
    }
  }
  async drain() {
    if (!this.active) return;
    let needsRefresh = false;
    try {
      while (this.active && (this.queue.length || needsRefresh)) {
        if (!this.queue.length) {
          const latest = await this.request();
          if (!this.active) return;
          this.adoptForAccount(latest);
          needsRefresh = false;
          this.notify(this.queue.length ? "waiting" : "saved");
          continue;
        }
        this.notify("saving");
        const item = this.queue[0];
        let saved;
        try {
          saved = await this.request("/operations", "POST", this.delivery(item));
        } catch (error) {
          if (!this.active) return;
          const index = error.changeIndex;
          if (
            error.code !== "record_change_rejected" ||
            !Number.isInteger(index) ||
            index < 0 ||
            index >= item.changes.length
          ) throw error;

          const subject = item.changes[index].subject;
          const remaining = item.changes.filter((_, i) => i !== index);
          // The server rejected the batch before committing anything. Keep the
          // same delivery ID so a second tab cannot commit the batch twice.
          if (remaining.length) this.queue[0] = { ...item, changes: remaining };
          else this.removeHead(item);
          this.persist();
          // Tell the student why their grade changed: the server refresh below
          // replaces the rejected local record with the saved one.
          this.rejectedRecord = `${subject ? `${subject} 기록을` : "변경 사항을"} 저장하지 못했어요. ${error.message} 저장된 기록으로 되돌렸어요.`;
          needsRefresh = true;
          this.notify(this.queue.length ? "saving" : "saved");
          continue;
        }
        if (!this.active) return;
        this.adoptForAccount(saved);
        this.removeHead(item);
        this.persist();
        needsRefresh = false;
        this.notify(this.queue.length ? "saving" : "saved");
      }
    } catch (error) {
      const expired = error.status === 401 || error.code === "record_account_changed";
      this.notify(expired ? "expired" : "waiting", error.message);
      throw error;
    }
  }
  dismissRejected() {
    this.rejectedRecord = "";
  }
  adoptForAccount(saved) {
    if (saved.scope !== this.doc.scope) {
      const error = new Error("로그인한 계정이 바뀌었어요. 다시 로그인해 주세요.");
      error.code = "record_account_changed";
      throw error;
    }
    this.adopt(saved);
  }
  async refresh() {
    await this.flush();
    let saved;
    try {
      saved = await this.request();
    } catch (error) {
      this.notify(error.status === 401 ? "expired" : "waiting", error.message);
      throw error;
    }
    if (!this.active) return;
    if (saved.scope !== this.doc.scope) {
      this.notify(
        "expired",
        "로그인한 계정이 바뀌었어요. 다시 로그인해 주세요.",
      );
      return;
    }
    this.adopt(saved);
    this.notify(this.queue.length ? "waiting" : "saved");
    if (this.queue.length) await this.flush();
  }
  async saveProfile(nickname, photo) {
    if (this.isLocked())
      throw new Error("다른 창에서 로그아웃을 진행하고 있어요.");
    await this.flush();
    const item = {
      scope: this.doc.scope,
      operation_id: crypto.randomUUID(),
      changes: [
        {
          kind: "profile",
          nickname,
          photo,
          expected: this.doc.state.profileRevision || 0,
        },
      ],
    };
    this.profileDelivery ??= item;
    if (
      JSON.stringify(this.profileDelivery.changes[0]) !==
      JSON.stringify(item.changes[0])
    )
      this.profileDelivery = item;
    try {
      const saved = await this.request(
        "/operations",
        "POST",
        this.profileDelivery,
      );
      if (!this.active || saved.scope !== this.doc.scope)
        throw new Error("계정이 바뀌었어요.");
      this.adopt(saved);
      this.profileDelivery = null;
      this.notify("saved");
    } catch (error) {
      if (error.status === 409) {
        this.profileDelivery = null;
        await this.refresh();
      }
      throw error;
    }
  }
  close() {
    this.active = false;
  }
  delivery(item) {
    return {
      operation_id: item.operation_id,
      scope: item.scope,
      changes: item.changes,
    };
  }
  isLocked() {
    try {
      const lock = JSON.parse(this.storage?.getItem(LOGOUT_SIGNAL) || "{}");
      return (
        lock.scope === this.doc?.scope &&
        lock.phase === "lock" &&
        Date.now() - lock.at < 60000
      );
    } catch {
      return false;
    }
  }
  signal(phase) {
    try {
      this.storage?.setItem(
        LOGOUT_SIGNAL,
        JSON.stringify({ scope: this.doc.scope, at: Date.now(), phase }),
      );
    } catch {
      /* memory-only visit */
    }
  }
  // #36 탈퇴: 서버 계정이 통째로 지워지므로 대기 중인 변경은 보내지 않는다. 다른 창이 새 변경을 더하지 못하게 먼저 잠그고,
  // 서버가 탈퇴를 마친 뒤에만 이 계정의 기기 사본을 지운다. 실패하면 잠금을 풀고 아무것도 지우지 않는다.
  async withdraw(deleteAccount) {
    this.signal("lock");
    try {
      await deleteAccount();
    } catch (error) {
      this.signal("release");
      throw error;
    }
    this.close();
    try {
      clearAccountCache(this.storage, this.doc.scope);
    } catch {
      /* UI is still cleared */
    }
    this.signal("ended");
  }
  async logout(endSession, { discard = false } = {}) {
    this.signal("lock");
    try {
      try {
        await this.flush();
        const knownIds = new Set(this.queue.map((item) => item.operation_id));
        this.queue.push(...readAccount(this.storage, this.doc.scope).queue.filter(
          (item) => !knownIds.has(item.operation_id),
        ));
        if (this.queue.length) await this.flush();
      } catch (error) {
        if (!discard) {
          const warning = new Error(
            "저장되지 않은 기록이 있어요. 그래도 로그아웃할까요?",
          );
          warning.unsaved = true;
          throw warning;
        }
      }
      await endSession();
      this.close();
      try {
        clearAccountCache(this.storage, this.doc.scope);
      } catch {
        /* UI is still cleared */
      }
      this.signal("ended");
    } catch (error) {
      this.signal("release");
      throw error;
    }
  }
}
