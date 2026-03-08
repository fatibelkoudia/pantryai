/*
  Warnings:

  - You are about to drop the column `receiptUrl` on the `ocr_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `ocr_jobs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ocr_jobs" DROP COLUMN "receiptUrl",
DROP COLUMN "result",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "parsedItems" JSONB,
ADD COLUMN     "rawText" TEXT,
ADD COLUMN     "retailer" TEXT;
