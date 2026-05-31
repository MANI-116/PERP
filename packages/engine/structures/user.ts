import type { Order } from "./order";

export class User {
    public collateral:{available:bigint,locked:bigint};
    public positions:Position[];
    public orders:Order[];
    public closedPositions:Position[]
    
    constructor(public userId:string){
        this.positions = [];
        this.orders = [];
        this.closedPositions=[];
        this.collateral = {available:0n,locked:0n}

    }
}
