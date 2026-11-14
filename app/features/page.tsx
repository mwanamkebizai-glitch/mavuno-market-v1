import Nav from "@/components/Nav";
import Link from "next/link";
const groups=[
 ["Farmer workspace","My farms","/farms","Manage multiple farms, farm activities, crop calendars, machinery, inventory and workers."],
 ["Supplier workspace","Inventory & warehouses","/inventory","Track stock, stock movements, expiry dates and multiple shop or warehouse locations."],
 ["Buyer workspace","Shopping cart","/cart","Build a multi-product, multi-seller cart and submit separate seller orders in one checkout."],
 ["Transactions","Receipts & payments","/receipts","Generate PDF transaction records, report direct payments, reversals and refund requests."],
 ["Communication","Messages","/messages","Communicate with buyers and sellers and view platform notifications."],
 ["Fulfilment","Delivery & collection","/delivery","Manage delivery addresses, collection, dispatch and order fulfilment."],
 ["Trust","Verification & reviews","/verification","Submit verification details and review completed transactions."],
 ["Insights","Reports & analytics","/reports","View sales, purchases, stock and farm reports."],
 ["Administration","Admin dashboard","/admin","Manage users, listings, verification, disputes, reports and platform activity."]
];
export default function Features(){return <><Nav/><main className="container" style={{padding:"32px 0"}}><h1>Version 1 workspace</h1><p className="muted">Access the main modules of Mavuno Market.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14,marginTop:22}}>{groups.map(([tag,title,url,desc])=><div className="card" key={url}><span className="pill">{tag}</span><h2>{title}</h2><p className="muted">{desc}</p><Link className="btn btn-secondary" href={url}>Open module</Link></div>)}</div></main></>}
