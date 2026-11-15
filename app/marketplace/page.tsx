import Link from "next/link";
import Nav from "@/components/Nav";
import AddToCart from "@/components/AddToCart";
import SaveProduct from "@/components/SaveProduct";
import { createClient } from "@/lib/supabase/server";

type MarketplaceParams = { q?: string; category?: string };

export default async function Marketplace({ searchParams }: { searchParams: Promise<MarketplaceParams> }) {
  const { q: search, category } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("products")
    .select("id,name,description,category,price,quantity,unit,location,seller_id")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
  if (category === "farm_produce") query = query.eq("category", "farm_produce");
  if (category === "agri_vet") query = query.in("category", ["seeds", "fertiliser", "animal_feed", "equipment", "crop_protection"]);

  const { data, error } = await query;
  const categoryLabel = category === "farm_produce"
    ? "Farmers' produce"
    : category === "agri_vet" ? "Agri-Vet supplies" : "All listings";

  return (
    <>
      <Nav />
      <main className="container" style={{ padding: "30px 0" }}>
        <div className="dashboard-heading">
          <div>
            <p className="pill">Mavuno Market</p>
            <h1>Marketplace</h1>
            <p className="muted">{categoryLabel} · Product prices and stock are rechecked at checkout.</p>
          </div>
          <Link className="btn btn-secondary" href="/cart">View cart</Link>
        </div>
        <form action="/marketplace" method="get" className="card marketplace-filter">
          <label>
            Product group
            <select className="field" name="category" defaultValue={category || ""}>
              <option value="">All listings</option>
              <option value="farm_produce">Farmers' produce</option>
              <option value="agri_vet">Agri-Vet supplies</option>
            </select>
          </label>
          <label>
            Search by product name
            <input className="field" name="q" placeholder="Search products" defaultValue={search} />
          </label>
          <button className="btn" type="submit" style={{ alignSelf: "end" }}>Search</button>
        </form>

        {error ? (
          <p className="notice error-notice" role="alert" style={{ marginTop: 16 }}>Marketplace listings could not be loaded. Please refresh the page.</p>
        ) : !data?.length ? (
          <section className="card" style={{ marginTop: 16 }}>
            <h2>No listings found</h2>
            <p className="muted">Try another search or product group.</p>
          </section>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, marginTop: 18 }}>
            {data.map((product) => (
              <article className="card" key={product.id}>
                <span className="pill">{product.category}</span>
                <h2>{product.name}</h2>
                <p>{product.description || "No description provided."}</p>
                <b>KSh {product.price} / {product.unit}</b>
                <p className="muted">Available: {product.quantity} · {product.location}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <Link className="btn btn-secondary" href={`/products/${product.id}`}>View</Link>
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
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
