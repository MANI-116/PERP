import { createClient } from 'redis';
import { type EngineRequest } from '@repo/types';
export function generateId() {
  const id = `ord-${Date.now() + Math.floor(Math.random() * 1e6)}`;
  return id;
}

type StreamMessage = {
  corelationId?: string;
  eventId?: string;
  event?: string;
  message?: string;
};
interface Stream {
  name: string;
  messages: {
    id: string;
    message: { [x: string]: string };
    millisElapsedFromDelivery?: number | undefined;
    deliveriesCounter?: number | undefined;
  }[];
}
type XReadResponse = Stream[] | null;

type RedisClientType = ReturnType<typeof createClient>;

export class ResponseManager {
  private requestMap: Map<string, (value: any) => void>;
  private lastProcessedEventId = 0n;

  constructor(
    private sender: RedisClientType,
    private receiver: RedisClientType,
  ) {
    this.requestMap = new Map<string, (value: any) => void>();
    this.responsePuller();
  }

  private async responsePuller() {
    while (true) {
      console.log('fetching the reesponses from the engine....');
      try {
        const response: XReadResponse = (await this.receiver.xReadGroup(
          'response-group',
          'response',
          [
            {
              key: 'response-stream',
              id: '>',
            },
          ],
          { BLOCK: 5000 },
        )) as XReadResponse;
        console.log('response from the queue-', response);
        if (!response) continue;
        const stream = response[0];
        if (stream === undefined) continue;
        const messages = stream.messages;
        for (const msg of messages) {
          console.log('msg from the response stream-', msg);
          const raw = msg.message;
          console.log('response from the queue-', raw);

          let parsed: StreamMessage = {};
          try {
            parsed = JSON.parse(raw.message || '{}');
          } catch {}

          if (parsed.event !== 'SNAPSHOT' && parsed.eventId) {
            const evId = BigInt(parsed.eventId);
            if (evId <= this.lastProcessedEventId) {
              console.log('backend: skipping duplicate event', parsed.event, evId.toString());
              await this.receiver.xAck('response-stream', 'response-group', msg.id);
              continue;
            }
            this.lastProcessedEventId = evId;
          }

          if (raw.corelationId) {
            console.log("calling the resolver")
            const resolver = this.requestMap.get(raw.corelationId);
            if (resolver === undefined) continue;
            console.log('resolver found-');
            resolver(JSON.parse(raw.message as string));
            this.requestMap.delete(raw.corelationId);
          }
          await this.receiver.xAck('response-stream', 'response-group', msg.id);
        }
      } catch (error) {
        console.log('backend: response puller error-', error);
        // Wait before retry to avoid busy-loop on persistent errors
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  async putRequest(request: EngineRequest) {
    try {
      const corelationId = generateId();
      if (request.type === 'CREATE_ORDER') {
        const { leverage, price, qty } = request.payload;
        let payload = {
          ...request.payload,
          qty: qty.toString(),
          leverage: leverage.toString(),
          price: price.toString(),
        };
        await this.sender.xAdd('engine-stream', '*', {
          corelationId,
          type: request.type,
          payload: JSON.stringify(payload),
        });
      } else if (request.type === 'RAMP_USER') {
        const { userId, credit } = request.payload;
        const payload = { userId, credit: credit.toString() };
        await this.sender.xAdd('engine-stream', '*', {
          corelationId,
          type: request.type,
          payload: JSON.stringify(payload),
        });
      } else {
        await this.sender.xAdd('engine-stream', '*', {
          corelationId,
          type: request.type,
          payload: JSON.stringify(request.payload),
        });
      }
      console.log('messsage is added to the queue');
      return new Promise<any>((res, rej) => {
        this.requestMap.set(corelationId, res);
        // Timeout: clean up stale correlation IDs after 30s
        setTimeout(() => {
          if (this.requestMap.has(corelationId)) {
            console.log('backend: timing out correlationId', corelationId);
            this.requestMap.delete(corelationId);
            rej(new Error('engine response timeout'));
          }
        }, 30000);
      });
    } catch (error) {
      console.log('error on placing the request to the engine-', error);
      return null;
    }
  }

  public static async create() {
    const redisUrl = process.env.REDIS_URL ?? undefined;
    const receiver = createClient(redisUrl ? { url: redisUrl, socket: { tls: true, rejectUnauthorized: false } } : undefined);
    const sender = createClient(redisUrl ? { url: redisUrl, socket: { tls: true, rejectUnauthorized: false } } : undefined);

    receiver.on('error', (error) => {
      console.log('error on receiver connecting to redis-', error);
    });
    sender.on('error', (error) => {
      console.log('error on connecting the sender to redis-', error);
    });
    receiver.on('connection', () => {
      console.log('connected to to send data');
    });
    receiver.on('connection', () => {
      console.log('copnnedted to queue to receive data');
    });
    await receiver.connect();
    await sender.connect();
    return new ResponseManager(sender, receiver);
  }
}
