const dburl = process.env.DATABASE_URL;

if (!dburl) {
  throw new Error("Environment variables are not loaded");
}

export const config = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_PASS: process.env.JWT_PASS!,
  PORT: Number(process.env.WS_PORT),
  REDIS_URL: process.env.REDIS_URL!,
  ENVIRONMENT: process.env.NODE_ENV!,
};