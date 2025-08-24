"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const prismaClient_1 = require("@/prisma/prismaClient");
const password_util_1 = require("@/auth/password.util");
const session_cookie_1 = require("@/auth/session-cookie");
const password_util_2 = require("@/auth/password.util");
const swagger_1 = require("@nestjs/swagger");
let AuthController = class AuthController {
    async register(dto, res) {
        if (!dto?.email || !dto?.password) {
            return res
                .status(400)
                .json({ message: "email and password are required" });
        }
        const exists = await prismaClient_1.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (exists) {
            return res.status(409).json({ message: "email already in use" });
        }
        const passwordHash = await (0, password_util_1.hashPassword)(dto.password);
        const user = await prismaClient_1.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: { email: dto.email, passwordHash },
            });
            await tx.authAccount.create({
                data: {
                    userId: created.id,
                    provider: "local",
                    providerId: dto.email,
                    passwordHash,
                },
            });
            return created;
        });
        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        const session = await prismaClient_1.prisma.session.create({
            data: {
                userId: user.id,
                channel: "web",
                expiresAt: expires,
            },
            select: { id: true },
        });
        (0, session_cookie_1.setSessionCookie)(res, session.id, {
            maxAgeMs: expires.getTime() - Date.now(),
        });
        return res.json({ id: user.id, email: user.email });
    }
    async login(dto, res) {
        if (!dto?.email || !dto?.password) {
            return res
                .status(400)
                .json({ message: "email and password are required" });
        }
        const acct = await prismaClient_1.prisma.authAccount.findUnique({
            where: {
                provider_providerId: { provider: "local", providerId: dto.email },
            },
        });
        if (!acct || !acct.passwordHash)
            return res.status(401).json({ message: "invalid credentials" });
        const ok = await (0, password_util_2.verifyPassword)(dto.password, acct.passwordHash);
        if (!ok)
            return res.status(401).json({ message: "invalid credentials" });
        const user = await prismaClient_1.prisma.user.findUnique({ where: { id: acct.userId } });
        if (!user)
            return res.status(401).json({ message: "invalid credentials" });
        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        const session = await prismaClient_1.prisma.session.create({
            data: {
                userId: user.id,
                channel: "web",
                expiresAt: expires,
            },
            select: { id: true },
        });
        (0, session_cookie_1.setSessionCookie)(res, session.id, {
            maxAgeMs: expires.getTime() - Date.now(),
        });
        return res.json({ id: user.id, email: user.email });
    }
    async logout(req, res) {
        try {
            const sid = req.cookies?.[session_cookie_1.SESSION_COOKIE_NAME] || undefined;
            if (sid) {
                await prismaClient_1.prisma.session.updateMany({
                    where: { id: sid },
                    data: { revokedAt: new Date() },
                });
            }
        }
        catch (e) {
        }
        (0, session_cookie_1.clearSessionCookie)(res);
        return res.status(204).send();
    }
    async me(req, res) {
        const userId = req.user?.id;
        if (userId) {
            const user = await prismaClient_1.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    telegramId: true,
                    telegramUsername: true,
                    telegramLinkedAt: true,
                    profile: {
                        select: {
                            heightCm: true,
                            targetWeightKg: true,
                            age: true,
                            sex: true,
                            activityLevel: true,
                            tz: true,
                            updatedAt: true,
                        },
                    },
                },
            });
            if (!user)
                return res.status(404).json({ message: "not found" });
            return res.json({ user });
        }
        const botToken = req.headers["x-bot-token"];
        const tgId = req.headers["x-telegram-user-id"];
        if (botToken && tgId) {
            if (botToken !== process.env.BOT_TOKEN)
                return res.status(401).json({ message: "invalid bot token" });
            let acct = await prismaClient_1.prisma.authAccount.findUnique({
                where: {
                    provider_providerId: { provider: "telegram", providerId: tgId },
                },
                select: { userId: true },
            });
            let user = null;
            if (acct) {
                user = await prismaClient_1.prisma.user.findUnique({
                    where: { id: acct.userId },
                    select: { id: true, email: true, telegramId: true, profile: true },
                });
            }
            else {
                const fakeEmail = `tg-${tgId}@tg.local`;
                const created = await prismaClient_1.prisma.$transaction(async (tx) => {
                    const u = await tx.user.create({
                        data: {
                            email: fakeEmail,
                            passwordHash: "",
                            telegramId: tgId,
                            telegramLinkedAt: new Date(),
                        },
                    });
                    await tx.authAccount.create({
                        data: { userId: u.id, provider: "telegram", providerId: tgId },
                    });
                    return u;
                });
                user = await prismaClient_1.prisma.user.findUnique({
                    where: { id: created.id },
                    select: { id: true, email: true, telegramId: true, profile: true },
                });
            }
            return res.json({ user });
        }
        return res.status(401).json({ message: "unauthenticated" });
    }
    async createLinkToken(req, res) {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "unauthenticated" });
        const token = Math.random().toString(36).slice(2, 8).toUpperCase();
        const expires = new Date(Date.now() + 1000 * 60 * 10);
        const link = await prismaClient_1.prisma.authLinkToken.create({
            data: {
                userId,
                token,
                provider: "telegram",
                expiresAt: expires,
            },
            select: { token: true, expiresAt: true },
        });
        return res.json({ token: link.token, expiresAt: link.expiresAt });
    }
    async confirmLink(req, body, res) {
        const botToken = req.headers["x-bot-token"];
        if (!botToken || botToken !== process.env.BOT_TOKEN)
            return res.status(401).json({ message: "invalid bot token" });
        const token = body?.token;
        const tgId = body?.telegramUserId;
        if (!token || !tgId)
            return res
                .status(400)
                .json({ message: "token and telegramUserId required" });
        const link = await prismaClient_1.prisma.authLinkToken.findUnique({
            where: { token },
            select: { id: true, userId: true, expiresAt: true, usedAt: true },
        });
        if (!link)
            return res.status(404).json({ message: "token not found" });
        if (link.usedAt)
            return res.status(410).json({ message: "token already used" });
        if (link.expiresAt < new Date())
            return res.status(410).json({ message: "token expired" });
        const existing = await prismaClient_1.prisma.authAccount.findUnique({
            where: {
                provider_providerId: { provider: "telegram", providerId: tgId },
            },
        });
        if (existing)
            return res
                .status(409)
                .json({ message: "telegram account already linked" });
        await prismaClient_1.prisma.$transaction(async (tx) => {
            await tx.authAccount.create({
                data: { userId: link.userId, provider: "telegram", providerId: tgId },
            });
            await tx.authLinkToken.update({
                where: { id: link.id },
                data: { usedAt: new Date(), providerId: tgId },
            });
        });
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: link.userId },
            select: { id: true, email: true },
        });
        return res.json({ user });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)("register"),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)("login"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)("logout"),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)("me"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)("link-token"),
    (0, swagger_1.ApiOperation)({ summary: "Create one-time token for Telegram linking" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Token created" }),
    (0, swagger_1.ApiResponse)({ status: 401, description: "Unauthenticated" }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "createLinkToken", null);
__decorate([
    (0, common_1.Post)("link/confirm"),
    (0, swagger_1.ApiOperation)({
        summary: "Confirm link token from bot and attach Telegram account",
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: "object",
            properties: {
                token: { type: "string" },
                telegramUserId: { type: "string" },
            },
            required: ["token", "telegramUserId"],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Linked successfully" }),
    (0, swagger_1.ApiResponse)({ status: 400, description: "Bad request" }),
    (0, swagger_1.ApiResponse)({ status: 401, description: "Invalid bot token" }),
    (0, swagger_1.ApiResponse)({ status: 404, description: "Token not found" }),
    (0, swagger_1.ApiResponse)({ status: 409, description: "Telegram already linked" }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "confirmLink", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)("auth"),
    (0, common_1.Controller)("auth")
], AuthController);
//# sourceMappingURL=auth.controller.js.map