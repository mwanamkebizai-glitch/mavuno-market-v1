"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRoleNavigation } from "@/lib/roles";
import { createClient } from "@/lib/supabase/client";

type NavigationState = "loading" | "guest" | "ready" | "error";

export default function Nav({ role: providedRole }: { role?: string | null } = {}) {
  const [role, setRole] = useState<string | null>(providedRole ?? null);
  const [state, setState] = useState<NavigationState>(providedRole === undefined ? "loading" : "ready");

  useEffect(() => {
    if (providedRole !== undefined) {
      setRole(providedRole);
      setState("ready");
      return;
    }

    let active = true;
    async function loadRole() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError) {
        setState("error");
        return;
      }
      if (!user) {
        setState("guest");
        return;
      }

      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (profileError || !profile) {
        setState("error");
        return;
      }
      setRole(profile.role);
      setState("ready");
    }

    void loadRole();
    return () => { active = false; };
  }, [providedRole]);

  const links = state === "ready" ? getRoleNavigation(role) : [];

  return (
    <header className="site-header">
      <div className="container site-nav-row">
        <Link className="brand" href="/">🌱 MAVUNO MARKET</Link>
        {state === "ready" ? (
          <>
            <details className="role-menu">
              <summary>Menu</summary>
              <nav className="role-menu-links" aria-label="Account navigation">
                <Link href="/dashboard">Dashboard</Link>
                {links.map((link) => (
                  <Link href={link.href} key={`${link.label}:${link.href}`}>{link.label}</Link>
                ))}
                <Link href="/profile">My profile</Link>
              </nav>
            </details>
            <Link className="btn btn-secondary account-link" href="/profile">My account</Link>
          </>
        ) : state === "guest" ? (
          <nav className="guest-nav" aria-label="Public navigation">
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/login">Sign in</Link>
            <Link className="btn btn-secondary" href="/signup">Create account</Link>
          </nav>
        ) : state === "error" ? (
          <span className="muted" role="status">Navigation could not be verified.</span>
        ) : (
          <span className="muted" role="status">Loading menu…</span>
        )}
      </div>
    </header>
  );
}
