"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("farmer");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

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
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name, phone, role } },
    });
    setMessage(
      error?.message ||
        "Account created. Check your email if confirmation is enabled.",
    );
  }

  return (
    <main className="container" style={{ maxWidth: 540, padding: 40 }}>
      <div className="card">
        <h1>Create account</h1>
        <form onSubmit={register} style={{ display: "grid", gap: 12 }}>
          <input
            className="field"
            placeholder="Full name / representative"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="field"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="field"
            placeholder="Phone"
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="btn">Register</button>
          {message}
        </form>
      </div>
    </main>
  );
}
