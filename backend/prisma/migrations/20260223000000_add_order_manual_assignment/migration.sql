-- AlterTable: Order.manual_assignment (dispatcher mark: no auto-suggest)
ALTER TABLE "Order" ADD COLUMN "manual_assignment" BOOLEAN NOT NULL DEFAULT false;
