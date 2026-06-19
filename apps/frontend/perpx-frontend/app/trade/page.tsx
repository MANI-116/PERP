"use client"
import { Orderbook } from "@/components/Orderbook";
import { useState } from "react";

export default function TradePage(){

  return <div className="flex flex-row  max-h-[80vh]  gap-x-2 ">
    <div className="flex flex-row overflow-y-auto scrollbar-thumb-zinc-800 scrollbar-thin scroll-bar- gap-x-.5">

            <div className="w-40 bg-zinc-800 rounded-md m-2 p-2">charts
              
            </div>
            <div> <Orderbook /></div>
        </div>
   
       <OrderForm/>

  </div> 
}
function OrderForm(){
  
  const [ side, setSide] = useState<"LONG"|"SHORT">("SHORT");
  const [ type, setType ] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [ limitPrice, setLimitPrice] = useState<number>(0);
  const [ quantity, setQuantity] = useState<number>(0);
  const [ leverage, setLeverage] = useState<number>(0);
  function handleSubmit(e:React.SubmitEvent<HTMLFormElement>){
    e.preventDefault();
    console.log("form submitted for the order");

  }

  function handleSideClick(side:"SHORT"|"LONG"){
    setSide(side);

  }

  function handleTypeClick(type:"MARKET"|"LIMIT"){
    setType(type);
  }

  


  return <div className="bg-zinc-800 p-2 max-w-70  rounded-md"> 

        <div className="flex flex-row rounded-md bg-zinc-900  items-stretch">
           <div onClick={()=>{handleSideClick("LONG")}} className={"flex-1 text-center hover:bg-green-500 hover:text-green-800 p-2 rounded-md" + `${side==="LONG"?" bg-green-500 text-green-900":""}`}><button >Buy/Long</button></div>
           <div onClick={()=>{handleSideClick("SHORT")}} className={"flex-1 text-center hover:bg-red-500 hover:text-red-800 p-2 rounded-md" + `${side === "SHORT"?" bg-red-500 text-red-900":""}`}>Sell/Short</div>
        </div>

        <div className="flex flex-col  rounded-md mt-2">
          <div className="flex flex-row gap-x-6 mb-2 items-center self-start cursor-pointer">
            <div onClick={()=>{handleTypeClick("LIMIT")}} className={type==="LIMIT"? "p-1.5 rounded-md bg-zinc-700":""}>Limit</div>
            <div onClick={()=>handleTypeClick(("MARKET"))} className={type==="MARKET"? "p-1.5 rounded-md bg-zinc-700":""}>Market</div>
          </div>
          {
            type==="MARKET" &&   <form onSubmit={handleSubmit} className="flex flex-col">
         
            <label>
              Quantity
              <br/>
              <input type="number" placeholder={quantity.toString()} onChange={(e)=>{setQuantity(Number(e.target.value))}} className=" bg-zinc-900 rounded-md p-2 w-full"/>
            </label>
            <label>
              Leverage
              <br/>
              <input type="number" placeholder={leverage.toString()} onChange={(e)=>{setLeverage(Number(e.target.value))}} className="bg-zinc-900 rounded-md p-2 w-full"></input>
            </label>
            <button className={side==="LONG"?"bg-green-500 text-black p-2 rounded-md mt-2":"bg-red-500 text-black p-2 rounded-md mt-2"}> {side==="SHORT"?"Sell/Short":"Buy/Long"} </button>
          </form>
          }

          {
            type==="LIMIT" &&   <form onSubmit={handleSubmit} className="flex flex-col items-center">
            <label>
              Price
              <br/>
              <input type="number" placeholder={limitPrice.toString()} onChange={(e)=>{setLimitPrice(Number(e.target.value))}} className="bg-zinc-900 rounded-md p-2"/>
            </label>
            <label>
              Quantity
              <br/>
              <input type="number" placeholder={quantity.toString()} onChange={(e)=>{setQuantity(Number(e.target.value))}} className="bg-zinc-900 rounded-md p-2"/>
            </label>
            <label>
              Leverage
              <br/>
              <input type="number" placeholder={leverage.toString()} onChange={(e)=>{setLeverage(Number(e.target.value))}} className="bg-zinc-900 rounded-md p-2"></input>
            </label>
            <button className={side==="LONG"?"bg-green-500 text-black p-2 rounded-md mt-2":"bg-red-600 text-black p-2 rounded-md mt-2"}> {side==="SHORT"?"Sell/Short":"Buy/Long"} </button>
          </form>
          }


        
        </div>
       </div>
}
    