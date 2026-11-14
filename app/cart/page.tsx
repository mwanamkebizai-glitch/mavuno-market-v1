"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import {createClient} from "@/lib/supabase/client";
import type {CartLine} from "@/components/AddToCart";
export default function Cart(){
 const [items,setItems]=useState<CartLine[]>([]); const [method,setMethod]=useState("collection");
 const [address,setAddress]=useState(""); const [point,setPoint]=useState(""); const [note,setNote]=useState("");
 const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 useEffect(()=>{try{const parsed=JSON.parse(localStorage.getItem("mavuno_cart")||"[]");setItems(Array.isArray(parsed)?parsed:[]);}catch{setItems([]);}},[]);
 function persist(next:CartLine[]){setItems(next);localStorage.setItem("mavuno_cart",JSON.stringify(next));}
 const total=useMemo(()=>items.reduce((a,b)=>a+Number(b.price)*Number(b.quantity),0),[items]);
 const sellerCount=new Set(items.map(i=>i.seller_id)).size;
 async function checkout(){setBusy(true);setMessage("");try{
   const s=createClient(); const {data:{user},error:authError}=await s.auth.getUser();
   if(authError||!user){setMessage("Please sign in before checkout.");return;}
   const payload=items.map(i=>({product_id:i.product_id,quantity:Number(i.quantity)}));
   const {data,error}=await s.rpc("checkout_cart",{p_items:payload,p_fulfilment_method:method,p_delivery_address:method==="delivery"?address:null,p_collection_point:method==="collection"?point:null,p_buyer_note:note||null});
   if(error)throw error;
   localStorage.removeItem("mavuno_cart");setItems([]);
   const ids=(data||[]).map((x:{order_id:string})=>x.order_id);
   window.location.href=ids.length===1?`/orders/${ids[0]}`:"/orders?checkout=success";
 }catch(e){setMessage(e instanceof Error?e.message:"Checkout failed. Please try again.");}finally{setBusy(false);}}
 return <><Nav/><main className="container" style={{padding:"30px 0",maxWidth:850}}><h1>Shopping cart</h1>
 {items.length===0?<div className="card"><p>Your cart is empty.</p><Link href="/marketplace">Explore marketplace</Link></div>:<>
 {items.map(i=><div className="card" key={i.product_id} style={{marginBottom:10,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><b>{i.name}</b><p>KSh {Number(i.price).toLocaleString()} / {i.unit}</p></div><input aria-label={`Quantity for ${i.name}`} className="field" style={{maxWidth:90}} type="number" min="1" step="any" value={i.quantity} onChange={e=>persist(items.map(x=>x.product_id===i.product_id?{...x,quantity:Math.max(1,Number(e.target.value)||1)}:x))}/><button className="btn btn-secondary" onClick={()=>persist(items.filter(x=>x.product_id!==i.product_id))}>Remove</button></div>)}
 <div className="card"><h2>Checkout summary</h2><p>{items.length} product line(s) · {sellerCount} seller(s)</p><h2>Total indicative value: KSh {total.toLocaleString()}</h2><p className="muted">Final prices and stock are rechecked securely at checkout. Each product line becomes a separate seller order. Payment is arranged directly with each seller.</p>
 <label>Fulfilment<select className="field" value={method} onChange={e=>setMethod(e.target.value)}><option value="collection">Collection</option><option value="delivery">Delivery</option></select></label>
 {method==="delivery"?<label>Delivery address<textarea className="field" required value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter delivery address"/></label>:<label>Preferred collection point (optional)<input className="field" value={point} onChange={e=>setPoint(e.target.value)} placeholder="Agree with seller"/></label>}
 <label>Note to sellers (optional)<textarea className="field" value={note} onChange={e=>setNote(e.target.value)}/></label>
 <button className="btn" disabled={busy||!items.length||(method==="delivery"&&!address.trim())} onClick={checkout}>{busy?"Submitting…":"Place orders"}</button>{message&&<p role="alert">{message}</p>}</div></>}
 <p><Link href="/marketplace">Continue shopping</Link></p></main></>;
}
