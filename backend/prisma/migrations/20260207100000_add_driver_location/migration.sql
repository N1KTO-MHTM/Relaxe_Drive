-- Add driver location for map (admin/dispatcher)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
