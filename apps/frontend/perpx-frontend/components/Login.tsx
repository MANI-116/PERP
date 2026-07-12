"use client";

import Image from "next/image";
import { useState, useContext } from "react";
import { UserContext } from "@/providers/userState";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const { setUser } = useContext(UserContext);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors([]);

    try {
      const res = await fetch(`${API_BASE}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      console.log("data from the siginin-",data);

      if (!res.ok) {
        const msgs: string[] = [];

        if (data.error?.issues) {
          for (const issue of data.error.issues) {
            msgs.push(`${issue.path.join(".")}: ${issue.message}`);
          }
        } else if (data.message) {
          msgs.push(data.message);
        } else {
          msgs.push("Login failed");
        }

        setErrors(msgs);
        return;
      }

      setUser({ name: data.username, isLoggedIn: true , userId:data.userId});

      // Store the token from the response cookie into a client-side cookie
      // on the current domain so the server component sees it on reload
      document.cookie = "Authorization=" + encodeURIComponent(data.token) + "; path=/; max-age=86400; samesite=lax";

      window.location.href = "/";
    } catch {
      setErrors(["Could not connect to server"]);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80 shadow-xl">
      <div className="flex flex-col items-center mb-4">
        <Image src="/site-icon.png" width={56} height={56} alt="logo" />
        <h1 className="text-lg font-semibold mt-2">Log in</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md p-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md p-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          required
        />

        {errors.length > 0 && (
          <ul className="text-red-400 text-sm space-y-0.5">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}

        <button className="bg-zinc-200 hover:bg-white text-black font-medium py-2.5 rounded-md mt-1 transition-colors">
          Log in
        </button>
      </form>

      <p className="text-zinc-500 text-sm text-center mt-4">
        No account?{" "}
        <span
          className="text-zinc-300 cursor-pointer hover:text-white transition-colors"
          onClick={() => router.push("/signup")}
        >
          Sign up
        </span>
      </p>
    </div>
  );
}
