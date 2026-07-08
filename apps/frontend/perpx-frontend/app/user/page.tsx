"use client"
import Image  from "next/image"
import { useContext, useState, useEffect } from "react"
import { UserContext } from "@/providers/userState"
import { API_BASE } from "@/lib/config"
import { useRouter } from "next/navigation"
type Tab = "ORDERS" | "POSITIONS" |"FILLS"
export default function UserAccount(){
    const {user, setUser} = useContext(UserContext);
    const router = useRouter();
    const [openModel, setOpenModel] = useState<boolean>(false)
    const [amount, setAmount] = useState("")
    const [balance, setBalance] = useState<string>("0")
    const [selectedTab,setSelectedTab] = useState<Tab>("ORDERS")

    async function fetchBalance() {
      try {
        const res = await fetch(`${API_BASE}/equity/available`, {
          credentials: "include",
        })
        const data = await res.json();
        console.log(data);
        if (data.payload.success && data.payload.data?.equity) {
            console.log("SETTING THE BALANCE")
          setBalance(data.payload.data.equity)
        }
      } catch (err) {
        console.log("fetch balance error", err)
      }
    }

    function handleLogout() {
      document.cookie = "Authorization=; max-age=0; path=/";
      setUser({ name: "Amigo", isLoggedIn: false, userId: "0" });
      router.push("/");
    }

    useEffect(() => {
      fetchBalance()
    }, [])

    useEffect(()=>{
        if(selectedTab === "ORDERS"){
            //FECTCH ORDER AND SET THE CONTENT
        }else if(selectedTab === "POSITIONS"){
            //FETCH POSITIONS AND SET THE CONTENT
        }else{
            //FETCH THE FILLS ANDSET THE CONTENT
        }

    },[selectedTab])
    
    async function handleRamp(e: React.FormEvent) {
      e.preventDefault()
      try {
        const res = await fetch(`${API_BASE}/onramp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ credit: amount }),
        })
        const data = await res.json()
        console.log("ramp response", data)
        if (data.payload.totalAvailable) {
          setBalance(data.payload.totalAvailable)
        }
        setOpenModel(false)
        setAmount("")
      } catch (err) {
        console.log("ramp error", err)
      }
    }

    return <div className="container border border-zinc-800 rounded-lg h-[80vh] m-2 bg-zinc-900">
        <div>
            
            {openModel && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80 shadow-xl">
                  <form onSubmit={handleRamp} className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold">Add Balance</h2>
                    <input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-black/40 border border-zinc-800 rounded-md p-2.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
                      required
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setOpenModel(false); setAmount("") }}
                        className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button className="px-3 py-1.5 rounded-md bg-zinc-200 hover:bg-white text-black text-sm font-medium transition-colors">
                        Ramp Balance
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            <div className="flex flex-row justify-between items-center p-4 m-2">
                <div className="flex flex-col gap-1"> 
                    <span className="text-lg">hello, <span className="font-semibold">{user.name}</span></span>
                    <span className="text-zinc-400 text-sm">balance: <span className="text-zinc-200 font-medium">{balance}</span></span>
                    <button onClick={()=>{setOpenModel(true)}} className="w-fit text-sm text-green-500 hover:text-green-400 transition-colors mt-1">+ Add Amount</button>
                    <button onClick={handleLogout} className="w-fit text-sm text-red-500 hover:text-red-400 transition-colors mt-1">Log out</button>
                </div>
                <div><Image src="/site-icon.png" width={120} height={120} alt="user" className="opacity-60"/></div>
            </div>
        </div>
        
        <div className="border-t border-zinc-800 mx-4">
            <div className="flex flex-row gap-4 px-2 py-2">
                <div onClick={()=>setSelectedTab("ORDERS")} className={`${selectedTab==="ORDERS"?"text-white":"text-zinc-500 hover:text-zinc-300"}`+" text-sm cursor-pointer transition-colors"}>
                    orders
                </div>
                <div onClick={()=>setSelectedTab("POSITIONS")} className={`${selectedTab==="POSITIONS"?"text-white":"text-zinc-500 hover:text-zinc-300"}`+" text-sm cursor-pointer transition-colors"}>
                    positions
                </div>
                <div onClick={()=>setSelectedTab("FILLS")} className={`${selectedTab==="FILLS"?"text-white":"text-zinc-500 hover:text-zinc-300"}`+" text-sm cursor-pointer transition-colors"}>
                    fills
                </div>
            </div>
            <div className="p-4 text-zinc-500 text-sm">
                selected tab content
            </div>
        </div>
    </div>
}
