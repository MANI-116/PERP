"use client";

import { createContext, useState } from "react";

export type UserInfo = { name: string; isLoggedIn: boolean; userId: string };

const defaultUser: UserInfo = { name: "Amigo", isLoggedIn: false, userId: "0" };

export const UserContext = createContext<{
  user: UserInfo;
  setUser: (user: UserInfo) => void;
}>({ user: defaultUser, setUser: () => {} });

export function Provider({
  children,
  initialUser,
}: React.PropsWithChildren<{ initialUser?: UserInfo }>) {
  const [user, setUser] = useState<UserInfo>(initialUser ?? defaultUser);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}
