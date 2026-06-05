import type { Order } from "./order";
import { z  } from "zod"

const  userSnapshotSchema = z.object({
    userId:z.string(),
    available:z.string().transform((p)=>BigInt(p)),
    locked:z.string().transform((p)=>BigInt(p)),
    positions:z.array(z.object({
        id:z.string(),
        marketId:z.string()
    }))
})
interface PositionIdentifier{
    id:string,
    marketId:string}
export class User {
    public collateral:{available:bigint,locked:bigint};
    public positions:Map<string,string>;
    
    constructor(public userId:string){
        this.positions = new Map<string,string>();
        this.collateral = {available:0n,locked:0n}

    }

    giveSnapshot(){
       return JSON.stringify( {
            userId:this.userId,
            available:this.collateral.available.toString(),
            locked:this.collateral.locked.toString(),
            positions:this.positions
        })
    }

    static createFromSnapshot(userSnapshotString:string){
        const parseData = userSnapshotSchema.safeParse(JSON.parse(userSnapshotString));
        if(!parseData.success){
            return null;
        }
        const userSnapshot = parseData.data
        const user = new User(userSnapshot.userId);
        //add the positions
        const map = new Map<string,string>();
        userSnapshot.positions.forEach((pos)=>{
            map.set(pos.marketId,pos.id);
        })
    
        user.positions = map;
        return user;

    }
}
