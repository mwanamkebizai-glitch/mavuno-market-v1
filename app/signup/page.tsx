"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("farmer");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get(
      "role",
    );
    const selectableRoles = [
      "farmer",
      "supplier",
      "buyer_individual",
      "buyer_business",
      "buyer_institution",
    ];
    if (requestedRole && selectableRoles.includes(requestedRole)) {
      setRole(requestedRole);
    }
  }, []);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const { error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name, phone: phone.trim(), role } },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Account created. If email confirmation is enabled, confirm your address before signing in. Check your inbox and spam folder.",
        );
      }
    } catch (registrationError) {
      setMessage(
        registrationError instanceof Error
          ? registrationError.message
          : "Unable to contact the registration service. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 540, padding: 40 }}>
      <div className="card">
        <h1>Create account</h1>
        <form onSubmit={register} style={{ display: "grid", gap: 12 }}>
          <input
            className="field"
            placeholder="Full name / representative"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="field"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="field"
            placeholder="Phone"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <select
            className="field"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="farmer">Farmer</option>
            <option value="supplier">Agri-Vet supplier</option>
            <option value="buyer_individual">Individual buyer</option>
            <option value="buyer_business">Business buyer</option>
            <option value="buyer_institution">Institutional buyer</option>
          </select>
          <input
            className="field"
            type="password"
            minLength={8}
            placeholder="Password (8+ characters)"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Registering..." : "Register"}
          </button>
          {message && <p role="status">{message}</p>}
        </form>
        <p>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
