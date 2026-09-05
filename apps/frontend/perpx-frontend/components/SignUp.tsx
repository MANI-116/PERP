"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";

export function SignUp() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setErrors([]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
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
              : "Unable to create account"
          );
        } else {
          msgs.push("Unable to create account");
        }

        setErrors(msgs);
        return;
      }

      router.replace("/login");
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
        <h1 className="mt-2 text-lg font-semibold">Sign Up</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Create your account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Name"
          value={name}
          disabled={loading}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-800 bg-black/40 p-2.5 text-sm transition-all placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
        />

        <input
          type="text"
          placeholder="Username"
          value={username}
          disabled={loading}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-zinc-800 bg-black/40 p-2.5 text-sm transition-all placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
          minLength={4}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-800 bg-black/40 p-2.5 text-sm transition-all placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
          minLength={6}
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
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <button
          type="button"
          disabled={loading}
          onClick={() => router.push("/login")}
          className="text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
        >
          Log in
        </button>
      </p>
    </div>
  );
}