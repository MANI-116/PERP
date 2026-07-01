import express from 'express';
import cookieParser from 'cookie-parser';
import { initResponseManager } from './src/response-manager.js';
import { registerRoutes } from './src/routes/index.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

const port = process.env.PORT ?? 3000;

await initResponseManager();
registerRoutes(app);

app.listen(port, () => {
  console.log(`server is running on the port-${port}`);
});

