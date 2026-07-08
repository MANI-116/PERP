-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_makerOrderId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_takerOrderId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "lastEventId" BIGINT NOT NULL,
    "liquidationCounters" JSONB NOT NULL,
    "streamId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastProcessedEventId" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineState_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_takerOrderId_fkey" FOREIGN KEY ("takerOrderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
