"use client";

import Image from "next/image";
import { useContext, useState } from "react";
import { UserContext } from "@/providers/userState";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { setUser } = useContext(UserContext);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setErrors([]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msgs: string[] = [];

        if (data.error?.issues) {
          for (const issue of data.error.issues) {
            msgs.push(`${issue.path.join(".")}: ${issue.message}`);
          }
        } else if (data.message) {
          msgs.push(
            typeof data.message === "string"
              ? data.message
              : "Invalid username or password"
          );
        } else {
          msgs.push("Invalid username or password");
        }

        setErrors(msgs);
        return;
      }

      setUser({
        name: data.username,
        isLoggedIn: true,
        userId: data.userId,
      });

      // Do NOT manually create the Authorization cookie here.
      // The backend should set an HttpOnly cookie.

      router.replace("/");
    } catch {
      setErrors(["Unable to connect to the server. Please try again."]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-80 rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
      <div className="mb-5 flex flex-col items-center">
        <Image src="/site-icon.png" width={56} height={56} alt="logo" />

        <h1 className="mt-2 text-lg font-semibold">Log in</h1>

        <p className="mt-1 text-xs text-zinc-500">
          Welcome back
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Username"
          value={username}
          disabled={loading}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-zinc-800 bg-black/40 p-2.5 text-sm transition-all placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-800 bg-black/40 p-2.5 text-sm transition-all placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
        />

        {errors.length > 0 && (
          <div className="animate-[fadeIn_0.2s_ease-out] rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2.5">
            <ul className="space-y-1 text-xs text-red-400">
              {errors.map((error, index) => (
                <li key={index} className="flex gap-2">
                  <span>•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-200 font-medium text-black transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-black" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        No account?{" "}
        <button
          type="button"
          disabled={loading}
          onClick={() => router.push("/signup")}
          className="text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}