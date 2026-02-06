-- AlterTable
ALTER TABLE "User" ADD COLUMN "car_plate_number" TEXT;
ALTER TABLE "User" ADD COLUMN "car_type" TEXT;
ALTER TABLE "User" ADD COLUMN "car_capacity" INTEGER;
ALTER TABLE "User" ADD COLUMN "car_model_and_year" TEXT;
ALTER TABLE "User" ADD COLUMN "driver_id" TEXT;
CREATE UNIQUE INDEX "User_driver_id_key" ON "User"("driver_id");
