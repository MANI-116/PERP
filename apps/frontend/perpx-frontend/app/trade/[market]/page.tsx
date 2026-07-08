import { cookies } from "next/headers";
import jwt from "jsonwebtoken"
import { Orderbook } from "@/components/Orderbook";
import { prisma } from "@repo/db";
import { OrderForm } from "@/components/OrderrForm";
import { Stakes } from "@/components/Stakes";

export default async function TradePage({params}:{params:Promise<{market:string}>}){

  const passcode = process.env.JWT_PASS;

  if(!passcode){
    return <div>error plz load env</div>
  }
  const cookieStore = await cookies();
  const authToken = cookieStore.get("Authorization")?.value;

  if(!authToken){
    return <div>plz login</div>
  }

  const {username,userId} = jwt.verify(authToken,passcode) as {userId:string,username:string};
  const {market:marketSymbol} = await params;

  try {
    const market = await prisma.market.findFirst({where:{symbol:marketSymbol},select:{id:true, scale:true}});
    if(!market) return <div> market not found </div>;
    const marketId = market.id;

    return <div className="container ml-2 flex flex-col items-center">  
      <div className="flex flex-row max-h-[80vh] gap-x-2 w-full justify-center">
        <div className="flex w-full flex-row overflow-y-auto gap-x-0.5">
          <div className="w-[100%] bg-zinc-900 border border-zinc-800 rounded-lg m-2 p-3">
            <span className="text-sm font-semibold">{marketSymbol}</span>
          </div>
          <div><Orderbook marketId={marketId}/></div>
        </div>
        <OrderForm user={userId} market={marketId as string} marketInfo={{scale:Number(market.scale)}}/>
      </div> 
      <div className="w-full">
        <Stakes market={marketId} />
      </div>
    </div>
  } catch (error) {
    console.log("error occured while getting data-",error);
    return <div>internal server error</div>
  }
}