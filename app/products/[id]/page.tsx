import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AddToCart from "@/components/AddToCart";
import SaveProduct from "@/components/SaveProduct";

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  return (
    <>
      <Nav />
      <main className="container" style={{ padding: "30px 0", maxWidth: 760 }}>
        {error ? (
          <p className="notice error-notice" role="alert">Product details could not be loaded. Please try again.</p>
        ) : !product ? (
          <section className="card"><h1>Product not found</h1><Link href="/marketplace">Return to marketplace</Link></section>
        ) : (
          <article className="card">
            <span className="pill">{product.category}</span>
            <h1>{product.name}</h1>
            <p>{product.description || "No description provided."}</p>
            <h2>KSh {product.price} / {product.unit}</h2>
            <p>Available: {product.quantity} · {product.location}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <AddToCart product={{
                id: product.id,
                product_id: product.id,
                name: product.name,
                price: Number(product.price),
                quantity: 1,
                unit: product.unit,
                seller_id: product.seller_id,
              }} />
              <SaveProduct productId={product.id} />
            </div>
            <p style={{ marginTop: 12 }}><Link href="/cart">View cart / checkout</Link></p>
          </article>
        )}
      </main>
    </>
  );
}