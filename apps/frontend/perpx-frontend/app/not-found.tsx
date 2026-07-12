import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-6xl font-bold text-zinc-600">404</h1>
      <p className="text-zinc-400 text-lg">Page not found</p>
      <Link
        href="/"
        className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-sm transition-colors"
      >
        Back to markets
      </Link>
    </div>
  );
}
