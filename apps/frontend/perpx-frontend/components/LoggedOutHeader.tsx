"use client"
import Image from "next/image"
import { useRouter } from "next/navigation"

export function LoggedOutHeader(){
  const router = useRouter();

  function handleLogin(){
        router.push("/login")
    }

    function handleSignUp(){
        router.push("/signup")
    }

    function handleHomeNavigate(){
      router.push("/");
    }

  return <header className="flex flex-row justify-between mt-2">
          <div className="flex flex-row items-center text-red-500 gap-2 ml-2">
            <Image src="/site-icon.png" width={40} height={40} alt="site logo"></Image>
            <h2 onClick={handleHomeNavigate} className="cursor-pointer font-semibold"> Contracts</h2>
          </div>
       
          <div className="flex items-center gap-2">
            <button onClick={handleLogin} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-sm transition-colors">Log in</button>
            <button onClick={handleSignUp} className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-md text-sm font-medium transition-colors">Sign Up</button>
          </div>
        </header>
}

