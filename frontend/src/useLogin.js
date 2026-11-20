import { useCallback, useEffect, useState } from "react";
import { authReturn, loginRequest } from "./login.js";

export function useLogin() {
  const [auth, setAuth] = useState(() => ({ loading: true, user: null, providers: [], email: false, pending: false, result: authReturn(location.search).result, error: "" }));
  const refresh = useCallback(async () => {
    setAuth((a) => ({ ...a, loading: true, error: "" }));
    try {
      const options = await loginRequest("/auth/options");
      let user = null, pending = false, linkProvider = null;
      if (options.providers.length || options.email) {
        try { user = (await loginRequest("/me")).user; } catch (error) { if (error.status !== 401) throw error; }
        if (!user) { const data = await loginRequest("/auth/pending"); pending = data.pending; linkProvider = data.link_provider; }
      }
      setAuth((a) => ({ ...a, ...options, loading: false, user, pending, linkProvider }));
    } catch (error) { setAuth((a) => ({ ...a, loading: false, error: error.message })); }
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
  return { ...auth, refresh,
    login: async (provider, link = false) => { const { url } = await loginRequest("/auth/start", "POST", { provider, return_to: "my", link }); location.assign(url); },
    sendEmail: (email, link = false) => loginRequest("/auth/email", "POST", { email, return_to: "my", link }),
    logout: async () => { await loginRequest("/auth/logout", "POST", {}); setAuth((a) => ({ ...a, user: null, pending: false, result: null })); },
    clearResult: () => setAuth((a) => ({ ...a, result: null })),
  };
}
