import type { Market } from "@repo/types";



export class Position {
    public id:string;
    public state:"CLOSED"|"OPEN"="OPEN";
    public initialMargin:bigint;
    public unrealizedPnL:bigint;
    public avgPrice:bigint;
    public liquidationPrice:bigint;
  

    
     setInitialMargin(){
        const positionalSize = this.avgPrice * this.qty;
    

     }
     setUnrealizedPnL(){
        this.unrealizedPnL =( this.market.markPrice-this.avgPrice)*this.qty;
     }

     setLiquidationPrice(){
        if(this.qty === 0n || this.state ==="CLOSED"){
            throw new Error("qty is zero,we cannot measure of zero qty or state is closed ");
        }
        let direction =  this.side ==="SHORT" ?1n:-1n;
        this.liquidationPrice = ((this.avgPrice*this.qty)+this.initialMargin*direction)/(this.qty * (1000n-this.market.mmr));
     }
    
     setLeverage(leverage:bigint){

     }
    constructor(public userId:string, public market:Market, public qty:bigint, price:bigint, public side:"LONG"|"SHORT",leverage:bigint){
        this.id =`${userId+Date.now}`;
  
        this.avgPrice = price;
         const positionalSize = this.avgPrice * this.qty;
        this.initialMargin = positionalSize/leverage;
        this.unrealizedPnL =( this.market.markPrice-this.avgPrice)*this.qty;
        let direction =  this.side ==="SHORT" ?1n:-1n;
        this.liquidationPrice = ((this.avgPrice*this.qty)+this.initialMargin*direction)/(this.qty * (1000n-this.market.mmr));

        
    }

    setNewAvgPrice(price:bigint,qty:bigint){
        this.avgPrice =( (this.avgPrice * this.qty)+(price*qty))/(this.qty+qty)
    }
    addFill(price:bigint,qty:bigint,leverage:bigint,side:"LONG"|"SHORT"){
        //know wether the add fill is on the on the same side or not
    

        const sameSide = side === this.side;
        if(sameSide){
            //add quantity
            //recalculate the avg price,liquidationPrice and also the margins and also change the unrealized PnL
            this.qty += qty;
            this.setNewAvgPrice(price,qty);
            const margin = (price*qty)/leverage;
            this.initialMargin += margin;
            this.setLiquidationPrice();

            
        }else{

            if(qty < this.qty){
                /**
                 * decrease quantity
                 * avg price wont change
                 * inital margin decreased
                 * calculate liquidation
                 */
                const marginPerQty = this.qty/this.initialMargin; 
                this.qty -= qty;
                this.initialMargin = this.qty*marginPerQty;
                
                this.setLiquidationPrice();

            }else if(qty > this.qty){
                //reversal case
                const netQuantity = qty - this.qty;
                this.qty = netQuantity;
                this.avgPrice= price;
               
                this.side = side;
                this.initialMargin = (netQuantity*price)/leverage ;
                this.setLiquidationPrice()

            }else{
                //close the position
                this.state = "CLOSED";

            }
  

        }
       
       

    }
}

   
