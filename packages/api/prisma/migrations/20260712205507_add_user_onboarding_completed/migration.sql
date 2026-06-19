-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- Everyone who already has an account predates onboarding, so mark them all as
-- done. Only users created after this migration (flag still NULL) see the flow.
UPDATE "users" SET "onboardingCompletedAt" = now();
