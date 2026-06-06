import type { Qty,Id } from "@repo/types";
import  { Dll, Node } from "./dll";


import { z } from "zod"

type SnapshotFactory<T> = (valueSnapshotStr: string) => T | null;


export const priceLevelSnapshotSchema = z.object({
    totalQty:z.string().transform((p)=>BigInt(p)),
    length:z.string().transform((p)=>Number(p)),
    listSnapshotString:z.string()
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


    static createFromSnapShort<T extends Qty & GiveSnapshot & Id>(levelDataSnapshotString:string,createFromSnapshot: SnapshotFactory<T>){
             
                    const parseData = priceLevelSnapshotSchema.safeParse(JSON.parse(levelDataSnapshotString));
                    if(!parseData.success){
                        console.log({ success:false, error:"levelDataSnapshotString got corrupted"});
                        return null;
                    }
                    const {totalQty,length,listSnapshotString} = parseData.data;
                    let list:Dll<T> | null= Dll.createFromSnapshot(listSnapshotString,createFromSnapshot);
                    if(list === null){
                        console.log({error:"dlll is not created",success:false});
                        return null;
                    }
                    
                    if(!list) return null;
            //checking the length and total qty is maintained
            let current:Node<T> | null = list.getFirstOrder();
            let totalNodes = 0;
            let totalQuantity = 0n;
            while(current != null){
                const node = current.value;
                totalNodes += 1;
                totalQuantity += node.qty;
                current = current.right;

            }

            if(!(totalQty===totalQuantity) || !(totalNodes===length)){

                console.log("total qty or total length invarients does not maintained");
                return null;
            }
        
        const priceLevelData = new PriceLevelObject<T>(list,totalQty,length);
        return priceLevelData;      

    }

    giveSnapshot(){
        const listSnapshotString = this.list.giveSnapshot();
        
        return JSON.stringify({totalQty:this.totalQty.toString(),length:this.length.toString(),listSnapshotString})

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
