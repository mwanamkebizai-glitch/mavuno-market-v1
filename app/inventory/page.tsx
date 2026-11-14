import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import InventoryManager from "@/components/InventoryManager";

export default async function Inventory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <main className="container" style={{ padding: 40 }}>Sign in required.</main>;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const canManageInventory = profile?.role === "farmer" || profile?.role === "supplier";
  const { data } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <Nav />
      <main className="container" style={{ padding: "30px 0" }}>
        <h1>Inventory &amp; warehouses</h1>
        <p className="muted">Stock adjustments are recorded in an auditable movement ledger. Negative stock is rejected.</p>
        {profileError ? (
          <p role="alert">Could not verify your account role. Inventory controls are unavailable.</p>
        ) : (
          <InventoryManager canManageInventory={canManageInventory} />
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {(data || []).map((item) => (
            <div className="card" key={item.id}>
              <b>{item.name}</b>
              <p>{item.quantity} {item.unit} · Reorder at {item.reorder_level} · {item.location_name || "No location assigned"}</p>
              <p className="muted">Expiry: {item.expiry_date || "Not specified"} · Item ID: {item.id}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
