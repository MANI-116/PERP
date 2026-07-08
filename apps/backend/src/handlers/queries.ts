import type { Request, Response } from 'express';
import { prisma } from '@repo/db';
import { responseManager } from '../response-manager.js';
import type { AuthRequest } from '../middleware.js';

export async function getEquity(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId as string;
    const response = await responseManager.putRequest({
      type: 'GET_EQUITY',
      payload: { userId },
    });
    return res.json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getOpenPositions(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }
    const userId = req.body.userId as string;
    const response = await responseManager.putRequest({
      type: 'GET_OPEN_POSITIONS',
      payload: { userId, marketId },
    });
    res.json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getClosedPositions(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }
    const userId = req.body.userId as string;
    const response = await responseManager.putRequest({
      type: 'GET_CLOSED_POSITIONS',
      payload: { userId, marketId },
    });
    res.json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getOpenOrders(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId;
    const { marketId } = req.params;

    if (typeof marketId !== 'string') {
      return res.send('send proper marketid');
    }
    const orders = await prisma.order.findMany({
      where: { userId, marketId, state: { in: ['OPEN'] } },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = orders.map((o) => ({
      ...o,
      qty: o.qty.toString(),
      filled: o.filled.toString(),
      price: o.price.toString(),
      slippage: o.slippage?.toString() ?? null,
    }));

    return res.status(200).json({ orders: parsed });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getAllOrders(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId;
    const { marketId } = req.params;

    if (typeof marketId !== 'string') {
      return res.send('send proper marketid');
    }
    const orders = await prisma.order.findMany({
      where: { userId, marketId },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = orders.map((o) => ({
      ...o,
      qty: o.qty.toString(),
      filled: o.filled.toString(),
      price: o.price.toString(),
      slippage: o.slippage?.toString() ?? null,
    }));

    return res.status(200).json({ orders: parsed });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getFills(req: AuthRequest, res: Response) {
  const userId = req.body.userId;
  try {
    const fills = await prisma.transaction.findMany({
      where: {
        OR: [{ takerId: userId }, { makerId: userId }],
      },
      select: { qty: true, price: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = fills.map((f) => ({
      qty: f.qty.toString(),
      price: f.price.toString(),
      createdAt: f.createdAt.toISOString(),
    }));

    return res.status(200).json({ fills: parsed });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getMarkets(req: Request, res: Response) {
  try {
    const markets = await prisma.market.findMany();
    const parsed = markets.map((m) => ({
      ...m,
      scale: m.scale.toString(),
      markPrice: m.markPrice.toString(),
      takerRate: m.takerRate.toString(),
      makerRate: m.makerRate.toString(),
      mmr: m.mmr.toString(),
    }));
    return res.status(200).json({ markets: parsed });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getDepth(req: AuthRequest, res: Response) {
  try {
    const { marketId } = req.params;
    if (typeof marketId !== 'string') {
      return res.status(400).send({ error: 'plz send correct marketId' });
    }
    const response = await responseManager.putRequest({
      type: 'GET_DEPTH',
      payload: { marketId },
    });
    console.log('response from the getDepth', response);
    return res.status(200).json({ ...response });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}
