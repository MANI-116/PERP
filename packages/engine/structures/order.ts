import type { OrderSide, OrderStatus } from "@repo/types";

export class Order{
    public maintenanceMargin:bigint;
    public initialMargin:bigint;
    public filled:bigint = 0n;
    public status:OrderStatus = "OPEN"
    constructor(public orderId:string,public userId:string,public assetId:string, public qty:bigint, public side:OrderSide , public price:bigint, public leverage:bigint,public type:"LIMIT"|"MARKET"){
        console.log("orderId-",this.orderId)
        if(this.orderId === "" || this.orderId === undefined) throw new Error("orderId is needed")
        this.initialMargin =(this.qty*this.price)/this.leverage 
        this.maintenanceMargin = (this.qty * this.price*5n)/1000n;
    }
}
