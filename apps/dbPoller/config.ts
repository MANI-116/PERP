const environment = process.env.DATABASE_URL;

if (!environment) {
  throw new Error("Environment variables are not loaded");
}

export const config = {
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,
  ENVIRONMENT: process.env.NODE_ENV!,
};