import type { Express } from 'express';
import { AuthMiddleWare } from '../middleware.js';
import { createMarket } from '../handlers/admin.js';
import { signup, signin } from '../handlers/auth.js';
import { placeOrder, cancelOrder, onramp } from '../handlers/trade.js';
import {
  getEquity,
  getOpenPositions,
  getClosedPositions,
  getOpenOrders,
  getAllOrders,
  getFills,
  getMarkets,
  getDepth,
  getOi,
  getCandles,
  getTicker,
  getTickers
} from '../handlers/queries.js';

export function registerRoutes(app: Express) {


  app.get('/candles/:marketId', getCandles);

  // Tickers (24h stats derived from candles)
  app.get('/ticker/:marketId', getTicker);
  app.get('/tickers', getTickers);
  // Admin
  app.post('/admin/market', createMarket);

  // Markets
  app.get('/markets', getMarkets);

  // Auth
  app.post('/signup', signup);
  app.post('/signin', signin);

  // Account
  app.post('/onramp', AuthMiddleWare, onramp);

  // Trading
  app.post('/order', AuthMiddleWare, placeOrder);
  app.delete('/order', cancelOrder);

  // Data queries
  app.get('/equity/available', AuthMiddleWare, getEquity);
  app.get('/positions/open/:marketId', AuthMiddleWare, getOpenPositions);
  app.get('/positions/closed/:marketId', AuthMiddleWare, getClosedPositions);
  app.get('/orders/open/:marketId', AuthMiddleWare, getOpenOrders);
  app.get('/orders/:marketId', AuthMiddleWare, getAllOrders);
  app.get('/fills', AuthMiddleWare, getFills);
  app.get('/depth/:marketId', AuthMiddleWare, getDepth);
  app.get('/oi/:marketId', getOi);
}
