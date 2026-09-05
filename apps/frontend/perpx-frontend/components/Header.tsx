import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { HeaderClient } from "./HeaderClient";
import type { UserInfo } from "@/providers/userState";

export interface CustomJwtResponse  {
  userId: string;
  username: string;
}

export async function Header() {
  const defaultUser: UserInfo = { name: "Amigo", isLoggedIn: false, userId: "0" };

  const cookieStore = await cookies();

  const passcode = process.env.JWT_PASS;
  if (passcode === undefined) {
    console.log('env not loaded');
    return <HeaderClient initialUser={defaultUser} />;
  }
  console.log(cookieStore,passcode);

  const token = cookieStore.get("Authorization")?.value;
  if (token === undefined) {
    return <HeaderClient initialUser={defaultUser} />;
  }

  try {
    const user = jwt.verify(token, passcode) as CustomJwtResponse;
    return <HeaderClient initialUser={{ name: user.username, isLoggedIn: true, userId: user.userId }} />;
  } catch (error) {
    return <HeaderClient initialUser={defaultUser} />;
  }
}


