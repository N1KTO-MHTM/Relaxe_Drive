-- Place type for pickup/dropoff (synagogue, school, hospital, store, home, etc.)
ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "pickup_type" TEXT;
ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "dropoff_type" TEXT;
