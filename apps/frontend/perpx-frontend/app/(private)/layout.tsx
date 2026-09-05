import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Provider, type UserInfo } from "@/providers/userState";
import "../globals.css";
import { Header } from "@/components/Header";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";



export const metadata: Metadata = {
  title: "PerpX — Perpetual Futures Exchange",
  description: "Real-time perpetual futures trading with limit and market orders",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon-180.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultUser: UserInfo = { name: "Amigo", isLoggedIn: false, userId: "0" };
  let initialUser: UserInfo = defaultUser;

  try {
    const cookieStore = await cookies();
    console.log("waiting");
    
    const passcode = process.env.JWT_PASS;
    if (passcode) {
      const token = cookieStore.get("Authorization")?.value;
      if (token) {
        const decoded = jwt.verify(token, passcode) as { userId: string; username: string };
        initialUser = { name: decoded.username, isLoggedIn: true, userId: decoded.userId };
      }
    }
  } catch {}

  return (
  
      <Provider initialUser={initialUser}>
   
        <div className="page-wrapper w-full">
          <Header />
          <main className="mt-4">{children}</main>
        </div>
      </Provider>
   
  );
}
