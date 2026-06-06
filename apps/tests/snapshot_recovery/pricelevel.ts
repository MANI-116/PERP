import { z } from "zod"
import { type Id } from "@repo/types"
export const dllSnapshortSchema = z.object({
    snapshorts:z.array(z.string())
})
export const nodeSnapshotSchema = z.object({
    valueSnapshot:z.string()
})



export class Node<T extends GiveSnapshot & Id>{
     left:Node<T>|null = null;
     right:Node<T>|null = null;

    constructor(public value:T){

    }

    giveSnapshot(){
        return {valueSnapshot:this.value.giveSnapshot()}
    }

}

interface GiveSnapshot{
    giveSnapshot():string
}
export class Dll<T extends GiveSnapshot & Id>{

    private head:Node<T>;
    private tail:Node<T>;
    public length:number=0;
    constructor(node:Node<T>){
        this.head = node;
        this.tail = node;
        this.length++;
    }
    getFirstOrder(){
        return this.head;
    }

    giveSnapshot(){
      
        const snapshots:string[] = [];
        let current = this.head;
        while(current.right != null){
            snapshots.push(current.value.giveSnapshot());
            current = current.right;

        }
        snapshots.push(current.value.giveSnapshot());

        return JSON.stringify({ snapshots});

    }

   
    addNode(node:Node<T>){
        //we need to  connect node to the tail and point the tail to the node
        this.tail.right = node;
        node.left = this.tail;
        this.tail  = node;
        this.length++;

    }

    removeNode(node:Node<T>):{success:boolean,message:string}{
        //start of the list
        if(this.head === node){
            //remove connection to the right node from node and left connections of right node
            //point head to the next node
            let rightNode = this.head.right;
            if(rightNode === null){
                //single node;
                return { success:false,message:"single node ,so remove the DLL"}
            }
            this.head = rightNode
            node.right = null;
            rightNode.left = null;
            this.length--;
            return { success:true, message:"removed the node"}
        }
        //at the end
        if(this.tail === node){

            let leftNode = node.left;
            if(leftNode === null) return { success:false,message:"single node,remove the list"}
            this.tail = leftNode;
            leftNode.right = null;
            node.left =null;
            this.length--;
            return { success:true, message:"removed the node"}
        }

        //middle of the list
        const leftNode = node.left
        const rightNode = node.right
        if(!leftNode || !rightNode ) return { success:false, message:"unable to remove node"}
        leftNode.right = rightNode;
        node.left = null;
        rightNode.left=leftNode;
        node.right = null;
        this.length--;
        return { success:true, message:"removed the node"}

    }


}
