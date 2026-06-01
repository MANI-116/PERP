export type PositionState = "OPEN"|"CLOSED"
export interface Id{
    id:string;
}
export interface GiveSnapshot{
    giveSnapshot():string
}
export interface RedisResponse{
    name: string;
    messages: {
        id: string;
        message: {
            [x: string]: string;
        };
        millisElapsedFromDelivery?: number | undefined;
        deliveriesCounter?: number | undefined;
    }[]
}

export interface Qty{
    qty:bigint;
}