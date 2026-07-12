import { cookies } from "next/headers";
import jwt from "jsonwebtoken"
import { Orderbook } from "@/components/Orderbook";
import { OrderForm } from "@/components/OrderrForm";
import { Stakes } from "@/components/Stakes";
import { API_BASE } from "@/lib/config";
export const dynamic = "force-dynamic";


if(!API_BASE){
  throw new Error("api base not found");
}

async function getMarket(symbol: string) {
  try {
    const res = await fetch(`${API_BASE}/markets`);
    const data = await res.json();
    return data.markets?.find((m: any) => m.symbol === symbol) ?? null;
  } catch {
    return null;
  }
}

export default async function TradePage({params}:{params:Promise<{market:string}>}){

  const passcode = process.env.JWT_PASS;

  if(!passcode){
    return <div>error plz load env</div>
  }
  const cookieStore = await cookies();
  const authToken = cookieStore.get("Authorization")?.value;

  if(!authToken){
    return <div>plz login</div>
  }

  try{

    const {username,userId} = jwt.verify(authToken,passcode) as {userId:string,username:string};
    const {market:marketSymbol} = await params;

    const market = await getMarket(marketSymbol);
    if (!market) return <div>market not found</div>;

    return <div className="flex flex-col items-center">  
      <div className="flex flex-row max-h-[80vh] gap-x-2 w-full justify-center">
        <div className="flex w-full flex-row overflow-y-auto gap-x-0.5">
          <div className="w-[100%] bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <span className="text-sm font-semibold">{marketSymbol}</span>
          </div>
          <div><Orderbook marketId={market.id}/></div>
        </div>
        <OrderForm user={userId} market={market.id} marketInfo={{scale:Number(market.scale)}}/>
      </div> 
      <div className="w-full">
        <Stakes market={market.id} />
      </div>
    </div>
  }catch{

    return <div>plz login</div>

  }
}
