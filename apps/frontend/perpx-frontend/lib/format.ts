/**
 * Engine trade/order/candle/position prices are stored as
 * integers scaled by 1e8 (see `apps/engine/engineManager.ts`),
 * independent of `market.scale` which is the engine's
 * taxation scale. Display code must divide them by this.
 */
export const ENGINE_PRICE_SCALE = 100_000_000;

/**
 * `market.scale` is a divisor (e.g. 1_000_000), not a
 * decimal count. Backend values are scaled integers and
 * must be divided by it before display.
 */
export function scaleDivisor(
  scale: string | number | bigint,
): number {
  const value = Number(scale);

  return value > 0 ? value : 1;
}

export function scaleDecimals(
  divisor: number,
): number {
  const log = Math.log10(divisor);

  return Number.isInteger(log) && log >= 0
    ? log
    : 2;
}

export function formatScaled(
  value: string | null | undefined,
  scale: string | number | bigint,
): string {
  if (value === null || value === undefined) {
    return "--";
  }

  const divisor = scaleDivisor(scale);
  const decimals = scaleDecimals(divisor);
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return "--";
  }

  return (num / divisor).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    },
  );
}

export function formatScaledVolume(
  value: string | null | undefined,
  scale: string | number | bigint,
): string {
  if (value === null || value === undefined) {
    return "--";
  }

  const num =
    Number(value) / scaleDivisor(scale);

  if (!Number.isFinite(num)) {
    return "--";
  }

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }

  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }

  return num.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

export function formatPercent(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "--";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}%`;
}
