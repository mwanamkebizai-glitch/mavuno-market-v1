import Link from "next/link";
import Nav from "@/components/Nav";
import SaveProduct from "@/components/SaveProduct";
import { createClient } from "@/lib/supabase/server";

export default async function SavedProducts() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return <main className="container" style={{ padding: 32 }}><p className="notice error-notice" role="alert">Unable to verify your sign-in. Refresh the page or sign in again.</p></main>;
  }
  if (!user) {
    return <main className="container" style={{ padding: 32 }}>Please <Link href="/login">sign in</Link> to view saved products.</main>;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return <main className="container" style={{ padding: 32 }}><p className="notice error-notice" role="alert">Your account could not be verified.</p></main>;
  }

  const buyerRoles = ["buyer_individual", "buyer_business", "buyer_institution"];
  if (!profile || !buyerRoles.includes(profile.role)) {
    return (
      <>
        <Nav role={profile?.role ?? null} />
        <main className="container" style={{ padding: 32 }}>
          <section className="card"><h1>Saved products</h1><p className="muted">Saved products are available to buyer accounts.</p></section>
        </main>
      </>
    );
  }

  const { data, error } = await supabase.from("saved_products")
    .select("product_id,created_at,products(id,name,category,price,unit,status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Nav role={profile.role} />
      <main className="container" style={{ padding: "30px 0" }}>
        <h1>Saved products</h1>
        <p className="muted">Your saved listings are private to your account.</p>
        {error ? (
          <p className="notice error-notice" role="alert">Could not load saved products. Refresh the page to try again.</p>
        ) : !data?.length ? (
          <section className="card">
            <p>You have no saved products yet.</p>
            <Link className="btn" href="/marketplace">Browse marketplace</Link>
          </section>
        ) : (
          <div className="dashboard-list">
            {data.map((item) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              return (
                <article className="card dashboard-row" key={item.product_id}>
                  <div>
                    <Link href={`/products/${item.product_id}`}><b>{product?.name || "Saved listing"}</b></Link>
                    <p className="muted">
                      {product
                        ? `${product.category} · KSh ${product.price} / ${product.unit} · ${product.status}`
                        : "This listing is no longer available."}
                    </p>
                  </div>
                  <SaveProduct productId={item.product_id} initiallySaved />
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
