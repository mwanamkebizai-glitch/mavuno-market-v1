import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function Products() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return <main className="container" style={{ padding: 32 }}><p role="alert">Unable to verify your sign-in.</p></main>;
  }
  if (!user) {
    return <main className="container" style={{ padding: 32 }}>Please <Link href="/login">sign in</Link> to manage product listings.</main>;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return <main className="container" style={{ padding: 32 }}><p className="notice error-notice" role="alert">Your account role could not be verified.</p></main>;
  }
  if (profile?.role !== "farmer" && profile?.role !== "supplier") {
    return (
      <>
        <Nav role={profile?.role ?? null} />
        <main className="container" style={{ padding: 32 }}>
          <section className="card"><h1>My listings</h1><p className="muted">Product management is available to Farmer and Agri-Vet Supplier accounts.</p></section>
        </main>
      </>
    );
  }

  const { data, error } = await supabase.from("products")
    .select("id,name,category,quantity,unit,price,status,updated_at")
    .eq("seller_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <Nav role={profile.role} />
      <main className="container" style={{ padding: "30px 0" }}>
        <div className="dashboard-heading">
          <div><p className="pill">{profile.role === "supplier" ? "Agri-Vet Supplier workspace" : "Farmer workspace"}</p><h1>My listings</h1></div>
          <Link className="btn" href="/products/new">Add product</Link>
        </div>
        {error ? (
          <p className="notice error-notice" role="alert">Product listings could not be loaded. Please try again.</p>
        ) : !data?.length ? (
          <section className="card"><p className="muted">No product listings yet.</p><Link className="btn" href="/products/new">Create your first listing</Link></section>
        ) : (
          <div className="dashboard-list">
            {data.map((product) => (
              <article className="card dashboard-row" key={product.id}>
                <div>
                  <Link href={`/products/${product.id}`}><b>{product.name}</b></Link>
                  <p className="muted">{product.category} · {product.quantity} {product.unit} · KSh {product.price}</p>
                </div>
                <span className="pill">{product.status}</span>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
