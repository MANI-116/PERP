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
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors([]);

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
          msgs.push(JSON.stringify(data.message));
        } else {
          msgs.push("Something went wrong");
        }

        setErrors(msgs);
        return;
      }

      router.push("/login");
    } catch {
      setErrors(["Could not connect to server"]);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80 shadow-xl">
      <div className="flex flex-col items-center mb-4">
        <Image src="/site-icon.png" width={56} height={56} alt="logo" />
        <h1 className="text-lg font-semibold mt-2">Sign Up</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md p-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          required
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md p-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          required
          minLength={4}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md p-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          required
          minLength={6}
        />

        {errors.length > 0 && (
          <ul className="text-red-400 text-sm space-y-0.5">
            {
             errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}

        <button className="bg-zinc-200 hover:bg-white text-black font-medium py-2.5 rounded-md mt-1 transition-colors">
          Create Account
        </button>
      </form>

      <p className="text-zinc-500 text-sm text-center mt-4">
        Already have an account?{" "}
        <span
          className="text-zinc-300 cursor-pointer hover:text-white transition-colors"
          onClick={() => router.push("/login")}
        >
          Log in
        </span>
      </p>
    </div>
  );
}
