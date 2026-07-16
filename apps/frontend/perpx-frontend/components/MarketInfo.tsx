interface MarketInfoProps {
  name: string;
  symbol: string;
  markPrice: string;
  scale: string;
  className:string;
  ltp:string|null;
}

function formatPrice(price: string, scale: string): string {
  return price;
}

export function MarketInfo({ name, symbol, markPrice, scale,className,ltp }: MarketInfoProps) {
  const formattedPrice = ltp ?? formatPrice(markPrice, scale);

  return (
    <div className={"w-80 shrink-0 bg-zinc-900/70 border border-zinc-800 rounded-lg flex flex-col overflow-hidden " + className}>
      {/* Market header */}
      <div className="px-3 pt-3 pb-2 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-100">{name}</span>
            <span className="ml-2 text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{symbol}</span>
          </div>
        </div>
        <div className="mt-1">
          <span className="text-lg font-bold font-mono text-zinc-50">${formattedPrice}</span>
        </div>
      </div>

      {/* Educational content about perpetual futures */}
      <div className="px-3 py-2 space-y-2 text-[11px] leading-relaxed text-zinc-400">
        <p className="text-zinc-300 text-xs font-medium tracking-wide uppercase">About Perpetual Futures</p>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div>
            <span className="text-zinc-500 block">Leverage</span>
            <span className="text-zinc-200">Up to 100×</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Funding Rate</span>
            <span className="text-zinc-200">Every 8h</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Margin</span>
            <span className="text-zinc-200">Isolated</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Settlement</span>
            <span className="text-zinc-200">USDC</span>
          </div>
        </div>

        <div className="border-t border-zinc-800/40 pt-2 space-y-1">
          <p>
            <span className="text-zinc-300">Perpetual futures</span> are derivative contracts that track the
            underlying asset price without an expiration date. Traders can go <span className="text-[#0ecb81]">long</span>{" "}
            or <span className="text-[#f23645]">short</span> with leverage to amplify their position size.
          </p>
          <p>
            <span className="text-zinc-300">Funding rate</span> keeps the contract price aligned with the
            spot price. When funding is positive, longs pay shorts; when negative, shorts pay longs.
          </p>
        </div>
      </div>
    </div>
  );
}
