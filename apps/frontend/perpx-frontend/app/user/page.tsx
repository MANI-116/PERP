"use client"
import Image  from "next/image"
import { useContext, useState, useEffect } from "react"
import { UserContext } from "@/providers/userState"
import { number } from "zod"
type Tab = "ORDERS" | "POSITIONS" |"FILLS"
export default function UserAccount(){
    const userDetails = useContext(UserContext);
    const [openModel, setOpenModel] = useState<boolean>(false)
    const [selectedTab,setSelectedTab] = useState<Tab>("ORDERS")
    useEffect(()=>{
        if(selectedTab === "ORDERS"){
            //FECTCH ORDER AND SET THE CONTENT
        }else if(selectedTab === "POSITIONS"){
            //FETCH POSITIONS AND SET THE CONTENT
        }else{
            //FETCH THE FILLS ANDSET THE CONTENT
        }

    },[selectedTab])
    // if(!userDetails.user.isLoggedIn){
    //     return <div> plz login to view the details</div>
    // }
    return <div className="container border-1 rounded-md h-[80vh] m-2">
        <div>
            
                <dialog  className={`${openModel?" ":"hidden"} `+" flex flex-col p-4 rounded-md"}>
                     <form className="flex flex-col p-4">

                    <input type="number" className="bg-white/40 rounded-md p-1 border-1 m-1 " placeholder="Enter amount " />
                     <button  className="bg-blue-800 text-white/80 p-1 rounded-sm mt-1">Ramp Balance</button>
                     </form>

                </dialog>
            
            <div className="flex flex-row justify-between items-center  p-2 m-2">
                <div className="flex flex-col "> 
                    <span>
                        hello mani
                    </span>
                    <br/>
                    <span>
                        balance:0
                    </span>
                    <button onClick={()=>{setOpenModel(true)}} className="cursor-pointer text-green-800 p-1 rounded-sm mt-1 hover:text-green-400">Add Amount</button>

                </div>
                <div><Image src="/site-icon.png" width={150} height={150} alt="user image"></Image></div>
            </div>
        </div>
        
        <div className="border-1 rounded-md m-2">
            <div className="flex felx-row gap-x-4 border-b-1 p-2 m-2">
                <div onClick={()=>setSelectedTab("ORDERS")} className={`${selectedTab==="ORDERS"?"bg-black/40 text-white/90 ":""}`+"p-1 rounded-md cursor-pointer"}>
                    orders
                </div>
                <div onClick={()=>setSelectedTab("POSITIONS")} className={`${selectedTab==="POSITIONS"?"bg-black/40 text-white/90 ":""}`+"p-1 rounded-md cursor-pointer"}>
                    positions
                </div>
                <div onClick={()=>setSelectedTab("FILLS")} className={`${selectedTab==="FILLS"?"bg-black/40 text-white/90 ":""}`+"p-1 rounded-md cursor-pointer"}>
                    fills
                </div>
            </div>
            <div className="m-2">
                selected tab content
            </div>
        </div>

        
    </div>
}

/**
 * const orders: {
 type: OrderType;
 side: OrderSide;
 marketId: string;
 qty: bigint;
 price: bigint;
 userId: string;
 orderId: string;
 id: string;
 filled: bigint;
 slippage: bigint | null;
}[]
 */