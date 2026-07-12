import Link from "next/link";

export function MarketNotFound({ symbol }: { symbol: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
        <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-zinc-300">Market not found</h2>
      <p className="text-zinc-500 text-sm">
        <span className="font-mono text-zinc-400">{symbol}</span> is not a supported market
      </p>
      <Link
        href="/"
        className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-sm transition-colors"
      >
        View markets
      </Link>
    </div>
  );
}
