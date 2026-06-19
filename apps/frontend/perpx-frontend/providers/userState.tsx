"use client"

import { createContext,useState } from "react";

const defaultUser = { name:"Amigo", isLoggedIn:false}
type UserContext = {name:string,isLoggedIn:boolean}
export const UserContext = createContext<{user:UserContext,setUser:(user:UserContext)=>void}>({user:defaultUser,setUser:(defaultUser)=>{}});

export function Provider({children}:React.PropsWithChildren){

    const [user,setUser] = useState({name:"amigo",isLoggedIn:false})

    return <UserContext.Provider value={{user,setUser}}>
        {children}
    </UserContext.Provider>
}