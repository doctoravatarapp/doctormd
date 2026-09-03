"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const supportedTypes = new Set(["recovery", "invite"]);

export function RecoveryLinkBridge() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");
    const authError = params.get("error");
    if (!authError && (!type || !supportedTypes.has(type))) return;

    // Remove credentials from the address bar before performing any async work.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    if (authError || !accessToken || !refreshToken) {
      window.location.replace("/login?error=invite");
      return;
    }

    const establishRecoverySession = async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      window.location.replace(error ? "/login?error=invite" : "/set-password");
    };

    void establishRecoverySession();
  }, []);

  return null;
}
