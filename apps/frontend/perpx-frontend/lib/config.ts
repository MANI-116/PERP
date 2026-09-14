export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002";

/**
 * Free Binance USDT-M futures REST API used to poll the live
 * mark price directly from the browser (no API key required).
 *
 * The public endpoint answers with `access-control-allow-origin: *`,
 * so no proxy is needed. Override with a proxy URL if the browser
 * cannot reach Binance directly (e.g. geo-restricted regions).
 */
export const BINANCE_REST_BASE =
  process.env.NEXT_PUBLIC_BINANCE_REST_URL ??
  "https://fapi.binance.com";

/**
 * Mark price poll cadence. `fapi/v1/premiumIndex` has weight 1
 * and Binance allows 2400 weight/min per IP, so this is well
 * within the free rate limit.
 */
export const MARK_PRICE_POLL_INTERVAL_MS = 2000;