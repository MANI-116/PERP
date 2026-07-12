import Link from "next/link";

export function LoginPrompt({ message = "Sign in to continue" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
        <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-zinc-300">Authentication required</h2>
      <p className="text-zinc-500 text-sm">{message}</p>
      <Link
        href="/login"
        className="mt-2 px-5 py-2 bg-zinc-200 hover:bg-white text-black rounded-md text-sm font-medium transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}
