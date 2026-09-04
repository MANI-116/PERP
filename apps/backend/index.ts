import { config } from './config.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { type EngineResponse, type RedisResponse } from '@repo/types';
import { registerRoutes } from './src/routes/index.js';
import { handleSubscribe, handleUnsubscribe } from './ws/handlers.js';
import { prisma } from './lib/db.js';

console.log("importing is done:");
const app = express();


app.use(
  cors({
    origin: [
      'https://app.manivathala.com',
      'https://manivathala.com',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const port = Number(config.PORT );

  //Health
  app.get("/health",(req,res)=>{
    res.status(200).json({status:"ok"});
  })

registerRoutes(app);

const server = createServer(app);
const wss = new WebSocketServer({ server });

const redisUrl = config.REDIS_URL;


const receiver = config.ENVIRONMENT === "local" ? createClient({ url: redisUrl }):createClient({ url: redisUrl, socket: {tls:true, rejectUnauthorized:false}  });

receiver.on('error', (error) => {
  console.log('error on connecting to the receiver-', error);
});

await receiver.connect();

const subscribers = new Map<string, Set<WebSocket>>();
const marketUpdates = new Map<string, number>();
let lastProcessedEventId = 0n;

async function initializeServer() {
  try {
    const markets = await prisma.market.findMany({
      select: { id: true },
    });
    console.log('markets-', markets);
    markets.forEach((m) => {
      marketUpdates.set(m.id, 0);
    });
  } catch (error) {
    console.log('ERROR WHILE FETCHING THE MARKETS-', error);
  }
}

await initializeServer();


console.log("strting server");
server.listen(port, () => {
  console.log('server is running on the port-', port);
});

wss.on('connection', (ws, request) => {
  ws.on('message', (buffer) => {
    const data = JSON.parse(buffer.toString());

    if (data.type === 'subscribe') {
      console.log('message to subscribe-', data);
      const marketId = data.marketId;
      handleSubscribe(marketId, ws, subscribers, marketUpdates);
    } else if (data.type === 'unsubscribe') {
      const marketId = data.marketId;
      handleUnsubscribe(marketId, ws, subscribers);
    }
  });

  ws.on('close', () => {
    for (const [subscriber, set] of subscribers) {
      if (set.has(ws)) {
        set.delete(ws);
        return ws.send(JSON.stringify({ type: 'close', data: { status: true, message: 'deleted successfully' } }));
      }
    }
  });
});

try {
  await receiver.xGroupCreate('response-stream', 'websocketserver', '$', { MKSTREAM: true });
} catch (error) {
  console.log('error on creating the websocketserver', error);
}

//non-blocking loop to read the messages from the response-stream and broadcast to the subscribers
while (true) {
  console.log('-- waiting for the engine events --');
  const response = (await receiver.xReadGroup('websocketserver', 'ws-1', [{ key: 'response-stream', id: '>' }], { BLOCK: 10000 })) as RedisResponse[] | null;
  if (response === null) continue;

  const stream = response[0];
  if (stream === undefined) continue;
  const { messages: streamMessages } = stream;

  for (const streamMsg of streamMessages) {
    const { id } = streamMsg;

    const parsed = JSON.parse(streamMsg.message.message!) as EngineResponse;
    const { event, payload, eventId } = parsed;

    if (event !== 'SNAPSHOT' && eventId) {
      const evId = BigInt(eventId);
      if (evId <= lastProcessedEventId) {
        console.log('wsServer: skipping duplicate event', event, evId.toString());
        await receiver.xAck('response-stream', 'websocketserver', id);
        continue;
      }
      lastProcessedEventId = evId;
    }

    const allowedEvents = ['ORDER_ACCEPTED', 'ORDER_FILLED', 'ORDER_FILLED_PARTIALLY', 'DELETE_ORDER'];
    if (!allowedEvents.includes(event)) {
      await receiver.xAck('response-stream', 'websocketserver', id);
      continue;
    }

    const message = payload;
    //@ts-ignore
    const marketId = message.marketId;
    if (!marketId) {
      console.log('event missing the marketID');
      await receiver.xAck('response-stream', 'websocketserver', id);
      continue;
    }

    //@ts-ignore
    if (!message.updates) {
      console.log('no updates in event, skipping broadcast');
      await receiver.xAck('response-stream', 'websocketserver', id);
      continue;
    }

    const subs = subscribers.get(marketId);

    if (!subs) {
      console.log('invalid marketId - ', marketId);
      await receiver.xAck('response-stream', 'websocketserver', id);
      continue;
    }

    for (const subscriber of subs) {
      console.log('sending messages to the subscriber');
      //@ts-ignore
      subscriber.send(JSON.stringify({ type: 'update', data: message.updates }));
    }

    await receiver.xAck('response-stream', 'websocketserver', id);
  }
}
