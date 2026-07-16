import type { Response } from 'express';
import { prisma } from '@repo/db';
import { createMarketSchema } from '../schemas.js';
import { responseManager } from '../../util.js';


export async function createMarket(
  req: { body: Record<string, unknown> },
  res: Response,
) {
  try {
    const marketDetails = createMarketSchema.parse(req.body);

    const response = await prisma.market.create({
      data: {
        ...marketDetails,
        scale: BigInt(marketDetails.scale),
        markPrice: BigInt(marketDetails.markPrice),
        takerRate: BigInt(marketDetails.takerRate),
        makerRate: BigInt(marketDetails.makerRate),
        mmr: BigInt(marketDetails.mmr),
      },
      select: { id: true },
    });

    console.log('market is created-', response);

    responseManager.putRequest({
      type: 'CREATE_MARKET',
      payload: { marketId: response.id },
    });

    res.status(200).send('market added successfully');
  } catch (error) {
    res.status(500).send('unknownerror');
  }
}
