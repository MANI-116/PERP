import type { Response } from 'express';
import { createMarketSchema } from '../schemas.js';
import { responseManager } from '../../util.js';
import { prisma } from '../../lib/db.js';



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

    const res = await responseManager.putRequest({
      type: 'CREATE_MARKET',
      payload: { marketId: response.id },
    });

    console.log('response from response manager-', res);

    res.status(200).send('market added successfully');
  } catch (error) {
    res.status(500).send('unknownerror');
  }
}
