-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedLoginLockedUntil" TIMESTAMP(3);
