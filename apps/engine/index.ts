import { type RedisResponse, type EngineResponse } from '@repo/types';
import { createClient } from 'redis';
import { engineManager } from './engineManager';
import { Engine } from '@repo/engine-package';
import { prisma } from '@repo/db';

const redisUrl = process.env.REDIS_URL ?? undefined;
const receiver = createClient( { url: redisUrl});
export const sender = createClient({ url: redisUrl});

let lastProcessedStreamId = '0';

async function pushSnapshot(streamId: string) {
  try {
    const engine = Engine.create();
    const snapshot = engine.getSnapshot();
    const snapshotEvent: EngineResponse = {
      event: 'SNAPSHOT',
      eventId: engine.getLastEventId().toString(),
      payload: {
        snapshot,
        lastEventId: engine.getLastEventId().toString(),
        liquidationCounters: engine.getLiquidationCountersForSnapshot(),
        streamId,
        timestamp: Date.now(),
      },
    };
    // Push to response-stream for dbPoller
    await sender.xAdd('response-stream', '*', {
      message: JSON.stringify(snapshotEvent),
      corelationId: '',
    });
   
  } catch (error) {
    console.log('error on pushing snapshot-', error);
  }
}

let recoveredStreamId: string | null = null;

async function tryAutoRecovery() {
  try {
    const data = await prisma.snapshot.findFirst({
      orderBy:{lastEventId:"desc"}
    });
   
    if (!data) {
      console.log('no snapshot found for auto-recovery, starting fresh');
      return;
    }
   
    const restored = Engine.createFromSnapshot(data.snapshot);
    
    if (!restored) {
      console.log('auto-recovery: snapshot corrupted, starting fresh');
      return;
    }
    restored.setEventId(BigInt(data.lastEventId));
    
    console.log(  "liquidation Counters-",data.liquidationCounters)
    restored.setLiquidationCounters(data.liquidationCounters);
    if (data.streamId) {
      recoveredStreamId = data.streamId;
      console.log('auto-recovery: engine restored, will replay from streamId', data.streamId);
    }
    console.log('auto-recovery: engine state restored from Redis snapshot at event', data.lastEventId);
  } catch (error) {
    console.log('auto-recovery: error-', error, '(starting fresh)');
  }
}

receiver.on('error', (error) => {
  console.log('error on connecting the reciver-', error);
});

sender.on('error', (error) => {
  console.log('error on connecting the sender-', error);
});

await receiver.connect();
await sender.connect();

// Auto-recover from latest Redis snapshot before creating groups
await tryAutoRecovery();

try {
  await receiver.xGroupCreate('engine-stream', 'engine-group', `${recoveredStreamId ? "$" : "0"}`, { MKSTREAM: true });
  console.log('engine queue with engine group is created');
} catch (error) {
  if (error instanceof Error && error.message.includes('BUSYGROUP')) {
    console.log('group already created--', error.name);
  }

  if (error instanceof Error) {
    console.log('error-name:', error.name, '\nerror-message:', error.message);
  }

  console.log('error on creating the engine stream');
}

try {
  await sender.xGroupCreate('response-stream', 'response-group', '$', { MKSTREAM: true });
  console.log('response group iscreated wih response key');
} catch (error) {
  if (error instanceof Error && error.message.includes('BUSYGROUP')) {
    console.log('error while creating the request group---', error.name, '--', error.message);
  }
  console.log('creating the response-stream');
}

// Snapshot every 5 minutes, trim streams periodically
setInterval(async () => {
  await pushSnapshot(lastProcessedStreamId);
  try {
    await receiver.xTrim('engine-stream', 'MAXLEN', 10000);
    await receiver.xTrim('response-stream', 'MAXLEN', 50000);
  } catch {}
}, 5 * 60 * 1000);

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, dumping final snapshot...');
  await pushSnapshot(lastProcessedStreamId);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, dumping final snapshot...');
  await pushSnapshot(lastProcessedStreamId);
  process.exit(0);
});

// Catch-up phase: if we restored from snapshot, replay messages after the snapshot point
if (recoveredStreamId) {
  console.log('catch-up: replaying messages after streamId', recoveredStreamId);
  let catchUpDone = false;
  while (!catchUpDone) {
    const batch = await receiver.xRange('engine-stream', recoveredStreamId, '+', { COUNT: 100 });
    if (!batch || batch.length === 0) {
      catchUpDone = true;
      break;
    }
    for (const msg of batch) {
      // Skip the snapshot message itself
      if (msg.id === recoveredStreamId) continue;
      const response = engineManager(msg.message);
      if (response === null) continue;
      await receiver.xAck('engine-stream', 'engine-group', msg.id);
      lastProcessedStreamId = msg.id;
      await sender.xAdd('response-stream', '*', {
        message: JSON.stringify(response),
        corelationId: msg.message.corelationId ? msg.message.corelationId : '',
      });
    }
    // If we got fewer than 100, we've caught up
    if (batch.length < 100) catchUpDone = true;
  }
  console.log('catch-up: finished replay');
}

while (true) {
  let id = '0';
  console.log('waiting for the response....');
  try {
    const response: RedisResponse[] | null = (await receiver.xReadGroup(
      'engine-group',
      'engine',
      [{ key: 'engine-stream', id: '>' }],
      { BLOCK: 0},
    )) as RedisResponse[];
    console.log('response form the stream--', response);
    if (response === null) continue;
    const messages = response[0]?.messages;
    console.log('response from the queue-', messages);
    if (messages === undefined) continue;
    for (const msg of messages) {
      id = msg.id;
      const response = engineManager(msg.message);
      if (response === null) continue;

      console.log('reponse form the engineManager-', response);
      await receiver.xAck('engine-stream', 'engine-group', id);
      lastProcessedStreamId = id;
      const senderRes = await sender.xAdd('response-stream', '*', {
        message: JSON.stringify(response),
        corelationId: msg.message.corelationId ? msg.message.corelationId : '',
      });
      console.log('sender response-', senderRes);
    }
  } catch (error) {
    console.log('error on receiving signals-', error);
  }
}
