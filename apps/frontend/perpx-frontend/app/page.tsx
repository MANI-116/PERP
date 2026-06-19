"use client"
import Image from "next/image"
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
 
  return (
      <main className=" ">

        <div className="bg-zinc-800 rounded-md container m-2 p-4 text-zinc-500 ">
          <div className="flex flex-row gap-x-2 mb-2">
            <div><h2>Spot</h2></div>
            <div><h2>Futures</h2></div>
            
          </div>
          <div className=" flex flex-row items-center border-b-1 gap-x-1 pb-3 text-zinc-200 ">
            <div className="flex-2">
              <h3>Name</h3>
            </div>
            <div className="flex-1">
              <h3> Price</h3> 
            </div>
            <div className="flex-1">
              <h3>24h Volume</h3>
            </div>
            <div className="flex-1">
              <h3>Open Interest</h3>
            </div>
            <div className="flex-1">
              <h3>24h Change</h3>
            </div>
          </div>


          {
            markets.map((m)=>{

              return  <motion.div
              whileHover={{
                scale:1.05,
                y:-10
              }}
              transition={{type:"spring", duration:0.3}}
              onClick={()=>{router.push("/trade")}}
              className=" flex flex-row items-center p-1 rounded-md border-b-1 gap-x-1 mt-1 cursor-pointer hover:bg-zinc-900">
            <div className="flex-2">
              <div className="flex flex-row items-center gap-x-1">
                <Image src={m.logo} width={25} height={25} className="rounded-full" alt='coin logo' />
                <span>{m.name}</span>
              </div>
              
            </div>
            <div className="flex-1">
              <span>{m.price}</span>
            </div>
            <div className="flex-1">
              <span>{m.volume24h}</span>
            </div>
            <div className="flex-1">
              <span>{m.openInterest}</span>
            </div>
            <div className={"flex-1 "+`${m.change24h < 0 ? "text-red-800":"text-green-800"}`}>
              <span>{m.change24h}</span>
            </div>
          </motion.div>

            })
          }
        </div>
      
       
      </main>
  
  );
}


type Market = {
  symbol: string;
  name: string;
  logo: string;
  price: number;
  volume24h: string;
  openInterest: string;
  change24h: number;
};

const markets: Market[] = [
  {
    symbol: "BTC-PERP",
    name: "Bitcoin",
    logo: "/coins/btc.png",
    price: 105432.12,
    volume24h: "$2.4B",
    openInterest: "$1.8B",
    change24h: 3.42,
  },
  {
    symbol: "ETH-PERP",
    name: "Ethereum",
    logo: "/coins/eth.png",
    price: 5876.45,
    volume24h: "$1.1B",
    openInterest: "$920M",
    change24h: 2.18,
  },
  {
    symbol: "SOL-PERP",
    name: "Solana",
    logo: "/coins/sol.png",
    price: 243.87,
    volume24h: "$540M",
    openInterest: "$380M",
    change24h: -1.24,
  },
  {
    symbol: "XRP-PERP",
    name: "XRP",
    logo: "/coins/xrp.png",
    price: 2.84,
    volume24h: "$310M",
    openInterest: "$240M",
    change24h: 5.63,
  },
  {
    symbol: "DOGE-PERP",
    name: "Dogecoin",
    logo: "/coins/doge.png",
    price: 0.42,
    volume24h: "$180M",
    openInterest: "$120M",
    change24h: -2.91,
  },
  {
    symbol: "BNB-PERP",
    name: "BNB",
    logo: "/coins/bnb.png",
    price: 921.33,
    volume24h: "$430M",
    openInterest: "$290M",
    change24h: 1.11,
  },
];
