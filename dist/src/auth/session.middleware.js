"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionMiddleware = sessionMiddleware;
const prismaClient_1 = require("@/prisma/prismaClient");
const session_cookie_1 = require("@/auth/session-cookie");
const BOT_TOKEN_HEADER = "x-bot-token";
const TG_USER_ID_HEADER = "x-telegram-user-id";
function sessionMiddleware() {
    return async function sessionHandler(req, res, next) {
        try {
            const sid = req.cookies?.[session_cookie_1.SESSION_COOKIE_NAME];
            const now = new Date();
            if (sid) {
                const session = await prismaClient_1.prisma.session.findUnique({
                    where: { id: sid },
                    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
                });
                if (session && !session.revokedAt && session.expiresAt > now) {
                    await prismaClient_1.prisma.session.update({
                        where: { id: sid },
                        data: { lastSeenAt: now },
                    });
                    req.user = { id: session.userId };
                    req.sessionId = sid;
                    return next();
                }
            }
            const botToken = (req.headers[BOT_TOKEN_HEADER] || "");
            const tgId = (req.headers[TG_USER_ID_HEADER] || "");
            if (botToken &&
                tgId &&
                process.env.BOT_TOKEN &&
                botToken === process.env.BOT_TOKEN) {
                const acct = await prismaClient_1.prisma.authAccount.findUnique({
                    where: {
                        provider_providerId: { provider: "telegram", providerId: tgId },
                    },
                    select: { userId: true },
                });
                let userId = acct?.userId;
                if (!userId) {
                    const fakeEmail = `tg-${tgId}@tg.local`;
                    const created = await prismaClient_1.prisma.$transaction(async (tx) => {
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
                const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
                const existing = await prismaClient_1.prisma.session.findFirst({
                    where: { userId, channel: "telegram" },
                    orderBy: { createdAt: "desc" },
                    select: { id: true },
                });
                let sessionId;
                if (existing) {
                    const updated = await prismaClient_1.prisma.session.update({
                        where: { id: existing.id },
                        data: { expiresAt: expires, revokedAt: null, lastSeenAt: now },
                        select: { id: true },
                    });
                    sessionId = updated.id;
                }
                else {
                    const created = await prismaClient_1.prisma.session.create({
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
        }
        catch (_) {
            return next();
        }
    };
}
//# sourceMappingURL=session.middleware.js.map