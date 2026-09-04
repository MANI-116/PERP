import "dotenv/config";

const localConfig = {
DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/perps",
REDIS_URL: "redis://localhost:6379",
JWT_PASS:"password123",
PORT:3002,
ENVIRONMENT:"local",
REDIS_SOCKET_CONFIG:{ tls: false, rejectUnauthorized: false }

}

const developmentConfig = {
  DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/perps",

  JWT_PASS: "password123",

  PORT: 3002,

  REDIS_URL: "redis://redis:6379",

  ENVIRONMENT: "development",

  REDIS_SOCKET_CONFIG: {
    tls: false,
    rejectUnauthorized: false,
  },
};

const productionConfig = {
DATABASE_URL:"postgresql://neondb_owner:npg_dJLqFzTm2U7p@ep-muddy-mountain-ay0ugwrv-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
JWT_PASS:"password123",
PORT:3002,
REDIS_URL:"rediss://default:gQAAAAAAA0DoAAIgcDJmNGYyMWRkN2FjMDE0NjIxOGQ0MDNmY2EzNzA1NDZjOA@accepted-cougar-213224.upstash.io:6379",
ENVIRONMENT:"development",
REDIS_SOCKET_CONFIG:{tls: true,rejectUnauthorized: false}

}


let configuration = localConfig;
const environment = process.env.NODE_ENV;
switch(environment){
  case "development": configuration = developmentConfig;
  break;
  case "production": configuration = productionConfig;
  break;
  default:
    configuration=localConfig;
}

console.log("running process in environment:",environment,configuration);

export const config = configuration;