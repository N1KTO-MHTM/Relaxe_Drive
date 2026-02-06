-- AlterTable: planning and risk fields on Order
ALTER TABLE "Order" ADD COLUMN "risk_level" TEXT;
ALTER TABLE "Order" ADD COLUMN "suggested_driver_id" TEXT;

-- AlterTable: driver stats for planning (idleAvg, lateRate, rejectRate)
ALTER TABLE "DriverStats" ADD COLUMN "idle_avg" DOUBLE PRECISION;
ALTER TABLE "DriverStats" ADD COLUMN "late_rate" DOUBLE PRECISION;
ALTER TABLE "DriverStats" ADD COLUMN "reject_rate" DOUBLE PRECISION;

-- CreateTable: OrderEvent for planning/suggestions (type, source, confidence)
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
