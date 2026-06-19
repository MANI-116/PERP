"use client"
import Image from "next/image"
import { UserContext } from "@/providers/userState"
import { useContext } from "react"
import { useRouter } from "next/navigation"
export function Header(){

    const {user}= useContext(UserContext);
    const router = useRouter();

    function handleLogin(){
        router.push("/login")

    }

    function handleSignUp(){

    }

    return  <header className="flex flex-row justify-between container mt-2">
          <div className="flex flex-row items-center text-red-600 gap-2 ml-2">
            <Image src="/site-icon.png" width={40} height={40} alt="site logo"></Image>
            <h2> Contracts</h2>
        
          </div>
       
          <div>
            {!user.isLoggedIn ? <>
            <button onClick={handleLogin} className="p-1 mr-1 bg-blue-600 rounded-md">Log in</button>
            <button onClick={handleSignUp}className="p-1 mr-1 bg-zinc-800 text-black rounded-md"> Sign Up</button></>:<span>{user.name}</span>}
      
           </div>
        </header>
}

