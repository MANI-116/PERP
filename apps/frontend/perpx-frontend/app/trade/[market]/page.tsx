import { cookies } from "next/headers";
import jwt from "jsonwebtoken"
import { MarketInfo } from "@/components/MarketInfo";
import { Orderbook } from "@/components/Orderbook";
import { OrderForm } from "@/components/OrderrForm";
import { Stakes } from "@/components/Stakes";
import { LoginPrompt } from "@/components/LoginPrompt";
import { MarketNotFound } from "@/components/MarketNotFound";
import { ServerError } from "@/components/ServerError";
import { API_BASE } from "@/lib/config";

export const dynamic = "force-dynamic";

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
  if (!passcode) return <ServerError message="Server configuration error" />;

  const cookieStore = await cookies();
  const authToken = cookieStore.get("Authorization")?.value;
  if (!authToken) return <LoginPrompt />;

  try {
    const { userId } = jwt.verify(authToken, passcode) as { userId: string; username: string };
    const { market: marketSymbol } = await params;

    const market = await getMarket(marketSymbol);
    if (!market) return <MarketNotFound symbol={marketSymbol} />;

    return (
      <div className="flex flex-col items-center">
        <div className="flex flex-row max-h-[80vh] gap-x-2 w-full justify-center">
          <div className="flex  flex-row overflow-y-auto gap-x-0.5 w-full">
            <MarketInfo
              name={market.name}
              symbol={market.symbol}
              markPrice={market.markPrice}
              ltp={market.lastPrice}
              scale={market.scale}
              className="flex-1"
            />
            <div><Orderbook marketId={market.id} /></div>
          </div>
          <OrderForm user={userId} market={market.id} marketInfo={{ scale: Number(market.scale) }} />
        </div>
        <div className="w-full mt-2">
          <Stakes market={market.id} />
        </div>
      </div>
    );
  } catch {
    return <LoginPrompt message="Session expired, please sign in again" />;
  }
}
