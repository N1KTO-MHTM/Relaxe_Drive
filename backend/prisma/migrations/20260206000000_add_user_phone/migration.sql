-- AlterTable: add phone to User (for registration, show for drivers)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
