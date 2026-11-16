"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes("email not confirmed")) {
          setError("Confirm your email address before signing in. Check your inbox and spam folder.");
        } else if (message.includes("invalid login credentials")) {
          setError("Email or password is incorrect. If you just registered, confirm your email first.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      router.push("/dashboard");
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Unable to contact the sign-in service. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 480, padding: 50 }}>
      <div className="card">
        <h1>Sign in</h1>
        <form onSubmit={signIn} style={{ display: "grid", gap: 12 }}>
          <input
            className="field"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p>
          Need an account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </main>
  );
}