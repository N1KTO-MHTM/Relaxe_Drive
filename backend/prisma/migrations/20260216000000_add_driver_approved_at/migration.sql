-- AlterTable
ALTER TABLE "User" ADD COLUMN "approved_at" TIMESTAMP(3);

-- Existing drivers are considered already approved (so they can keep signing in)
UPDATE "User" SET "approved_at" = "created_at" WHERE "role" = 'DRIVER' AND "approved_at" IS NULL;
