import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

import { LoginPrompt } from "@/components/LoginPrompt";
import { MarketNotFound } from "@/components/MarketNotFound";
import { ServerError } from "@/components/ServerError";
import { API_BASE } from "@/lib/config";
import { TradeWorkspace } from "@/components/TradeWorkspace";
import type { BackendMarket } from "@/types";

export const dynamic = "force-dynamic";

async function getMarket(
  symbol: string,
): Promise<BackendMarket | null> {
  try {
    const res = await fetch(`${API_BASE}/markets`);
    const data = await res.json();

    return (
      data.markets?.find(
        (m: BackendMarket) =>
          m.symbol === symbol,
      ) ?? null
    );
  } catch {
    return null;
  }
}

export default async function TradePage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const passcode = process.env.JWT_PASS;

  if (!passcode) {
    return <ServerError message="Server configuration error" />;
  }

  const cookieStore = await cookies();
  const authToken = cookieStore.get("Authorization")?.value;

  if (!authToken) {
    return <LoginPrompt />;
  }

  let user: null | {
    userId: string;
    username: string;
  } = null;

  try {
    user = jwt.verify(
      authToken,
      passcode
    ) as {
      userId: string;
      username: string;
    };
  } catch (error) {
    console.log("error occured:", error);
  }

  if (!user) {
    return (
      <LoginPrompt message="Session expired, please sign in again" />
    );
  }

  const { market: marketSymbol } = await params;

  const market = await getMarket(marketSymbol);

  if (!market) {
    return <MarketNotFound symbol={marketSymbol} />;
  }

  return (
    <TradeWorkspace
      market={market}
      userId={user.userId}
    />
  );
}