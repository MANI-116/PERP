import type { Response } from 'express';
import { ZodError } from 'zod';
import { responseManager } from '../response-manager.js';
import {
  CreateOrderSchema,
  deleteOrderSchema,
  rampUserSchema,
} from '../schemas.js';
import type { AuthRequest } from '../middleware.js';

function generateId() {
  return `ord-${Date.now() + Math.random() * 1e6}`;
}

export async function placeOrder(
  req: { body: Record<string, unknown> },
  res: Response,
) {
  try {
    const payload = CreateOrderSchema.parse(req.body);
    const orderId = generateId();
    const response = await responseManager.putRequest({
      type: 'CREATE_ORDER',
      payload: { ...payload, orderId },
    });

    return res.json({ ...response });
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('invalid user payload');
      return res.status(403).json(error);
    }
    return res.status(500).send('internal server error');
  }
}

export async function cancelOrder(
  req: { body: Record<string, unknown> },
  res: Response,
) {
  try {
    const parsedOrder = deleteOrderSchema.safeParse(req.body);
    if (parsedOrder.error) {
      return res.status(400).json(parsedOrder.data);
    }
    const response = await responseManager.putRequest({
      type: 'DELETE_ORDER',
      payload: parsedOrder.data,
    });

    return res.status(204).json(response);
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
}

export async function onramp(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId as string;
    const parsedData = rampUserSchema.safeParse({ ...req.body, userId });
    if (!parsedData.success) {
      return res.status(400).json(parsedData.error);
    }
    const response = await responseManager.putRequest({
      type: 'RAMP_USER',
      payload: { userId, credit: parsedData.data.credit },
    });
    console.log("userId for ramp -",userId);
    console.log("response from teh engine-",response);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}
