import type { Qty,Id } from "@repo/types";
import  { Dll, Node } from "./dll";


import { z } from "zod"


export const priceLevelSnapshotSchema = z.object({
    totalQty:z.string().transform((p)=>BigInt(p)),
    length:z.string().transform((p)=>Number(p)),
    listSnapshortString:z.string()
})

export type PriceLevelSnapshot = z.infer<typeof priceLevelSnapshotSchema>

interface GiveSnapshot{
    giveSnapshot():string
}

export class PriceLevelObject<T extends Qty & GiveSnapshot & Id >{

    public list:Dll<T>;
   

    private constructor(list:Dll<T>,public totalQty:bigint, public length:number){
        this.list = list;
    
   

    }
    static createFromOrder<T extends Qty & GiveSnapshot & Id>(order:T){
        let orderNode = new Node<T>(order);
        const list = new Dll<T>(orderNode);
        const priceLevelData = new PriceLevelObject<T>(list,order.qty,1);
       
        return priceLevelData

    }


    static createFromSnapShort<T extends Qty & GiveSnapshot & Id>(totalQty:bigint,length:number,dll:Dll<T>){
        const priceLevelData = new PriceLevelObject<T>(dll,totalQty,length);
        return priceLevelData;      

    }

    giveSnapshot(){
        const listSnapshotString = this.list.giveSnapshot();
        
        return JSON.stringify({snapshot:{totalQty:this.totalQty.toString(),length:this.length.toString(),listSnapshotString}})

    }
    

    addNode(node:Node<T>){
        this.length++;
        const qty = node.value.qty;
        this.totalQty += qty;
        this.list.addNode(node);
        return;

    }

    removeNode(node:Node<T>){
        const response = this.list.removeNode(node);
        if(response.success){
            this.totalQty -= node.value.qty;
            this.length --;
        }
        return response;
    }

}
