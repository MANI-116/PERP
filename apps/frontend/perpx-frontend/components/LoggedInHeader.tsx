"use client"
import Image from "next/image"
import { useRouter } from "next/navigation"

export function LoggedInHeader({username}:{username:string}){
   const router = useRouter();

    function handleUserClick(){
      router.push("/user")
    }

    function handleHomeNavigate(){
      router.push("/");
    }


  return  <header className="flex flex-row justify-between mt-2">
          <div className="flex flex-row items-center text-red-500 gap-2 ml-2">
            <Image src="/site-icon.png" width={40} height={40} alt="site logo"></Image>
            <h2 onClick={handleHomeNavigate} className="cursor-pointer font-semibold"> Contracts</h2>
          </div>
       
          <div className="flex items-center gap-3">
            <span onClick={handleUserClick} className="cursor-pointer text-zinc-200 hover:text-white text-sm transition-colors">{username}</span>
          </div>
        </header>
}