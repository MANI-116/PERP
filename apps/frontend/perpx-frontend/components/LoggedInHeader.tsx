"use client"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useRef, useCallback } from "react"
import { UserModal } from "./UserModal"

export function LoggedInHeader({username}:{username:string}){
   const router = useRouter();
   const [userDropdownOpen, setUserDropdownOpen] = useState(false);
   const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
   const usernameRef = useRef<HTMLSpanElement>(null);

   function handleUserClick(){
     if (usernameRef.current) {
       setAnchorRect(usernameRef.current.getBoundingClientRect());
     }
     setUserDropdownOpen(prev => !prev);
   }

    function handleHomeNavigate(){
      router.push("/");
    }


  return  <>
          <header className="flex flex-row justify-between mt-2">
          <div className="flex flex-row items-center text-red-500 gap-2 ml-2">
            <Image src="/site-icon.png" width={40} height={40} alt="site logo"></Image>
            <h2 onClick={handleHomeNavigate} className="cursor-pointer text-lg font-bold tracking-tight"><span className="text-red-500">Perp</span><span className="text-zinc-100">X</span></h2>
          </div>
       
          <div className="flex items-center gap-3">
            <span ref={usernameRef} onClick={handleUserClick} className="cursor-pointer text-zinc-200 hover:text-white text-sm transition-colors">{username}</span>
            <UserModal isOpen={userDropdownOpen} onClose={() => setUserDropdownOpen(false)} anchorRect={anchorRect} />
          </div>
        </header>
        </>
}