-- Multiple stops (waypoints) for orders
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "waypoints" JSONB;
