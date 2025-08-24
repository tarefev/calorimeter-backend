-- CreateTable
CREATE TABLE "public"."AuthLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "providerId" VARCHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthLinkToken_token_key" ON "public"."AuthLinkToken"("token");

-- CreateIndex
CREATE INDEX "AuthLinkToken_userId_expiresAt_idx" ON "public"."AuthLinkToken"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "public"."AuthLinkToken" ADD CONSTRAINT "AuthLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
