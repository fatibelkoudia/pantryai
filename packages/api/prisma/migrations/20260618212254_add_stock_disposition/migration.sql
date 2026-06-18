-- CreateEnum
CREATE TYPE "StockDisposition" AS ENUM ('CONSUMED', 'DISCARDED', 'EXPIRED');

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "disposition" "StockDisposition";

-- CreateIndex
CREATE INDEX "stock_items_userId_deletedAt_idx" ON "stock_items"("userId", "deletedAt");
