-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" BIGINT NOT NULL,
    "high" BIGINT NOT NULL,
    "low" BIGINT NOT NULL,
    "close" BIGINT NOT NULL,
    "volume" BIGINT NOT NULL,
    "trades" BIGINT NOT NULL,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candle_marketId_interval_timestamp_idx" ON "Candle"("marketId", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_marketId_interval_timestamp_key" ON "Candle"("marketId", "interval", "timestamp");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
