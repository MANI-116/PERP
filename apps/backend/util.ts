import { createClient } from 'redis';
import { type EngineRequest } from '@repo/types';
export function generateId() {
  const id = `eventCid-${Date.now() + Math.floor(Math.random() * 1e6)}`;
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

 class ResponseManager {
  private requestMap: Map<string, (value: any) => void>;
  private lastProcessedEventId = 0n;
  private static instance: ResponseManager | null = null;
  private constructor(
    private sender: RedisClientType,
    private receiver: RedisClientType,
  ) {

    console.log('backend: response manager initialized',Math.random()*1e6);
    this.requestMap = new Map<string, (value: any) => void>();
    this.responsePuller();
  }

  static async getInstance() {
    if(!ResponseManager.instance){
      const {receiver,sender} =await ResponseManager.create();
      ResponseManager.instance = new ResponseManager(sender, receiver);
    }
    return ResponseManager.instance;
  }

  private async responsePuller() {
    while (true) {
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
          { BLOCK: 50000 },
        )) as XReadResponse;
        
        if (!response) {
          continue;
        }
        const stream = response[0];

        if (stream === undefined) continue;
        const messages = stream.messages;

        for (const msg of messages) {
          const raw = msg.message;
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

          if (raw.corelationId){
            console.log("calling the resolver-",raw.corelationId, "message-",raw.message);

            const resolver = this.requestMap.get(raw.corelationId);
            if (resolver === undefined) {
              console.log('resolver not found for correlationId-', raw.corelationId);
              continue};
            console.log('resolver found-',raw.message);
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
       const resolverPromise= new Promise<any>((res, rej) => {

        console.log("setting the resolver for the corelationId-",corelationId);
        this.requestMap.set(corelationId, res);
        console.log('requespmap wether have res or not-',this.requestMap.has(corelationId));
        // Timeout: clean up stale correlation IDs after 30s
        setTimeout(() => {
          if (this.requestMap.has(corelationId)) {
            console.log('backend: timing out correlationId', corelationId);
            this.requestMap.delete(corelationId);
            rej(new Error('engine response timeout'));
          }
        }, 3000);
      });
      console.log('messsage is added to the queue');
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
      return resolverPromise;
    } catch (error) {
      console.log('error on placing the request to the engine-', error);
      return null;
    }
  }

  private static async create() {
    const redisUrl = process.env.REDIS_URL;

    if(!redisUrl){
      throw new Error('REDIS_URL is not defined in the environment variables');
    }
    const receiver = createClient({ url: redisUrl } );
    const sender = createClient( { url: redisUrl } );

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
    return {receiver,sender};
    
  }
}

export const responseManager = await ResponseManager.getInstance();
