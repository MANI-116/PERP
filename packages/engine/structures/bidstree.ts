
export class BidTree{
    private prices:bigint[];
    constructor(){
        this.prices = [];
    }
    clone(){
        return this.prices.map((e)=>e.toString());
    }

    static create(prices:bigint[]){
        const bidTree = new BidTree();
        prices.forEach((p)=>bidTree.prices.push(p));
        return bidTree;
    }
    
    getLength(){
        return this.prices.length
    }

    private findPosition(price:bigint,start:number,end:number):number{
        if(start > end || end >= this.prices.length || start < 0 || end < 0 ){
            return -1;
        }
        if(start === end ){
            if(this.prices[start] === price) {
                return start;
            }else if(this.prices[start]! < price){
                return start+1;

            }else{
                return start -1;
            }
        }

        const middle =  Math.floor( start + (end-start)/2) ;
        if(this.prices[middle] === price){
            return middle;
        }else if(this.prices[middle]! < price){
            return this.findPosition(price,middle+1,end);
        }

        return this.findPosition(price,start,middle-1);

    }
    
    removePrice(price:bigint){
               const position = this.findPosition(price,0,this.prices.length-1);
               if( position === this.prices.length || this.prices[position] != price){
                return true;

               }

               if(this.prices[position] === price){
                
                const res = this.prices.splice(position,1);
                return true;

               }
    }

    addPrice(price:bigint):boolean{
        if(this.prices.length === 0){
            this.prices.push(price);
            return true;
        }
        const position = this.findPosition(price,0,this.prices.length-1);
        if(position === -1){
            //insert at start;
            this.prices.push(price);
            //shift the prices
            for(let i = this.prices.length-1;i >0 ; i--){
                this.prices[i] = this.prices[i-1]!;
            }

            this.prices[0] = price;
            return true;
        }
        if(position === this.prices.length){
            this.prices.push(price);
            return true;
        }
        if(this.prices[position] === price) return true;
        this.prices.push(price)

        //shifting prices right to place the element in the position
        for( let i = this.prices.length-1;i >= position; i++){
            this.prices[i] = this.prices[i-1]!;
        }

        this.prices[position] = price;
        return true;
    }

    getTop(){
        return this.prices[this.prices.length-1];
    }

    pop(){
        return this.prices.pop();
    }


}
