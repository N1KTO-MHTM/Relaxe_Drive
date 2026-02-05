-- Trip type and roundtrip middle address
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trip_type" TEXT NOT NULL DEFAULT 'ONE_WAY';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "middle_address" TEXT;

-- Wait at pickup: driver arrives, after 5 min timer counts; when car moves we store charge
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "arrived_at_pickup_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "left_pickup_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "wait_charge_at_pickup_cents" INTEGER;

-- Roundtrip: wait at second stop (middle)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "arrived_at_middle_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "left_middle_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "wait_charge_at_middle_cents" INTEGER;
