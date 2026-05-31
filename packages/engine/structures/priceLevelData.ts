import type { Qty } from "@repo/types";
import  { Dll, Node } from "./dll";


export class PriceLevelObject<T extends Qty>{
    public totalQty:bigint = 0n;
    public list:Dll<T>;
    private length:number=0;

    constructor(order:T){
        let orderNode = new Node<T>(order);
        this.list = new Dll<T>(orderNode);
        this.length ++;
        const qty = order.qty;
        this.totalQty += qty;
        return 

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
