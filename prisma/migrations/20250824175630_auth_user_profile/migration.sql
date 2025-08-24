-- CreateTable
CREATE TABLE "public"."UserProfile" (
    "userId" TEXT NOT NULL,
    "heightCm" INTEGER,
    "targetWeightKg" DECIMAL(5,2),
    "age" INTEGER,
    "sex" VARCHAR(1),
    "activityLevel" VARCHAR(16),
    "tz" VARCHAR(64),
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "public"."UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
