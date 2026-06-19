import { useEffect,useState, useRef } from "react"
import { motion } from "motion/react"
type OrderBookLevel = {
  price: number;
  quantity: number;
};

const asks: OrderBookLevel[] = [
  { price: 105250, quantity: 0.12 },
  { price: 105240, quantity: 0.35 },
  { price: 105230, quantity: 0.82 },
  { price: 105220, quantity: 1.45 },
  { price: 105210, quantity: 0.76 },
  { price: 105200, quantity: 2.14 },
  { price: 105190, quantity: 0.98 },
  { price: 105180, quantity: 1.87 },
];


const bids: OrderBookLevel[] = [
  { price: 105170, quantity: 2.41 },
  { price: 105160, quantity: 1.56 },
  { price: 105150, quantity: 0.94 },
  { price: 105140, quantity: 3.27 },
  { price: 105130, quantity: 1.12 },
  { price: 105120, quantity: 0.68 },
  { price: 105110, quantity: 2.75 },
  { price: 105100, quantity: 1.43 },
];


export function Orderbook(){
   const [askLevels,setAskLevels] = useState<number[]>([]);
   const [bidLevels, setBidLevels] = useState<number[]>([]);
   const levels = useRef<Map<number,number>>(new Map<number,number>());
   const [updateIndex,setUpdateIndex] = useState<number>(-1);
   let askRef = useRef<number>(0);
   let bidRef = useRef<number>(0);

    useEffect(()=>{
        //const ws = new WebSocket("wss://echo.....");

        if(levels.current.size === 0){
            //set the order book
       
            for(let i =0; i < asks.length; i++){
                levels.current.set(asks[i].price,asks[i].quantity);
                askLevels.push(asks[i].price);
                askRef.current += asks[i].quantity;
            }


            for(let i =0; i < bids.length; i++){
                levels.current.set(bids[i].price,bids[i].quantity);
                bidLevels.push(bids[i].price);
                bidRef.current += bids[i].quantity;
            }
            
            askLevels.sort();
            bidLevels.sort((a,b)=>b-a);

            setAskLevels([...askLevels]);
            setBidLevels([...bidLevels]);
          
            
        }else{
       
            //update the orderBook 
            if(updateIndex < 0) return;
            const update:OrderBookUpdate=updates[updateIndex];
            //level exists
            const quantity = levels.current.get(update.price);
            if(quantity === undefined){
                //no level 
                levels.current.set(update.price,update.quantity);
                update.side === "LONG" ? bidLevels.push(update.price): askLevels.push(update.price);
                update.side === "LONG" ?  bidLevels.sort((a,b)=>b-a): askLevels.sort();
                 update.side === "LONG" ?  bidRef.current+=update.quantity: askRef.current += update.quantity;
                
                const length = update.side === "LONG" ?  bidLevels.length: askLevels.length;
                if(length > 20){
                    const lastLevel = update.side === "LONG" ?  bidLevels[length-1]: askLevels[length-1];

                    const qty =  levels.current.get(lastLevel);
                    update.side === "LONG" ?  bidRef.current -= qty!: askRef.current -= qty!;
                

                    levels.current.delete(lastLevel);
                    update.side === "LONG" ?  bidLevels.pop(): askLevels.pop();
                     update.side === "LONG" ?  bidLevels.sort((a,b)=>b-a): askLevels.sort();
                


                }
                update.side === "LONG" ? setBidLevels([...bidLevels]):setAskLevels([...askLevels]);
            
            }else{
                //update the existing the level
                levels.current.set(update.price,update.quantity);
                update.side === "LONG" ? setBidLevels([...bidLevels]):setAskLevels([...askLevels]); 
            }
   

        }

        return ()=>{
          console.log("clean up");

        }


    },[updateIndex])

    function applyNextUpdate() {
    
    if (updateIndex + 1 >= updates.length) {
        return;
    }
    setUpdateIndex(updateIndex+1);

    }
  

    let asksCummulative = 0;
    let bidsCummulative = 0;
    const temp = askLevels.map((price)=>{
            let qty = levels.current.get(price)!;
            let cum = asksCummulative += qty ;
            let selfPerecent =  Math.floor((qty/askRef.current)*100); 
            let percentage = Math.floor((cum/askRef.current)*100);
           
             return <motion.div key={price} className="flex flex-row relative mb-1 ml-1 mr-1 overflow-hidden">
                <motion.div className="absolute bg-red-500/20 inset-y-0  right-0 " style={{width:`${percentage}%`}}></motion.div>
                <motion.div className="absolute bg-red-900/60 inset-y-0  right-0 " style={{width:`${selfPerecent}%`}}></motion.div>
                <div className="flex-1 text-red-900">{price}</div>
                <div className="flex-1">{levels.current.get(price)}</div>
                <div className="flex-1 overflow-y-auto">{ cum.toFixed(3)} </div>
             </motion.div>

            })
            temp.reverse();


    return <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.5}} className="flex flex-col max-w-70 bg-zinc-800 rounded-md m-2 overflow-hidden">
        <div className="flex flex-row m-2 overflow-hidden">
            <div className="flex-1 text-white">Price(USD)</div>
            <div className="flex-1"> Size (BTC)</div>
            <div className="flex-1"> Total(BTC)</div>
        </div>

          { 
          temp
           }
            <div>
                <br/>
            </div>
            
          { bidLevels.map((price)=>{
            const qty = levels.current.get(price)!;
            let cum = bidsCummulative += qty;
            const selfPercent = Math.floor((cum/askRef.current)*100);
            let percentage = Math.floor((cum/bidRef.current)*100) ;
             return <motion.div  initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.5}} key={price} className="flex flex-row relative mb-1 ml-1 mr-1 overflow-hidden">
                <motion.div
                initial={{opacity:0}}
                animate={{opacity:1}}
                transition={{duration:0.5}}
                 className={"absolute bg-green-400/20 inset-y-0 right-0 "} style={{width:`${percentage}%`}} />
                 <motion.div
                initial={{opacity:0}}
                animate={{opacity:1}}
                transition={{duration:0.5}}
                 className={"absolute bg-green-800/20 inset-y-0 right-0 "} style={{width:`${selfPercent}%`}} />
                <div className="flex-1 text-green-900">{price}</div>
                <div className="flex-1">{levels.current.get(price)}</div>
                <div className="flex-1 overflow-y-auto">{ cum.toFixed(3)} </div>
             </motion.div>

            })}


            <br/>
              <br/>
              <button
                className="border p-2"
                onClick={applyNextUpdate}
                >
                Apply Next Update
                </button>
                        

    </motion.div>
}

