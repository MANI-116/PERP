import { z } from "zod"
import { Market } from "./market";
import type { IMarket } from "@repo/types";


const marketManagerSnapshotSchema = z.array(z.string());

const marketSnapshotSchema = z.object({
    symbol:z.string(),
    marketId:z.string(),
    markPrice:z.string().transform((p)=>BigInt(p)),
    mmr:z.string().transform((p)=>BigInt(p)),
    takerRate:z.string().transform((p)=>BigInt(p)),
    makerRate:z.string().transform((p)=>BigInt(p)),
    taxationScale:z.string().transform((p)=>BigInt(p))

})

export class MarketManager{
    private markets:Map<string,Market>
    private static marketManager:MarketManager|null;
    private constructor(){
        this.markets = new Map<string,Market>();

    }

    static create(){
        if(!MarketManager.marketManager){
            MarketManager.marketManager = new MarketManager();
            return MarketManager.marketManager;
        }

        return MarketManager.marketManager;
        
    }

    addMarket(market:IMarket){
        const duplicateFound = this.markets.get(market.marketId);
        if(duplicateFound){
            return { success:false,error:"duplicate market found"}
        }
        const newMarket =  Market.create(market.symbol,market.marketId,market.markPrice,market.mmr,market.takerRate,market.makerRate,market.taxationScale);

        this.markets.set(market.marketId,newMarket);
        return { success:true, message:"market added successfully"};

    }

    getMarket(marketId:string){

        return this.markets.get(marketId);

    }


    giveSnapshot(){

        const snapshots:string[] = [];
        for(const market of this.markets.values()){
            const {markPrice,mmr,takerRate,makerRate,taxationScale} = market;
            snapshots.push(JSON.stringify({
                ...market,
                mmr:mmr.toString(),
                markPrice:markPrice.toString(),
                takerRate:takerRate.toString(),
                makerRate:makerRate.toString(),
                taxationScale:taxationScale.toString()}))
        }

    }
    static createFromSnapshot(marketManagerSnapshotString:string){
        const parseData = marketManagerSnapshotSchema.safeParse(marketManagerSnapshotString);
        if(!parseData.success) return null;
        const marketManagerSnapshot = parseData.data;
        const marketManager = MarketManager.create();
        marketManagerSnapshot.forEach((snapshot)=>{
            const parseData = marketSnapshotSchema.safeParse(JSON.parse(snapshot));
            if(!parseData.success) return null;
            marketManager.addMarket(parseData.data);
        })
        return marketManager;

    }

    

    
}