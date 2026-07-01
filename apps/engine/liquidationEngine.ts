import { MarketManager, Node,Position } from "@repo/engine-package";
import { sender } from ".";

function generateId(){
    return `${"lqOrder"+Date.now() + Math.floor(Math.random()*1e6)}`
}



class LiquidationEngine{
    private static liquidationEngine:LiquidationEngine|null = null;
    private marketManager:MarketManager
    static reset(){
        LiquidationEngine.liquidationEngine = null;
    }
    private constructor(){
        this.marketManager = MarketManager.create();

    }

    static create(){
        if(LiquidationEngine.liquidationEngine){
            return LiquidationEngine.liquidationEngine;
        }
        LiquidationEngine.liquidationEngine= new LiquidationEngine();
        return LiquidationEngine.liquidationEngine;
    }

    async updateMarkPrice(price:bigint,marketId:string){
        //update markPrice of the market
        //liquidate the positions in the market whose lp is met
        const market = this.marketManager.getMarket(marketId);
        if(!market) {
            console.log("market does not exist");
            return;
        }
   
  
        const lp = price;
        let longsLpsBelowMarkPrice = market.longsTree.findBelow(lp);
        if(!longsLpsBelowMarkPrice){

        }else{

            for(const lp of longsLpsBelowMarkPrice){
                        //liquidate the positions with this lp 
                    const levelData = market.longs.get(lp);
                    if(levelData === undefined) {
                        console.log("lp in tree but no positons at lp");
                        continue;
                    }
                    const positionsList = levelData.list;
                    
                    let position:Node<Position>|null = positionsList.getFirstOrder();

                    while(position != null){

                        //place opposite order with the quantity at market ;
                        if(position === null ) break;
                        if(position.value.state === "LIQUIDATING"){
                            position = position.right;    
                            continue;
                        }

                        const payload = {
                                            userId:position.value.userId,
                                            marketId:market.marketId,
                                            type:"MARKET",
                                            side:"SHORT",
                                            qty:position.value.qty,
                                            leverage:"1"
                                            };
                         position.value.state = "LIQUIDATING"                   
                        try {
                                const id = await sender.xAdd("engine-stream","*",{payloadType:"liquidateOrder",corelationId:generateId(),payload:JSON.stringify(payload)})
                        } catch (error) {
                               position.value.state = "OPEN";
                            console.log("error on sending the liquidation reuest to the engine-stream")
                            
                        }   
                        
                        position = position.right;
                        
                    }
            
                }

        }
        
  


        //liquidate the short positions
        let shortsLpsBelowMarkPrice = market.shortsTree.findAbove(lp);
        if(!shortsLpsBelowMarkPrice){

        }else{

            for(const lp of shortsLpsBelowMarkPrice){
                        //liquidate the positions with this lp 
                    const levelData = market.shorts.get(lp);
                    if(levelData === undefined) {
                        console.log("lp in tree but no positons at lp");
                        continue;
                    }
                    const positionsList = levelData.list;
                    let position:Node<Position>|null = positionsList.getFirstOrder();

                    while(position != null){

                        //place opposite order with the quantity at market ;
                        if(position === null ) break;
                        if(position.value.state === "LIQUIDATING") {
                            position = position.right;
                            continue;
                        }
                        position.value.state = "LIQUIDATING";
                        const payload = {
                                            userId:position.value.userId,
                                            marketId:market.marketId,
                                            type:"MARKET",
                                            side:"LONG",
                                            qty:position.value.qty,
                                            leverage:"1"
                                            };
                        try {
                            await sender.xAdd("engine-stream","*",{paylooadType:"liquidateOrder",corelationId:generateId(),payload:JSON.stringify(payload)})
                        } catch (error) {
                            position.value.state = "OPEN";
                            console.log("error on sending the liquidation reuest to the engine-stream")
                            
                        }   
                        
                        position = position.right;
                        
                    }
            
                }

        }
       
        console.log("all possible liquidations happend triggered:")
        }
    }
