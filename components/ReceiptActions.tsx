"use client";
import {jsPDF} from "jspdf";
export type ReceiptData={receiptNo:string;orderId:string;date:string;buyer:string;seller:string;items:{name:string;qty:number;unitPrice:number;total:number}[];total:number;paymentMethod:string;paymentReference:string;paymentStatus:string};
export default function ReceiptActions({receipt}:{receipt:ReceiptData}){
 function pdf(){const doc=new jsPDF();doc.setFontSize(20);doc.text("MAVUNO MARKET",20,20);doc.setFontSize(16);doc.text("TRANSACTION RECEIPT",20,32);doc.setFontSize(10);let y=44;
  const lines=[`Receipt: ${receipt.receiptNo}`,`Order: ${receipt.orderId}`,`Date: ${receipt.date}`,`Buyer: ${receipt.buyer}`,`Seller: ${receipt.seller}`,`Payment method: ${receipt.paymentMethod}`,`Payment reference: ${receipt.paymentReference||"Not provided"}`,`Payment status: ${receipt.paymentStatus}`];
  lines.forEach(line=>{doc.text(line,20,y);y+=7;});
  y+=4;doc.text("ITEMS",20,y);y+=8;
  receipt.items.forEach(i=>{doc.text(`${i.name} | ${i.qty} x KSh ${i.unitPrice} = KSh ${i.total}`,20,y);y+=7;if(y>270){doc.addPage();y=20;}});
  y+=8;doc.setFontSize(13);doc.text(`TOTAL: KSh ${receipt.total.toLocaleString()}`,20,y);
  doc.setFontSize(8);doc.text("This is a Mavuno Market transaction record. Payment was arranged directly between buyer and seller. Mavuno Market did not process funds.",20,285,{maxWidth:170});
  doc.save(`${receipt.receiptNo}.pdf`);
 }
 async function share(){const doc=new jsPDF();doc.setFontSize(18);doc.text("MAVUNO MARKET RECEIPT",20,20);doc.setFontSize(10);doc.text([`Receipt: ${receipt.receiptNo}`,`Order: ${receipt.orderId}`,`Buyer: ${receipt.buyer}`,`Seller: ${receipt.seller}`,`Total: KSh ${receipt.total}`,`Payment status: ${receipt.paymentStatus}`],20,35);const blob=doc.output("blob");const file=new File([blob],`${receipt.receiptNo}.pdf`,{type:"application/pdf"});try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"Mavuno Market receipt",text:`Receipt ${receipt.receiptNo}`});}else{pdf();alert("File sharing is not supported here. The PDF has been downloaded; attach it manually in WhatsApp or email.");}}catch(e){/* user cancelled sharing */}}
 function email(){const subject=encodeURIComponent(`Mavuno Market receipt ${receipt.receiptNo}`);const body=encodeURIComponent(`Please find my Mavuno Market receipt ${receipt.receiptNo}. Download the PDF from Mavuno Market and attach it to this email.`);window.location.href=`mailto:?subject=${subject}&body=${body}`;alert("An email draft has been opened. Download the PDF and attach it before sending.");}
 return <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}><button className="btn" onClick={pdf}>Download PDF</button><button className="btn btn-secondary" onClick={share}>Share PDF (WhatsApp / apps)</button><button className="btn btn-secondary" onClick={email}>Email receipt</button></div>;
}
