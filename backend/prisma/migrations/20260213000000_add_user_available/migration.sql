-- Driver "available" toggle: when false, do not offer for assignment
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "available" BOOLEAN NOT NULL DEFAULT true;
