export interface Update{
  uid:number,
  bids:string[][],
  asks:string[][]
}

export type BackendMarket = {
  id: string;
  name: string;
  symbol: string;
  slug: string;
  scale: string;
  markPrice: string;
  lastPrice: string | null;
  takerRate: string;
  makerRate: string;
  mmr: string;
};

export type MarketDisplay = {
  symbol: string;
  name: string;
  logo: string;
  price: number;
  volume24h: string;
  openInterest: string;
  change24h: number;
};