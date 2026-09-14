export type Timeframe =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d";

export const TIMEFRAMES: Timeframe[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
];

export const TIMEFRAME_MS: Record<
  Timeframe,
  number
> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export const DEFAULT_TIMEFRAME: Timeframe =
  "1m";

export function isTimeframe(
  value: string,
): value is Timeframe {
  return value in TIMEFRAME_MS;
}
