"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SaveProduct({ productId, initiallySaved }: { productId: string; initiallySaved?: boolean }) {
  const [saved, setSaved] = useState<boolean | null>(initiallySaved ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleSaved() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setMessage("Could not verify your account. Please try again.");
      setBusy(false);
      return;
    }
    if (!user) {
      setMessage("Sign in to save products.");
      setBusy(false);
      return;
    }

    const { data: existing, error: lookupError } = await supabase.from("saved_products")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();
    if (lookupError) {
      setMessage("Could not update saved products. Please try again.");
      setBusy(false);
      return;
    }

    const result = existing
      ? await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", productId)
      : await supabase.from("saved_products").insert({ user_id: user.id, product_id: productId });
    if (result.error) {
      setMessage("Could not update saved products. Please try again.");
    } else {
      setSaved(!existing);
      setMessage(existing ? "Removed from saved products." : "Added to saved products.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button className="btn btn-secondary" type="button" onClick={toggleSaved} disabled={busy}>
        {busy ? "Saving…" : saved === true ? "Saved" : saved === false ? "Save product" : "Save to list"}
      </button>
      {message && <small className="muted" role="status" style={{ display: "block", marginTop: 6 }}>{message}</small>}
    </div>
  );
}
