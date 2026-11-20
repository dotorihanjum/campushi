import { useCallback, useEffect, useRef, useState } from "react";
import { authReturn, loginRequest } from "./login.js";

export function useLogin() {
  const [auth, setAuth] = useState(() => ({ loading: true, user: null, providers: [], email: false, pending: false, result: authReturn(location.search).result, error: "" }));
  const epoch = useRef(0);
  const working = useRef(0);
  const refresh = useCallback(async () => {
    if (working.current) return;
    const request = ++epoch.current;
    setAuth((a) => ({ ...a, loading: true, error: "" }));
    try {
      const options = await loginRequest("/auth/options");
      let user = null, pending = false, linkProvider = null, preflight = null;
      if (options.configured || options.providers.length || options.email) {
        try { user = (await loginRequest("/me")).user; } catch (error) { if (error.status !== 401) throw error; }
        if (!user) { const data = await loginRequest("/auth/pending"); pending = data.pending; linkProvider = data.link_provider; preflight = data.preflight; }
      }
      if (request === epoch.current) setAuth((a) => ({ ...a, ...options, loading: false, user, pending, linkProvider, preflight }));
    } catch (error) { if (request === epoch.current) setAuth((a) => ({ ...a, loading: false, error: error.message })); }
  }, []);
  useEffect(() => {
    let active = true;
    refresh();
    const url = new URL(location.href);
    if (url.searchParams.has("auth")) { url.searchParams.delete("auth"); url.searchParams.delete("view"); history.replaceState(history.state, "", url); }
    const onFocus = () => { if (active) refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  const mutate = async (action, update) => {
    working.current++;
    const request = ++epoch.current;
    try { const data = await action(); if (request === epoch.current) update?.(data); return data; }
    finally { working.current--; if (request === epoch.current) setAuth((a) => ({ ...a, loading: false })); }
  };
  return { ...auth, refresh,
    login: (provider, link = false) => mutate(() => loginRequest("/auth/start", "POST", { provider, return_to: "my", link }), ({ url }) => location.assign(url)),
    sendEmail: (email, link = false) => mutate(() => loginRequest("/auth/email", "POST", { email, return_to: "my", link })),
    logout: () => mutate(() => loginRequest("/auth/logout", "POST", {}), () => setAuth((a) => ({ ...a, user: null, pending: false, result: null }))),
    register: (body) => mutate(() => loginRequest("/auth/register", "POST", body), (data) => setAuth((a) => ({ ...a, user: data.user, pending: false, result: "success" }))),
    checkEligibility: (body) => mutate(() => loginRequest("/auth/eligibility", "POST", body), () => setAuth((a) => ({ ...a, preflight: body }))),
    cancel: () => mutate(() => loginRequest("/auth/cancel", "POST", {}), () => setAuth((a) => ({ ...a, pending: false, preflight: null, result: null, linkProvider: null }))),
    clearResult: () => setAuth((a) => ({ ...a, result: null })),
  };
}
