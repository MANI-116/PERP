import "dotenv/config";

const localConfig = {
DATABASE_URL:"postgresql://postgres:postgres@postgres:5432/perps",
JWT_PASS:"password123",
PORT:3001,
REDIS_URL:"redis://redis:6379",
ENVIRONMENT:"local",
REDIS_SOCKET_CONFIG:{ tls: false, rejectUnauthorized: false }

}

const developmentConfig = {
DATABASE_URL:"postgresql://postgres:postgres@perps-postgres:5432/perps",
JWT_PASS:"password123",
PORT:3001,
REDIS_URL:"redis://perpx-redis:6379",
ENVIRONMENT:"development",
REDIS_SOCKET_CONFIG:{tls: true,rejectUnauthorized: false}


}

const productionConfig = {
DATABASE_URL:"postgresql://postgres:postgres@perps-postgres:5432/perps",
JWT_PASS:"password123",
PORT:3001,
REDIS_URL:"redis://perpx-redis:6379",
ENVIRONMENT:"production",
REDIS_SOCKET_CONFIG:{tls:true,rejectUnauthorized: false},
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