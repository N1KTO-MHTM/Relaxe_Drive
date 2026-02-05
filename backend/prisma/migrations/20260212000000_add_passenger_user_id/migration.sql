-- Link driver (user) to passenger record by phone
ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Passenger_user_id_key" ON "Passenger"("user_id");
