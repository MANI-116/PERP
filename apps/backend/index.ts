import { config } from './config.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { createClient } from 'redis';
import { registerRoutes } from './src/routes/index.js';


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

const redisUrl = config.REDIS_URL;


const receiver = (config.ENVIRONMENT === "local" || config.ENVIRONMENT === "development") ? createClient({ url: redisUrl }):createClient({ url: redisUrl, socket: {tls:true, rejectUnauthorized:false}  });


receiver.on('error', (error) => {
  console.log('error on connecting to the receiver-', error);
});

await receiver.connect();


const marketUpdates = new Map<string, number>();



console.log("strting server");
server.listen(port, () => {
  console.log('server is running on the port-', port);
});

