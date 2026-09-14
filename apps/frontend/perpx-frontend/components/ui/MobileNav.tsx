"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive: (pathname: string) => boolean;
};

function IconMarkets() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19V5M4 19h16" />
      <path d="M8 19v-6M12 19V9M16 19v-4M20 19V7" />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

/**
 * Fixed bottom navigation for phones.
 *
 * Presentation-only navigation between the existing routes; it does
 * not affect any trading logic.
 */
export function MobileNav() {
  const pathname = usePathname() ?? "/";

  const items: NavItem[] = [
    {
      key: "markets",
      label: "Markets",
      href: "/",
      icon: <IconMarkets />,
      isActive: (p) => p === "/",
    },
    {
      key: "account",
      label: "Account",
      href: "/user",
      icon: <IconAccount />,
      isActive: (p) => p.startsWith("/user"),
    },
  ];

  return (
    <nav className="mobile-nav-h fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[#1d2025] bg-zinc-950/95 backdrop-blur md:hidden">
      {items.map((item) => {
        const active = item.isActive(pathname);

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[13px] font-medium transition-colors ${
              active
                ? "text-white"
                : "text-[#8b929b] hover:text-zinc-300"
            }`}
          >
            <span className={active ? "text-[#0ecb81]" : ""}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
