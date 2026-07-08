"use client"
import { API_BASE } from "@/lib/config";
import { useState } from "react";

export function OrderForm({ user, market, marketInfo }: { user:string; market: string; marketInfo: { scale: number } | null }){
  
  const [ side, setSide] = useState<"LONG"|"SHORT">("SHORT");
  const [ type, setType ] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [ limitPrice, setLimitPrice] = useState<number>(0);
  const [ quantity, setQuantity] = useState<number>(0);
  const [ leverage, setLeverage] = useState<number>(0);
  const [ submitting, setSubmitting ] = useState(false);
  const [ orderResult, setOrderResult ] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setOrderResult(null);
    setSubmitting(true);

    const scale = marketInfo?.scale ?? 1;
    const scaledPrice = BigInt(Math.floor(limitPrice * scale)).toString();
    console.log("maket data-",marketInfo);

    try {
      const res = await fetch(`${API_BASE}/order`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          marketId: market,
          side,
          leverage: String(Math.floor(leverage)===0?1:Math.floor(leverage)),
          qty: String(Math.floor(quantity)),
          price: type === "MARKET" ? "0" : limitPrice.toString(),
        }),
      });
      const data = await res.json();

      console.log("order-result:",data);
      if (data.event === "ORDER_ACCEPTED") {
        setOrderResult({ type: "success", message: `Order accepted — ${quantity} ${side}` });
        setQuantity(0);
        setLimitPrice(0);
      } else if (data.event === "ORDER_FILLED" || data.event === "ORDER_FILLED_PARTIALLY") {
        setOrderResult({ type: "success", message: `Order filled — ${quantity} ${side}` });
        setQuantity(0);
        setLimitPrice(0);
      } else if (data.event === "ORDER_REJECTED") {
        setOrderResult({ type: "error", message: data.payload?.error ?? "Order rejected" });
      } else {
        setOrderResult({ type: "error", message: "Unexpected response" });
      }
    } catch (err) {
      setOrderResult({ type: "error", message: "Network error — check backend" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSideClick(side:"SHORT"|"LONG"){
    setSide(side);
  }

  function handleTypeClick(type:"MARKET"|"LIMIT"){
    setType(type);
  }

  return <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg max-w-70"> 

        <div className="flex flex-row rounded-lg bg-zinc-800 items-stretch overflow-hidden">
           <div onClick={()=>{handleSideClick("LONG")}} className={"flex-1 text-center py-2 text-sm font-medium transition-colors" + `${side==="LONG"?" bg-green-600 text-white":" hover:bg-green-600/20 text-zinc-300"}`}><button>Buy/Long</button></div>
           <div onClick={()=>{handleSideClick("SHORT")}} className={"flex-1 text-center py-2 text-sm font-medium transition-colors" + `${side === "SHORT"?" bg-red-600 text-white":" hover:bg-red-600/20 text-zinc-300"}`}>Sell/Short</div>
        </div>

        <div className="flex flex-col mt-3">
          <div className="flex flex-row gap-4 mb-3">
            <div onClick={()=>{handleTypeClick("LIMIT")}} className={`text-sm cursor-pointer transition-colors ${type==="LIMIT"? "text-white font-medium":"text-zinc-500 hover:text-zinc-300"}`}>Limit</div>
            <div onClick={()=>handleTypeClick(("MARKET"))} className={`text-sm cursor-pointer transition-colors ${type==="MARKET"? "text-white font-medium":"text-zinc-500 hover:text-zinc-300"}`}>Market</div>
          </div>
          {
            type==="MARKET" &&   <form onSubmit={handleSubmit} className="flex flex-col gap-3">
         
            <label className="text-xs text-zinc-400">
              Quantity
              <input type="number" value={quantity || ""} onChange={(e)=>{setQuantity(Number(e.target.value))}} className="bg-black/40 border border-zinc-800 rounded-md p-2 w-full text-sm mt-1 focus:outline-none focus:border-zinc-600 transition-colors"/>
            </label>
            <label className="text-xs text-zinc-400">
              Leverage
              <input type="number" value={leverage || ""} onChange={(e)=>{setLeverage(Number(e.target.value))}} className="bg-black/40 border border-zinc-800 rounded-md p-2 w-full text-sm mt-1 focus:outline-none focus:border-zinc-600 transition-colors"/>
            </label>
            <button disabled={submitting} className={`py-2.5 rounded-md text-sm font-medium transition-colors ${side==="LONG"?"bg-green-600 hover:bg-green-500 text-white":"bg-red-600 hover:bg-red-500 text-white"}`}> {submitting ? "Placing..." : (side==="SHORT"?"Sell/Short":"Buy/Long")} </button>
          </form>
          }

          {
            type==="LIMIT" &&   <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-xs text-zinc-400">
              Price
              <input type="number" value={limitPrice || ""} onChange={(e)=>{setLimitPrice(Number(e.target.value))}} className="bg-black/40 border border-zinc-800 rounded-md p-2 w-full text-sm mt-1 focus:outline-none focus:border-zinc-600 transition-colors"/>
            </label>
            <label className="text-xs text-zinc-400">
              Quantity
              <input type="number" value={quantity || ""} onChange={(e)=>{setQuantity(Number(e.target.value))}} className="bg-black/40 border border-zinc-800 rounded-md p-2 w-full text-sm mt-1 focus:outline-none focus:border-zinc-600 transition-colors"/>
            </label>
            <label className="text-xs text-zinc-400">
              Leverage
              <input type="number" value={leverage || ""} onChange={(e)=>{setLeverage(Number(e.target.value))}} className="bg-black/40 border border-zinc-800 rounded-md p-2 w-full text-sm mt-1 focus:outline-none focus:border-zinc-600 transition-colors"/>
            </label>
            <button disabled={submitting} className={`py-2.5 rounded-md text-sm font-medium transition-colors ${side==="LONG"?"bg-green-600 hover:bg-green-500 text-white":"bg-red-600 hover:bg-red-500 text-white"}`}> {submitting ? "Placing..." : (side==="SHORT"?"Sell/Short":"Buy/Long")} </button>
          </form>
          }

          {orderResult && (
            <div className={`mt-2 text-sm p-2 rounded-md ${orderResult.type === "success" ? "bg-green-600/10 text-green-400" : "bg-red-600/10 text-red-400"}`}>
              {orderResult.message}
            </div>
          )}
        
        </div>
       </div>
}
