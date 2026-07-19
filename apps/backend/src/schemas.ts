import { z } from 'zod';

export const TypeSchema = z.enum(['LIMIT', 'MARKET']);
export const SideSchema = z.enum(['SHORT', 'LONG']);

export const signUpSchema = z.object({
  name: z.string().min(1).max(90),
  username: z.string().min(1).max(25),
  password: z.string().min(6).max(30),
});

export const signInSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createMarketSchema = z.object({
  name: z.string().min(2),
  symbol: z.string(),
  slug: z.string(),
  scale: z.string(),
  markPrice: z.string(),
  takerRate: z.string(),
  makerRate: z.string(),
  mmr: z.string(),
});

export const CreateOrderSchema = z.object({
  type: TypeSchema,
  marketId: z.string().min(4),
  side: SideSchema,
  leverage: z
    .string()
    .regex(/^\d+$/)
    .transform((l) => BigInt(l)),
  qty: z
    .string()
    .regex(/^\d+$/)
    .transform((q) => BigInt(q)),
  price: z
    .string()
    .regex(/^\d+$/)
    .transform((p) => BigInt(p)),
  userId: z.string().min(1),
});

export const deleteOrderSchema = z.object({
  orderId: z.string().min(2),
  marketId: z.string().min(2),
});

export const rampUserSchema = z.object({
  credit: z
    .string()
    .regex(/^\d+$/)
    .transform((p) => BigInt(p)),
  
});
