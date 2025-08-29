-- CreateTable
CREATE TABLE "public"."DayRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Metric" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "weightKg" DECIMAL(6,2),
    "bodyFatPct" DECIMAL(5,2),
    "caloriesIn" INTEGER,
    "caloriesOut" INTEGER,
    "proteinG" INTEGER,
    "carbsG" INTEGER,
    "fatG" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Water" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "notedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeLocal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Water_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Food" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteinG" INTEGER,
    "carbsG" INTEGER,
    "fatG" INTEGER,
    "kcalPer100G" DECIMAL(8,2),
    "proteinPer100G" DECIMAL(8,2),
    "fatPer100G" DECIMAL(8,2),
    "carbsPer100G" DECIMAL(8,2),
    "weightG" INTEGER,
    "notedAt" TIMESTAMP(3),
    "timeLocal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "durationMin" INTEGER,
    "calories" INTEGER,
    "intensity" VARCHAR(16),
    "notedAt" TIMESTAMP(3),
    "timeLocal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exercise" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "weightKg" DECIMAL(6,2),
    "durationMin" INTEGER,
    "calories" INTEGER,
    "notedAt" TIMESTAMP(3),
    "timeLocal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sleep" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "startLocal" TEXT,
    "endLocal" TEXT,
    "quality" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sleep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayRecord_userId_date_idx" ON "public"."DayRecord"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayRecord_userId_date_key" ON "public"."DayRecord"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Metric_dayRecordId_key" ON "public"."Metric"("dayRecordId");

-- CreateIndex
CREATE INDEX "Water_dayRecordId_idx" ON "public"."Water"("dayRecordId");

-- CreateIndex
CREATE INDEX "Food_dayRecordId_idx" ON "public"."Food"("dayRecordId");

-- CreateIndex
CREATE INDEX "Activity_dayRecordId_idx" ON "public"."Activity"("dayRecordId");

-- CreateIndex
CREATE INDEX "Exercise_dayRecordId_idx" ON "public"."Exercise"("dayRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Sleep_dayRecordId_key" ON "public"."Sleep"("dayRecordId");

-- AddForeignKey
ALTER TABLE "public"."DayRecord" ADD CONSTRAINT "DayRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Metric" ADD CONSTRAINT "Metric_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "public"."DayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Water" ADD CONSTRAINT "Water_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "public"."DayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Food" ADD CONSTRAINT "Food_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "public"."DayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "public"."DayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exercise" ADD CONSTRAINT "Exercise_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "public"."DayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sleep" ADD CONSTRAINT "Sleep_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "public"."DayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
