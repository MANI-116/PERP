import  {  type Market } from "@repo/types";
import {OrderBook, User,Position} from "@repo/engine-package"
import {  z } from "zod"
export const orderBooks = new Map<string,OrderBook>();
export const markets:Market[] = [{marketId:"market-001",markPrice:1000n,mmr:5n,takerRate:5n,makerRate:5n,taxationScale:3n,symbol:"SOLUSDT"}];
export const users:User[] = [];
export let EXCHANGE_BALANCE=1000n;



//user manager
//--->add user ,remove user , maintain his positions, maintain his balaces,cratesnapshots ,retrieve from snapshots
const userMangerSnapshotSchema = z.array(z.string());
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
const orderBookManagerSnapshotSchema =
    z.object({
        orderBooks: z.array(z.object({
            orderBookSnapshotString:z.string(),
            marketId:z.string()

        }))
    });
export class UserManager{
    
    private users:Map<string,User>;
    private static userManager:UserManager|null;
    private constructor(){
        this.users = new Map<string,User>();

    }
    static create(){
        if(UserManager.userManager){
            return UserManager.userManager;
        }else{
            const manager = new UserManager();
            UserManager.userManager = manager;
            return UserManager.userManager;
        }
        

    }
    addUser(user:User){
        const foundUser = this.users.get(user.userId);
        if(foundUser){
            return {success:false , error:"user found"}
        }

        this.users.set(user.userId,user);

        return { success:true, message:"userCreated"}

    }
    removerUser(userId:string){
        const foundUser = this.users.get(userId);
        if(!foundUser){
            return {success:false , error:"user not found"}
        }

        this.users.delete(userId);

        return { success:true, message:"user deleted"}
        

    }
    rampUser(userId:string,credit:bigint){

        const user = this.users.get(userId);
        if(user===undefined) {
            return {success:false,message:"user not found"}
        }

        user.collateral.available += credit;

        return { success:true,message:"user credited successfully",totalAvailable:user.collateral.available}

    }
    getPositions(userId:string){
            const user = this.users.get(userId);
            if(user===undefined) {
                return {success:false,message:"user not found"}
            }
       
            const positions = user.positions;
            const openPositons:Position[]=[]
            for(let i =0; i<positions.length;i++){
                const pos = positions[i];
                if(pos === undefined) return { success:false,error:"position not found"}
                const id = pos.id;
                const orderbook = orderBooks.get(pos.marketId);
                if(orderbook === undefined ) return { success:false,error:"orderboo not found"};
                 const position = orderbook.positionsRef.get(id)
                 if(position === undefined) return { success:false,error:"position not found"}
        
                 openPositons.push(position.value);
             
        
            }
            return {success:true,data:{positions:openPositons}}
    }
    getUserEquity(userId:string){
        const user = this.users.get(userId);
        if(user===undefined) {
            return {success:false,message:"user not found"}
            
        }
        const positions = user.positions;
        let unrealizedPnL = 0n;
        for(let i =0; i<positions.length;i++){
            const pos = positions[i];
            if(pos === undefined) return { success:false,error:"position not found"}
            const id = pos.id;
            const orderbook = orderBooks.get(pos.marketId);
            if(orderbook === undefined ) return { success:false,error:"orderboo not found"};
            const position = orderbook.positionsRef.get(id)
            if(position === undefined) return { success:false,error:"position not found"}
            unrealizedPnL += position.value.unrealizedPnL;
            return { success:true, unrealizedPnL:unrealizedPnL.toString()}


        }
    

        const equity =(user.collateral.locked +user.collateral.available+unrealizedPnL).toString();

        return { success:true,data:{equity}}

    }
    giveSnapshot(){
        const usersSnapshot = [];
        for(const user of this.users.values()){
            usersSnapshot.push(user.giveSnapshot());
        }
        return JSON.stringify(usersSnapshot);


    }
    static creatFromSnapshot(usersSnapshotString:string){
        const parseData = userMangerSnapshotSchema.safeParse(JSON.parse(usersSnapshotString) as string[]);
        if(!parseData.success) return null;

        const usersSnapshot = parseData.data;
        const userManager = UserManager.create();
        usersSnapshot.forEach((ss)=>{
            const user = User.createFromSnapshot(ss);
            if(!user) return null;
            userManager.addUser(user);
        })
        return userManager;
        


    }
}
//market manger

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

    addMarket(market:Market){
        const duplicateFound = this.markets.get(market.marketId);
        if(duplicateFound){
            return { success:false,error:"duplicate market found"}
        }

        this.markets.set(market.marketId,market);
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
const marketManager  = MarketManager.create();
export class OrderBookManager {
    private static instance: OrderBookManager | null = null;
    private orderBooks: Map<string, OrderBook>

    private constructor(
    ) {
        this.orderBooks = new Map<string,OrderBook>();
    }

    static create(): OrderBookManager {
    
        if(OrderBookManager.instance){
            return OrderBookManager.instance;
        }
        OrderBookManager.instance = new OrderBookManager();
        return OrderBookManager.instance;         
        
    }

    addOrderbook(marketId:string,orderbook:OrderBook){
        this.orderBooks.set(marketId,orderbook);
    }

    giveSnapshot() {

    const snapshots = Array.from(this.orderBooks.entries()).map(([marketId,orderBook]) =>{
        const orderBookSnapshortString = orderBook.giveSnapshot()
        return JSON.stringify({ marketId,orderBookSnapshortString});
    });

        return JSON.stringify({
            orderBooks: snapshots
        });
    }

    static createFromSnapshot(
        snapshot: string
    ): OrderBookManager | null {
        // recovery
        const parsed = orderBookManagerSnapshotSchema.safeParse(JSON.parse(snapshot));

        if (!parsed.success) {
            return null;
        }

        const orderBookManager = OrderBookManager.create();

        for (const snapshot of parsed.data.orderBooks) {
            const market = marketManager.getMarket(snapshot.marketId);
            if(!market) return null;

        const orderBook = OrderBook.createFromSnapshot(snapshot.orderBookSnapshotString,market);

        if (!orderBook) {
            return null;
        }

        orderBookManager.addOrderbook(market.marketId,orderBook)


        }

        return orderBookManager;
    }
}



const user1 = new User("user-1");
const user2 = new User("user-2");
const user3 = new User("user-3");
users.push(user1);
users.push(user2);
users.push(user3);
user1.collateral.available += 15000n;
user2.collateral.available  += 1000n;
user3.collateral.available +=10000000n;

export function incrementExchangeBalance(amount:bigint){
    EXCHANGE_BALANCE += amount;
}

export function decrementExchangeBalance(amount:bigint){
    EXCHANGE_BALANCE -= amount;
}


