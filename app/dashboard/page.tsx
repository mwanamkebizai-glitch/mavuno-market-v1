import Link from "next/link";
import Nav from "@/components/Nav";
import { getDashboardKind } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type DashboardOrder = {
  id: string;
  status: string;
  total_amount: number | string;
  created_at: string;
  products?: { name?: string } | { name?: string }[] | null;
};

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link className="card dashboard-stat" href={href}>
      <span className="muted">{label}</span>
      <h2>{value.toLocaleString()}</h2>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>;
}

function DashboardError({ children }: { children: React.ReactNode }) {
  return <p className="notice error-notice" role="alert">{children}</p>;
}

function productName(products: DashboardOrder["products"]) {
  return Array.isArray(products) ? products[0]?.name : products?.name;
}

function OrdersList({ orders }: { orders: DashboardOrder[] }) {
  if (!orders.length) return <Empty>No order records yet.</Empty>;
  return (
    <div className="dashboard-list">
      {orders.map((order) => (
        <Link className="card dashboard-row" href={`/orders/${order.id}`} key={order.id}>
          <div>
            <b>{productName(order.products) || "Order"}</b>
            <p className="muted">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="pill">{order.status.replaceAll("_", " ")}</span>
            <p>KSh {Number(order.total_amount).toLocaleString()}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function FarmerDashboard({ userId, fullName }: { userId: string; fullName: string }) {
  const supabase = await createClient();
  const [farms, listings, orders, activities] = await Promise.all([
    supabase.from("farms").select("id,name,farm_type", { count: "exact" })
      .eq("owner_id", userId).order("created_at", { ascending: false }).limit(4),
    supabase.from("products").select("id,name,quantity,unit,status", { count: "exact" })
      .eq("seller_id", userId).eq("status", "active").eq("category", "farm_produce")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("id,status,total_amount,created_at,products(name)", { count: "exact" })
      .eq("seller_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("farm_activities").select("id,activity_type,activity_date,description")
      .eq("owner_id", userId).order("activity_date", { ascending: false }).limit(5),
  ]);
  const failed = [farms, listings, orders, activities].some((result) => result.error);

  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="pill">Farmer workspace</p>
          <h1>Welcome, {fullName || "Farmer"}</h1>
          <p className="muted">Manage your farms, produce and customer orders.</p>
        </div>
        <Link className="btn" href="/farms/new">Add a farm</Link>
      </div>
      {failed ? (
        <DashboardError>We could not load some farmer records. Refresh the page to try again.</DashboardError>
      ) : (
        <>
          <div className="dashboard-grid">
            <Stat label="Farms" value={farms.count ?? 0} href="/farms" />
            <Stat label="Active produce listings" value={listings.count ?? 0} href="/products" />
            <Stat label="Order records" value={orders.count ?? 0} href="/orders" />
          </div>
          <section className="dashboard-section" aria-labelledby="farmer-activity">
            <h2 id="farmer-activity">Recent farm activity</h2>
            {!activities.data?.length ? (
              <Empty>No farm activities recorded yet. Farm activities are listed in Farm management.</Empty>
            ) : (
              <div className="dashboard-list">
                {activities.data.map((activity) => (
                  <article className="card" key={activity.id}>
                    <b>{activity.activity_type}</b>
                    <p>{activity.description || "Activity recorded"}</p>
                    <small className="muted">{activity.activity_date}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="farmer-sales">
            <h2 id="farmer-sales">Recent sales records</h2>
            <p className="muted">These are order values, not confirmation that payment was received.</p>
            <OrdersList orders={orders.data || []} />
          </section>
          <section className="dashboard-section" aria-labelledby="farmer-farms">
            <h2 id="farmer-farms">My farms</h2>
            {!farms.data?.length ? (
              <Empty>No farms yet. Add a farm to start keeping farm records.</Empty>
            ) : (
              <div className="dashboard-list">
                {farms.data.map((farm) => (
                  <Link className="card dashboard-row" href="/farms" key={farm.id}>
                    <b>{farm.name}</b><span className="muted">{farm.farm_type}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="farmer-listings">
            <h2 id="farmer-listings">Active produce listings</h2>
            {!listings.data?.length ? (
              <Empty>No active produce listings yet.</Empty>
            ) : (
              <div className="dashboard-list">
                {listings.data.map((product) => (
                  <Link className="card dashboard-row" href={`/products/${product.id}`} key={product.id}>
                    <b>{product.name}</b>
                    <span className="muted">{product.quantity} {product.unit} available</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

async function SupplierDashboard({ userId, fullName }: { userId: string; fullName: string }) {
  const supabase = await createClient();
  const [products, inventory, orders, movements] = await Promise.all([
    supabase.from("products").select("id,name,status,quantity,unit", { count: "exact" })
      .eq("seller_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("inventory_items").select("id,name,quantity,unit,reorder_level", { count: "exact" })
      .eq("owner_id", userId).order("updated_at", { ascending: false }),
    supabase.from("orders").select("id,status,total_amount,created_at,products(name)", { count: "exact" })
      .eq("seller_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("stock_movements").select("id,movement_type,quantity,created_at,inventory_items(name)")
      .eq("owner_id", userId).order("created_at", { ascending: false }).limit(5),
  ]);
  const failed = [products, inventory, orders, movements].some((result) => result.error);
  const lowStock = (inventory.data || []).filter((item) => Number(item.quantity) <= Number(item.reorder_level || 0));

  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="pill">Agri-Vet Supplier workspace</p>
          <h1>Welcome, {fullName || "Supplier"}</h1>
          <p className="muted">Review your products, stock and customer orders.</p>
        </div>
        <Link className="btn" href="/inventory">Manage inventory</Link>
      </div>
      {failed ? (
        <DashboardError>We could not load some supplier records. Refresh the page to try again.</DashboardError>
      ) : (
        <>
          <div className="dashboard-grid">
            <Stat label="Products" value={products.count ?? 0} href="/products" />
            <Stat label="Inventory items" value={inventory.count ?? 0} href="/inventory" />
            <Stat label="Low-stock alerts" value={lowStock.length} href="/inventory#low-stock" />
            <Stat label="Customer order records" value={orders.count ?? 0} href="/orders" />
          </div>
          <section className="dashboard-section" aria-labelledby="supplier-alerts">
            <h2 id="supplier-alerts">Low-stock alerts</h2>
            {!lowStock.length ? (
              <Empty>No items are at or below their reorder levels.</Empty>
            ) : (
              <div className="dashboard-list">
                {lowStock.slice(0, 5).map((item) => (
                  <Link className="card dashboard-row" href="/inventory" key={item.id}>
                    <b>{item.name}</b>
                    <span>{item.quantity} {item.unit} · reorder at {item.reorder_level}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="supplier-products">
            <h2 id="supplier-products">Recent products</h2>
            {!products.data?.length ? (
              <Empty>No product listings yet.</Empty>
            ) : (
              <div className="dashboard-list">
                {products.data.map((product) => (
                  <Link className="card dashboard-row" href="/products" key={product.id}>
                    <b>{product.name}</b>
                    <span className="muted">{product.status} · {product.quantity} {product.unit}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="supplier-sales">
            <h2 id="supplier-sales">Recent sales records</h2>
            <p className="muted">These are order values, not confirmation that payment was received.</p>
            <OrdersList orders={orders.data || []} />
          </section>
          <section className="dashboard-section" aria-labelledby="supplier-movements">
            <h2 id="supplier-movements">Recent stock movements</h2>
            {!movements.data?.length ? (
              <Empty>No stock movements recorded yet.</Empty>
            ) : (
              <div className="dashboard-list">
                {movements.data.map((movement) => {
                  const item = Array.isArray(movement.inventory_items)
                    ? movement.inventory_items[0]
                    : movement.inventory_items;
                  return (
                    <article className="card dashboard-row" key={movement.id}>
                      <b>{item?.name || "Inventory item"}</b>
                      <span>{movement.movement_type}: {movement.quantity}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

async function BuyerDashboard({ userId, fullName }: { userId: string; fullName: string }) {
  const supabase = await createClient();
  const [orders, saved, marketplace] = await Promise.all([
    supabase.from("orders").select("id,status,total_amount,created_at,products(name)", { count: "exact" })
      .eq("buyer_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("saved_products").select("product_id,created_at,products(id,name,status)", { count: "exact" })
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("products").select("id,name,category,created_at", { count: "exact" })
      .eq("status", "active").order("created_at", { ascending: false }).limit(5),
  ]);
  const failed = [orders, saved, marketplace].some((result) => result.error);

  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="pill">Buyer workspace</p>
          <h1>Welcome, {fullName || "Buyer"}</h1>
          <p className="muted">Track your orders and discover products from the marketplace.</p>
        </div>
        <Link className="btn" href="/marketplace">Browse marketplace</Link>
      </div>
      {failed ? (
        <DashboardError>We could not load some buyer records. Refresh the page to try again.</DashboardError>
      ) : (
        <>
          <div className="dashboard-grid">
            <Stat label="My orders" value={orders.count ?? 0} href="/orders" />
            <Stat label="Saved products" value={saved.count ?? 0} href="/saved-products" />
            <Stat label="Active marketplace listings" value={marketplace.count ?? 0} href="/marketplace" />
          </div>
          <section className="dashboard-section" aria-labelledby="buyer-orders">
            <h2 id="buyer-orders">Recent orders</h2>
            <OrdersList orders={orders.data || []} />
          </section>
          <section className="dashboard-section" aria-labelledby="buyer-saved">
            <h2 id="buyer-saved">Saved products</h2>
            {!saved.data?.length ? (
              <Empty>No saved products yet. Save a marketplace listing to find it here.</Empty>
            ) : (
              <div className="dashboard-list">
                {saved.data.map((item) => {
                  const product = Array.isArray(item.products) ? item.products[0] : item.products;
                  return (
                    <Link className="card dashboard-row" href={`/products/${item.product_id}`} key={item.product_id}>
                      <b>{product?.name || "Saved listing"}</b>
                      <span className="muted">{product?.status || "No longer available"}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="buyer-marketplace">
            <h2 id="buyer-marketplace">Recently listed</h2>
            {!marketplace.data?.length ? (
              <Empty>No active marketplace listings are available right now.</Empty>
            ) : (
              <div className="dashboard-list">
                {marketplace.data.map((product) => (
                  <Link className="card dashboard-row" href={`/products/${product.id}`} key={product.id}>
                    <b>{product.name}</b><span className="muted">{product.category}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    return <main className="container" style={{ padding: 32 }}><DashboardError>Unable to verify your sign-in. Refresh the page or sign in again.</DashboardError></main>;
  }
  if (!user) {
    return <main className="container" style={{ padding: 32 }}>Please <Link href="/login">sign in</Link> to open your dashboard.</main>;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return (
      <>
        <Nav role={null} />
        <main className="container" style={{ padding: 32 }}>
          <DashboardError>Your account role could not be verified. No role dashboard is available until your profile can be loaded.</DashboardError>
        </main>
      </>
    );
  }

  const kind = getDashboardKind(profile.role);
  return (
    <>
      <Nav role={profile.role} />
      <main className="container" style={{ padding: "30px 0" }}>
        {kind === "farmer" && <FarmerDashboard userId={user.id} fullName={profile.full_name} />}
        {kind === "supplier" && <SupplierDashboard userId={user.id} fullName={profile.full_name} />}
        {kind === "buyer" && <BuyerDashboard userId={user.id} fullName={profile.full_name} />}
        {kind === "admin" && (
          <section className="card">
            <p className="pill">Administrator workspace</p>
            <h1>Administration</h1>
            <p className="muted">Administrative tools are available only to owner-provisioned administrator accounts.</p>
            <Link className="btn" href="/admin">Open administration</Link>
          </section>
        )}
        {kind === "unknown" && (
          <DashboardError>Your account role is not recognized. Contact the project owner; a buyer or administrator role will not be assumed.</DashboardError>
        )}
      </main>
    </>
  );
}
