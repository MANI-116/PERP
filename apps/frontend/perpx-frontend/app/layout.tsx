import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Provider, type UserInfo } from "@/providers/userState";
import "./globals.css";
import { Header } from "@/components/Header";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PerpX — Perpetual Futures Exchange",
  description: "Real-time perpetual futures trading with limit and market orders",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-black/95 text-white`}
    >
      <Provider initialUser={initialUser}>
      <body className="min-h-full flex flex-col">
        <div className="page-wrapper w-full">
          <Header />
          <main>{children}</main>
        </div>
      </body>
      </Provider>
    </html>
  );
}
