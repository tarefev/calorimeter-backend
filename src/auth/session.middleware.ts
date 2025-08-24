import { NextFunction, Request, Response } from "express";
import { prisma } from "@/prisma/prismaClient";
import { SESSION_COOKIE_NAME } from "@/auth/session-cookie";

// Environment bot token header name
const BOT_TOKEN_HEADER = "x-bot-token";
const TG_USER_ID_HEADER = "x-telegram-user-id";

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
  sessionId?: string;
}

export function sessionMiddleware() {
  return async function sessionHandler(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // 1) Try web cookie session
      const sid = (req as any).cookies?.[SESSION_COOKIE_NAME];
      const now = new Date();

      if (sid) {
        const session = await prisma.session.findUnique({
          where: { id: sid },
          select: { id: true, userId: true, revokedAt: true, expiresAt: true },
        });

        if (session && !session.revokedAt && session.expiresAt > now) {
          // touch lastSeenAt
          await prisma.session.update({
            where: { id: sid },
            data: { lastSeenAt: now },
          });
          req.user = { id: session.userId };
          req.sessionId = sid;
          return next();
        }
      }

      // 2) Try bot headers (Telegram): X-Bot-Token + X-Telegram-User-Id
      const botToken = (req.headers[BOT_TOKEN_HEADER] || "") as string;
      const tgId = (req.headers[TG_USER_ID_HEADER] || "") as string;
      if (
        botToken &&
        tgId &&
        process.env.BOT_TOKEN &&
        botToken === process.env.BOT_TOKEN
      ) {
        // find existing authAccount with provider=telegram
        const acct = await prisma.authAccount.findUnique({
          where: {
            provider_providerId: { provider: "telegram", providerId: tgId },
          },
          select: { userId: true },
        });

        let userId: string | undefined = acct?.userId;
        if (!userId) {
          // create minimal user + authAccount
          const fakeEmail = `tg-${tgId}@tg.local`;
          const created = await prisma.$transaction(async (tx) => {
            const u = await tx.user.create({
              data: { email: fakeEmail, passwordHash: "" },
            });
            await tx.authAccount.create({
              data: { userId: u.id, provider: "telegram", providerId: tgId },
            });
            return u;
          });
          userId = created.id;
        }

        // create or update a Session for telegram channel (no unique on userId+channel)
        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
        const existing = await prisma.session.findFirst({
          where: { userId, channel: "telegram" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        let sessionId: string;
        if (existing) {
          const updated = await prisma.session.update({
            where: { id: existing.id },
            data: { expiresAt: expires, revokedAt: null, lastSeenAt: now },
            select: { id: true },
          });
          sessionId = updated.id;
        } else {
          const created = await prisma.session.create({
            data: {
              userId,
              channel: "telegram",
              expiresAt: expires,
              lastSeenAt: now,
            },
            select: { id: true },
          });
          sessionId = created.id;
        }

        req.user = { id: userId };
        req.sessionId = sessionId;
        return next();
      }

      return next();
    } catch (_) {
      return next();
    }
  };
}
