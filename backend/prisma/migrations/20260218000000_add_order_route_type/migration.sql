-- AlterTable (add route_type for local/long way)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "route_type" TEXT;
