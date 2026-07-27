"use client"
import { useContext, useState, useEffect, useRef } from "react"
import { UserContext } from "@/providers/userState"
import { API_BASE } from "@/lib/config"
import { useRouter } from "next/navigation"

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  anchorRect: DOMRect | null
}

export function UserModal({ isOpen, onClose, anchorRect }: UserModalProps) {
  const { user, setUser } = useContext(UserContext)
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [balance, setBalance] = useState({equity:0,locked:0,available:0})
  const [ramping, setRamping] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchBalance() {
    try {
      const res = await fetch(`${API_BASE}/equity/available`, { credentials: "include" })
      const data = await res.json()
      if (data.payload.success && data.payload.data?.equity) {
        setBalance(data.payload.data)
      }
    } catch (err) {
      console.log("fetch balance error", err)
    }
  }

  function handleLogout() {
    document.cookie = "Authorization=; max-age=0; path=/"
    setUser({ name: "Amigo", isLoggedIn: false, userId: "0" })
    router.push("/")
    onClose()
  }

  async function handleRamp() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return
    setRamping(true)
    try {
      const res = await fetch(`${API_BASE}/onramp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credit: amount }),
      })
      const data = await res.json()
      if (data.payload.totalAvailable) {
        setBalance({equity:Number(data.payload.totalAvailable),locked:balance.locked,available:balance.available})
      }
      setAmount("")
    } catch (err) {
      console.log("ramp error", err)
    } finally {
      setRamping(false)
    }
  }

  useEffect(() => {
    if (isOpen) {fetchBalance()};
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const top = anchorRect ? anchorRect.bottom + 8 : 0
  const right = anchorRect ? window.innerWidth - anchorRect.right : 0

  return ( <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div
        ref={dropdownRef}
        style={{ position: 'fixed', top, right }}
        className="w-72 bg-zinc-900 border border-zinc-800 rounded-[18px] rounded-tr-[4px] shadow-2xl z-50 overflow-hidden"
      >
        {/* Tail */}
      <div className="absolute -top-[6px] right-4 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-800 rotate-45"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">{user.name}</p>
            <p className="text-[10px] text-zinc-500">Account</p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Balance */}
      <div className="px-4 py-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Equity</p>
        <p className="text-xl font-bold text-zinc-50">${Number(balance.equity)/100_000_000}</p>

         <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Available Balance</p>
         <p className="text-xl font-bold text-zinc-50">${Number(balance.available)/100_000_000}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Locked Balance</p>
          <p className="text-xl font-bold text-zinc-50">${Number(balance.locked)/100_000_000}</p>
      </div>

      {/* Deposit */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Deposit Funds</p>
        <div className="flex gap-1.5">
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 min-w-0 bg-black/40 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
          />
          <button
            onClick={handleRamp}
            disabled={ramping || !amount}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0ecb81] hover:bg-[#0cb972] disabled:bg-zinc-700 disabled:text-zinc-500 text-black text-sm font-semibold transition-colors"
          >
            {ramping ? "..." : "Deposit"}
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="border-t border-zinc-800">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800/30 transition-colors"
        >
          Log out
        </button>
      </div>
      </div>
    </>
  )
}
