import { createClient } from 'redis';
import { type EngineRequest } from '@repo/types';
import { config } from './config';
import { v7 as uuidv7 } from "uuid";


export function generateId() {
  const id = uuidv7();
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
   
          const engineResponse = msg.message;
          let payload: StreamMessage = {};
        
           payload = JSON.parse(engineResponse.payload || '{}');
        

          if (engineResponse.event !== 'SNAPSHOT' && engineResponse.eventId) {
            const evId = BigInt(engineResponse.eventId);
            if (evId <= this.lastProcessedEventId) {
              console.log('backend: skipping duplicate event', payload.event, evId.toString());
              await this.receiver.xAck('response-stream', 'response-group', msg.id);
              continue;
            }
            this.lastProcessedEventId = evId;
          }

          if (engineResponse.corelationId){
            console.log("calling the resolver-",engineResponse.corelationId, "message-",payload);

            const resolver = this.requestMap.get(engineResponse.corelationId);

            if (resolver === undefined) {

              console.log('resolver not found for correlationId-', engineResponse.corelationId);
              continue;
            };

          
            resolver(payload);

            this.requestMap.delete(engineResponse.corelationId);
          }
          await this.receiver.xAck('response-stream', 'response-group', msg.id);
        }
      } catch (error) {
        console.log("error:",error);
      }
    }
  }
  async putRequest(request: EngineRequest) {
    try {
       const corelationId = generateId();
       const resolverPromise= new Promise<any>((res, rej) => {

        this.requestMap.set(corelationId, res);
       
        setTimeout(() => {
          if (this.requestMap.has(corelationId)) {
            this.requestMap.delete(corelationId);
            rej(`request timedout for corelationId: ${corelationId}`);
          }
        }, 10_000);
      });
      if (request.type === 'CREATE_ORDER') {
        const { leverage, price, qty } = request.payload;
        let payload = {
          ...request.payload,
          qty: qty.toString(),
          leverage: leverage.toString(),
          price: price.toString(),
        };
        
        const streamId = await this.sender.xAdd('engine-stream', '*', {
          corelationId,
          type: request.type,
          payload: JSON.stringify(payload),
        });
        console.log('messsage is added to the queue:',streamId,corelationId);
      } else if (request.type === 'RAMP_USER') {
        const { userId, credit } = request.payload;
        const payload = { userId, credit: credit.toString() };
        await this.sender.xAdd('engine-stream', '*', {
          corelationId,
          type: request.type,
          payload: JSON.stringify(payload),
        });
      } else {

        console.log("sending message for:",request.type);
       
        const streamId = await this.sender.xAdd('engine-stream', '*', {
          corelationId,
          type: request.type,
          payload: JSON.stringify(request.payload),
        });

        console.log("messag sent to the queue:",streamId);
      }
      return resolverPromise;
    } catch (error) {
      console.log('error on placing the request to the engine-', error);
      return null;
    }
  }

  private static async create() {
    const redisUrl = config.REDIS_URL;

    console.log("redisurl:backend::::::::::::::",redisUrl);

    if(!redisUrl){
      throw new Error('REDIS_URL is not defined in the environment variables');
    }
    const receiver = (config.ENVIRONMENT === "local" || config.ENVIRONMENT === "development") ? createClient({ url: redisUrl }):createClient({ url: redisUrl, socket: {tls:true, rejectUnauthorized:false}  });
    
    const sender = (config.ENVIRONMENT === "local" || config.ENVIRONMENT === "development") ? createClient({ url: redisUrl }):createClient({ url: redisUrl, socket: {tls:true, rejectUnauthorized:false}  });
    
    
  
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
