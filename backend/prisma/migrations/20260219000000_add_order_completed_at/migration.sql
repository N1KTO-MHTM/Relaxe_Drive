-- AlterTable (PostgreSQL: use TIMESTAMP(3) for DateTime)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
