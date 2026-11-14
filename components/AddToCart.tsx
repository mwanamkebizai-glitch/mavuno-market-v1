"use client";
import { useState } from "react";
export type CartLine = { id: string; product_id: string; name: string; price: number; quantity: number; unit: string; seller_id: string };
export default function AddToCart({ product }: { product: CartLine }) {
  const [message, setMessage] = useState("");
  function add() {
    try {
      const current: CartLine[] = JSON.parse(localStorage.getItem("mavuno_cart") || "[]");
      const found = current.find((x) => x.product_id === product.product_id);
      const next = found
        ? current.map((x) => x.product_id === product.product_id ? { ...x, quantity: x.quantity + 1 } : x)
        : [...current, { ...product, quantity: 1 }];
      localStorage.setItem("mavuno_cart", JSON.stringify(next));
      setMessage("Added to your cart.");
    } catch { setMessage("Could not save the cart. Please try again."); }
  }
  return <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button className="btn" onClick={add}>Add to cart</button>{message && <span role="status">{message}</span>}</div>;
}
