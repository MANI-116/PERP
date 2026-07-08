"use client";

import { useContext, useEffect, useState } from "react";
import { UserContext, type UserInfo } from "@/providers/userState";
import { LoggedInHeader } from "./LoggedInHeader";
import { LoggedOutHeader } from "./LoggedOutHeader";

export function HeaderClient({ initialUser }: { initialUser: UserInfo }) {
  const { user } = useContext(UserContext);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Before hydration: use server-provided initialUser to match SSR
  if (!hydrated) {
    if (initialUser.isLoggedIn) return <LoggedInHeader username={initialUser.name} />;
    return <LoggedOutHeader />;
  }

  // After hydration: use real context state
  if (user.isLoggedIn) return <LoggedInHeader username={user.name} />;
  return <LoggedOutHeader />;
}
