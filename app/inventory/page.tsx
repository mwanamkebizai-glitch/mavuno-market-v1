import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import InventoryManager from "@/components/InventoryManager";

export default async function Inventory() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return <main className="container" style={{ padding: 32 }}><p role="alert">Unable to verify your sign-in.</p></main>;
  }
  if (!user) {
    return <main className="container" style={{ padding: 32 }}>Please <Link href="/login">sign in</Link> to view inventory.</main>;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return <main className="container" style={{ padding: 32 }}><p className="notice error-notice" role="alert">Your account role could not be verified.</p></main>;
  }

  const canManageInventory = profile?.role === "farmer" || profile?.role === "supplier";
  if (!canManageInventory) {
    return (
      <>
        <Nav role={profile?.role ?? null} />
        <main className="container" style={{ padding: 32 }}>
          <section className="card"><h1>Inventory</h1><p className="muted">Inventory management is available to Farmer and Agri-Vet Supplier accounts.</p></section>
        </main>
      </>
    );
  }

  const [items, locations, movements] = await Promise.all([
    supabase.from("inventory_items")
      .select("id,name,quantity,unit,reorder_level,expiry_date,location_name")
      .eq("owner_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("inventory_locations")
      .select("id,name,location_text,county,sub_county")
      .eq("owner_id", user.id).order("name", { ascending: true }),
    supabase.from("stock_movements")
      .select("id,movement_type,quantity,notes,created_at,inventory_items(name)")
      .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const lowStock = (items.data || []).filter((item) => Number(item.quantity) <= Number(item.reorder_level || 0));

  return (
    <>
      <Nav role={profile.role} />
      <main className="container" style={{ padding: "30px 0" }}>
        <p className="pill">{profile.role === "supplier" ? "Agri-Vet Supplier workspace" : "Farmer workspace"}</p>
        <h1>Inventory &amp; stock locations</h1>
        <p className="muted">Stock movements are recorded in an auditable ledger. Negative stock is rejected.</p>
        <InventoryManager canManageInventory />

        <section className="dashboard-section" id="low-stock">
          <h2>Low-stock alerts</h2>
          {items.error ? (
            <p className="notice error-notice" role="alert">Inventory levels could not be loaded.</p>
          ) : !lowStock.length ? (
            <p className="muted">No items are at or below their reorder levels.</p>
          ) : (
            <div className="dashboard-list">
              {lowStock.map((item) => (
                <article className="card dashboard-row" key={item.id}>
                  <b>{item.name}</b>
                  <span>{item.quantity} {item.unit} · reorder at {item.reorder_level}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="items">
          <h2>Inventory items</h2>
          {items.error ? (
            <p className="notice error-notice" role="alert">Inventory items could not be loaded.</p>
          ) : !items.data?.length ? (
            <p className="muted">No inventory items yet. Use Add inventory item to create one.</p>
          ) : (
            <div className="dashboard-list">
              {items.data.map((item) => (
                <article className="card" key={item.id}>
                  <b>{item.name}</b>
                  <p>{item.quantity} {item.unit} · Reorder at {item.reorder_level} · {item.location_name || "No location assigned"}</p>
                  <p className="muted">Expiry: {item.expiry_date || "Not specified"} · Item ID: {item.id}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="locations">
          <h2>Stock locations</h2>
          {locations.error ? (
            <p className="notice error-notice" role="alert">Stock locations could not be loaded.</p>
          ) : !locations.data?.length ? (
            <p className="muted">No stock locations recorded yet.</p>
          ) : (
            <div className="dashboard-list">
              {locations.data.map((location) => (
                <article className="card" key={location.id}>
                  <b>{location.name}</b>
                  <p>{location.location_text}</p>
                  <p className="muted">{[location.sub_county, location.county].filter(Boolean).join(", ")}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section" id="movements">
          <h2>Recent stock movements</h2>
          {movements.error ? (
            <p className="notice error-notice" role="alert">Stock movements could not be loaded.</p>
          ) : !movements.data?.length ? (
            <p className="muted">No stock movements recorded yet.</p>
          ) : (
            <div className="dashboard-list">
              {movements.data.map((movement) => {
                const item = Array.isArray(movement.inventory_items)
                  ? movement.inventory_items[0]
                  : movement.inventory_items;
                return (
                  <article className="card dashboard-row" key={movement.id}>
                    <div><b>{item?.name || "Inventory item"}</b><p className="muted">{movement.notes || movement.movement_type}</p></div>
                    <span>{movement.quantity} · {new Date(movement.created_at).toLocaleDateString()}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
