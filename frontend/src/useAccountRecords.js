import { useCallback, useEffect, useRef, useState } from "react";
import { initialState, STORAGE_KEY } from "./model.js";
import {
  captureChanges,
  hasGuestRecords,
  IMPORT_KEY,
  pendingView,
  RecordSync,
  recordsRequest,
  LOGOUT_SIGNAL,
  ACCOUNT_PREFIX,
  clearAccountCache,
} from "./accountRecords.js";

export function useAccountRecords(
  auth,
  state,
  setState,
  storage,
  catalogReady,
) {
  const context = useRef(null),
    engine = useRef(null),
    local = useRef(state),
    guest = useRef(state),
    generation = useRef(0);
  local.current = state;
  const loadedUser = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState({
    phase: "checking",
    error: "",
    pending: 0,
    importAvailable: false,
  });
  const display = useCallback(
    (s) => {
      local.current = s;
      setState(s);
    },
    [setState],
  );
  useEffect(() => {
    if (auth.loading || !catalogReady) return;
    const request = ++generation.current;
    if (!auth.user) {
      if (context.current) {
        engine.current?.close();
        context.current = null;
        display({
          ...structuredClone(initialState),
          catalog: local.current.catalog,
        });
      }
      setStatus((s) => ({
        phase: "guest",
        error: "",
        pending: 0,
        importAvailable: false,
        loggedOutAt: s.loggedOutAt,
      }));
      return;
    }
    setStatus({ phase: "loading", error: "", pending: 0, importAvailable: false });
    let sync;
    const change = ({ doc, queue, ...next }) => {
      if (request !== generation.current) return;
      const sameScope = context.current?.scope === doc.scope;
      context.current = doc;
      display(pendingView(local.current, doc, queue, sameScope));
      setStatus((s) => ({
        ...s,
        ...next,
        importAvailable: hasGuestRecords(guest.current),
      }));
    };
    recordsRequest()
      .then(async (doc) => {
        if (request !== generation.current) return;
        loadedUser.current = auth.user;
        sync = new RecordSync({ storage, change });
        engine.current = sync;
        await sync.open(doc);
      })
      .catch((error) => {
        if (request === generation.current)
          setStatus((s) => ({ ...s, phase: "error", error: error.message }));
      });
    return () => {
      generation.current++;
      sync?.close();
    };
  }, [auth.loading, auth.user, catalogReady, display, storage, retryCount]);
  useEffect(() => {
    const retry = () =>
      engine.current?.active && engine.current.refresh().catch(() => {});
    const onStorage = (event) => {
      if (event.key !== LOGOUT_SIGNAL) return;
      let signal;
      try {
        signal = JSON.parse(event.newValue || "{}");
      } catch {
        return;
      }
      if (engine.current?.doc?.scope !== signal.scope) return;
      if (signal.phase === "lock") {
        setStatus((s) => ({
          ...s,
          phase: "locking",
          error: "다른 창에서 로그아웃을 진행하고 있어요.",
        }));
        return;
      }
      if (signal.phase === "release") {
        setStatus((s) => ({ ...s, phase: "saved", error: "" }));
        return;
      }
      engine.current.close();
      context.current = null;
      display({
        ...structuredClone(initialState),
        catalog: local.current.catalog,
      });
      setStatus((s) => ({ ...s, phase: "checking", loggedOutAt: Date.now() }));
      auth.refresh();
    };
    const onUnload = (event) => {
      if (engine.current?.active && engine.current.queue.length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onUnload);
    const timer = window.setInterval(retry, 30000);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [display]);
  const update = useCallback(
    (value, meta) => {
      const before = local.current,
        after = typeof value === "function" ? value(before) : value;
      if (auth.user) {
        const sync = engine.current;
        if (!sync?.active) return;
        const changes = captureChanges(before, after, meta);
        if (sync.enqueue(changes) === false) return;
        display({
          ...after,
          credits: sync.doc.state.credits || 0,
          creditedAt: sync.doc.state.creditedAt || {},
        });
        if (changes.length) sync.flush().catch(() => {});
      } else {
        guest.current = after;
        display(after);
      }
    },
    [auth.user, display],
  );
  const importGuest = useCallback(async () => {
    const sync = engine.current;
    if (!sync?.active) throw new Error("계정 기록을 먼저 불러와 주세요.");
    if (sync.isLocked())
      throw new Error("다른 창에서 로그아웃을 진행하고 있어요.");
    setStatus((s) => ({ ...s, importing: true, importedDepartmentCount: null }));
    try {
      await sync.flush();
      let operation_id;
      try {
        operation_id = storage?.getItem(IMPORT_KEY);
      } catch {
        /* memory-only visit */
      }
      operation_id ||= crypto.randomUUID();
      try {
        storage?.setItem(IMPORT_KEY, operation_id);
      } catch {
        /* no durable guest storage */
      }
      const saved = await recordsRequest("/import", "POST", {
        scope: sync.doc.scope,
        operation_id,
        state: guest.current,
      });
      if (!sync.active) return;
      sync.adopt(saved);
      guest.current = structuredClone(initialState);
      try {
        storage?.removeItem(STORAGE_KEY);
        storage?.removeItem(IMPORT_KEY);
      } catch {
        /* local storage is blocked */
      }
      display(pendingView(local.current, sync.doc, sync.queue, true));
      context.current = sync.doc;
      setStatus((s) => ({
        ...s,
        phase: "saved",
        error: "",
        importAvailable: false,
        importedDepartmentCount: saved.imported_department_count,
      }));
    } finally {
      if (sync.active) setStatus((s) => ({ ...s, importing: false }));
    }
  }, [display, storage]);
  const logout = async (options) => {
    const sync = engine.current;
    if (sync?.active) await sync.logout(auth.logout, options);
    else {
      let hasPending = false;
      try {
        for (let i = 0; storage && i < storage.length; i++)
          if (storage.key(i)?.startsWith(ACCOUNT_PREFIX)) hasPending = true;
      } catch {
        /* storage may be inaccessible */
      }
      if (hasPending && !options?.discard) {
        const warning = new Error(
          "저장되지 않은 기록이 있어요. 그래도 로그아웃할까요?",
        );
        warning.unsaved = true;
        throw warning;
      }
      await auth.logout();
      try {
        clearAccountCache(storage);
      } catch {
        /* UI still clears */
      }
    }
    signedOut();
  };
  // 로그아웃·탈퇴 공통: 계정 사본·프로필·화면 스택을 비운다. 아직 옮기지 않은 게스트 원본(STORAGE_KEY)은 남긴다.
  const signedOut = (extra) => {
    context.current = null;
    try {
      sessionStorage.removeItem("campushi-stack-v2");
    } catch {
      /* storage may be blocked */
    }
    display({
      ...structuredClone(initialState),
      catalog: local.current.catalog,
    });
    setStatus({
      phase: "guest",
      error: "",
      pending: 0,
      importAvailable: false,
      loggedOutAt: Date.now(),
      ...extra,
    });
  };
  const withdraw = async () => {
    const sync = engine.current;
    if (sync?.active) await sync.withdraw(auth.withdraw);
    else {
      // 계정 기록을 불러오지 못한 상태에서도 탈퇴할 수 있다. 서버가 지운 뒤에만 이 기기의 모든 계정 사본을 지운다.
      await auth.withdraw();
      try {
        clearAccountCache(storage);
      } catch {
        /* UI still clears */
      }
    }
    signedOut({ withdrawnAt: Date.now() });
  };
  return {
    ...status,
    loadedUser: loadedUser.current,
    context,
    engine,
    importGuest,
    update,
    logout,
    withdraw,
    preserveGuest: hasGuestRecords(guest.current) && !!status.loggedOutAt,
    retry: () =>
      engine.current?.active
        ? engine.current.refresh()
        : setRetryCount((n) => n + 1),
    saveProfile: (name, photo) => engine.current.saveProfile(name, photo),
    dismissRejected: () => {
      engine.current?.dismissRejected();
      setStatus((s) => ({ ...s, rejectedRecord: "" }));
    },
  };
}
