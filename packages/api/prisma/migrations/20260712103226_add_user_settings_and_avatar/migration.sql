-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarId" TEXT;

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "recipeMinMatchedItems" INTEGER NOT NULL DEFAULT 1,
    "recipeMatchThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "expiringSoonDays" INTEGER NOT NULL DEFAULT 3,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 1,
    "defaultStockLocation" "StockLocation" NOT NULL DEFAULT 'PANTRY',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
