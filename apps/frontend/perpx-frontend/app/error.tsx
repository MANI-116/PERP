"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-zinc-300">Something went wrong</h2>
      <p className="text-zinc-500 text-sm mb-2">An unexpected error occurred</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-sm transition-colors cursor-pointer"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 bg-zinc-200 hover:bg-white text-black rounded-md text-sm font-medium transition-colors"
        >
          Back to markets
        </Link>
      </div>
    </div>
  );
}
