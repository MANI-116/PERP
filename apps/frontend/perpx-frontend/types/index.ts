export interface Update{
  uid:number,
  bids:string[][],
  asks:string[][]
}

export type OrderBookUpdate = Update;

export interface Candle {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: string;
}

export interface Trade {
  qty: string;
  price: string;
}

export interface TradeTick {
  timestamp: number;
  candles: Trade[];
}

export interface MarketUpdate {
  marketId: string;
  book?: OrderBookUpdate;
  candles?: TradeTick;
  ticker?: Record<string, unknown>;
}

export interface WsEnvelope<T = unknown> {
  type: string;
  data: T;
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

export type Ticker = {
  marketId: string;
  name: string;
  symbol: string;
  scale: string;
  lastPrice: string;
  markPrice: string;
  open24h: string | null;
  high24h: string | null;
  low24h: string | null;
  volume24h: string;
  trades24h: string;
  openInterest: string | null;
  change24h: number;
  change24hAbs: string | null;
};