-- CreateTable
CREATE TABLE "DriverTripSummary" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "dropoff_address" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "earnings_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverTripSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverStats" (
    "driver_id" TEXT NOT NULL,
    "total_earnings_cents" INTEGER NOT NULL DEFAULT 0,
    "total_miles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverStats_pkey" PRIMARY KEY ("driver_id")
);
