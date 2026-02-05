-- Block and temporary ban for users (admin)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banned_until" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ban_reason" TEXT;
