-- DropIndex
DROP INDEX "user_challenges_userId_challengeId_key";

-- AlterTable
ALTER TABLE "shopping_items" ADD COLUMN     "checkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_challenges" ADD COLUMN     "weekKey" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "lesson_completions" (
    "userId" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "correct" BOOLEAN,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("userId","tipId")
);

-- CreateIndex
CREATE INDEX "lesson_completions_userId_completedAt_idx" ON "lesson_completions"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_challenges_userId_challengeId_weekKey_key" ON "user_challenges"("userId", "challengeId", "weekKey");

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