type OrderBookUpdate = {
  side: "LONG" | "SHORT";
  price: number;
  quantity: number;
};

const updates: OrderBookUpdate[] = [
  // update existing bid
  {
    side: "LONG",
    price: 105170,
    quantity: 4.5,
  },

  // update existing ask
  {
    side: "SHORT",
    price: 105220,
    quantity: 3.2,
  },

  // add new bid
  {
    side: "LONG",
    price: 105175,
    quantity: 1.1,
  },

  // add new ask
  {
    side: "SHORT",
    price: 105225,
    quantity: 0.75,
  },

  // update same level again
  {
    side: "LONG",
    price: 105175,
    quantity: 2.7,
  },

  // add another bid
  {
    side: "LONG",
    price: 105165,
    quantity: 5.2,
  },
];

/**
 * order-book
 * componenet renders the bids and asks
 * on update --> 
 * price level exists -->level exist in the view --> update it --->does not exist -->just add the cummulative
 * is this cummulative needs to transfer upwards
 * need to maintain the levels in order or get levels in the order
 * -->map does not guarantee the order but allows the quick access for modifications based on the level
 * -->dll here would be used for effective traversal along side maps as references for updating the cummulative in the  levels
 *          and while updating levels delete the levels above the limit
 * -->then we need to make the list iterable ,so that we can render it using list generic
 * 
 * --> this design will not need to sort the prices in the map and effectively updates and renders without any additonal computation
 * 
 * -->new thing here is make the list iterable structure,
 *      AFTER SOME CHAT WITH GPT
 * most common operation is insert and DLL does not solves it as it O(N)-->DLL to the sortedARRAYS
 * 
 */
