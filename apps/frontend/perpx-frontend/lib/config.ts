console.log("checking env are loaded-",process.env.NEXT_PUBLIC_API_BASE ? "loaded" : "not loaded")



export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002";