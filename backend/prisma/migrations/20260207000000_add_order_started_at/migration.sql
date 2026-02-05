-- Add startedAt for order duration timer
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
