import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware.js';
import { responseManager } from '../../util.js';

import { prisma } from '../../lib/db.js';


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
    const skip = parseInt(req.query.skip as string) || 0;
    const take = Math.min(parseInt(req.query.take as string) || 20, 100);

    if (typeof marketId !== 'string') {
      return res.send('send proper marketid');
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId, marketId, state: { in: ['OPEN','FILLED'] } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: { userId, marketId, state: { in: ['OPEN'] } } }),
    ]);

    const parsed = orders.map((o) => ({
      ...o,
      qty: o.qty.toString(),
      filled: o.filled.toString(),
      price: o.price.toString(),
      slippage: o.slippage?.toString() ?? null,
    }));

    return res.status(200).json({ orders: parsed, total, skip, take });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getAllOrders(req: AuthRequest, res: Response) {
  try {
    const userId = req.body.userId;
    const { marketId } = req.params;
    const skip = parseInt(req.query.skip as string) || 0;
    const take = Math.min(parseInt(req.query.take as string) || 20, 100);

    if (typeof marketId !== 'string') {
      return res.send('send proper marketid');
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId, marketId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: { userId, marketId } }),
    ]);

    const parsed = orders.map((o) => ({
      ...o,
      qty: o.qty.toString(),
      filled: o.filled.toString(),
      price: o.price.toString(),
      slippage: o.slippage?.toString() ?? null,
    }));

    return res.status(200).json({ orders: parsed, total, skip, take });
  } catch (error) {
    return res.status(500).json({ error: 'internal server error' });
  }
}

export async function getFills(req: AuthRequest, res: Response) {
  const userId = req.body.userId;
  const skip = parseInt(req.query.skip as string) || 0;
  const take = Math.min(parseInt(req.query.take as string) || 20, 100);

  try {
    const [fills, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { OR: [{ takerId: userId }, { makerId: userId }] },
        select: { qty: true, price: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where: { OR: [{ takerId: userId }, { makerId: userId }] } }),
    ]);

    const parsed = fills.map((f) => ({
      qty: f.qty.toString(),
      price: f.price.toString(),
      createdAt: f.createdAt.toISOString(),
    }));

    return res.status(200).json({ fills: parsed, total, skip, take });
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
      lastPrice: m.lastPrice?.toString() ?? null,
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
