import { z } from "zod";
import { User } from "./user";



const userMangerSnapshotSchema = z.array(z.string());




export class UserManager{
    
    private users:Map<string,User>;
    private static userManager:UserManager|null;
    static reset() {
    UserManager.userManager = null;
}
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
    ///TODO////
    getPositions(userId:string){
            const user = this.users.get(userId);
            if(user===undefined) {
                return {success:false,message:"user not found"}
            }
       
            const positions = user.positions;
            const openPositons:Position[]=[];
            positions.entries().forEach(([key,value])=>{

            })
          
            
            return {success:true,data:{positions:openPositons}}
    }


    ///TODO////
    getUserEquity(userId:string){
        const user = this.users.get(userId);
        if(user===undefined) {
            return {success:false,message:"user not found"}
            
        }
        const positions = user.positions;
        let unrealizedPnL = 0n;
       
    

        const equity =(user.collateral.locked +user.collateral.available+unrealizedPnL).toString();

        return { success:true,data:{equity}}

    }

    foundUser(userId:string){
        return this.users.get(userId) != undefined;

    }

    lockAmount(userId:string,amount:bigint){
        const user = this.users.get(userId);
        if(!user) return false;
        if(user.collateral.available > amount){
            user.collateral.available -= amount;
            user.collateral.locked += amount;
            return true;
        }
        return false;

    }
    
    debitLockAmount(userId:string,amount:bigint){
        const user = this.users.get(userId);
        if(!user) return {success:false,error:"user not found",code:404};
        if(user.collateral.locked >= amount){
            user.collateral.locked -= amount;
            return {success:true,message:"amount deducted"};
        }
        return {success:false,error:"insufficient locked balance"};

    }
    
    getPosition(userId:string,marketId:string):{success:true,positionId:string}|{success:false,error:string}{
        const user = this.users.get(userId);
        if(!user) return { success:false,error:"user not found"};
        const position = user.positions.get(marketId);
        if(!position) return { success:false,error:"position not found"}
        return {success:true, positionId:position};
    }
    addPosition(userId:string,marketId:string,positionId:string,){
        const user = this.users.get(userId);
        if(!user) return { success:false,error:"user not found"};
        const position = user.positions.set(marketId,positionId);


    }
    giveSnapshot(){
        const usersSnapshot = [];
        for(const user of this.users.values()){
            usersSnapshot.push(user.giveSnapshot());
        }
        return JSON.stringify(usersSnapshot);


    }
    static createFromSnapshot(usersSnapshotString:string){
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