-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickup_type" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dropoff_type" TEXT;
