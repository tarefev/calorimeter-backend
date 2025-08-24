import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Patch,
  Res,
  Req,
} from "@nestjs/common";
import { Request, Response } from "express";
import { prisma } from "@/prisma/prismaClient";
import { hashPassword } from "@/auth/password.util";
import {
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/auth/session-cookie";
import { verifyPassword } from "@/auth/password.util";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { RegisterDto } from "@/auth/dto/register.dto";
import { ChangePasswordDto } from "@/auth/dto/change-password.dto";
import { rateLimiter } from "@/auth/rate-limiter";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  @Post("register")
  @HttpCode(201)
  @ApiOperation({ summary: "Register new user (local)" })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: "User created" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "Email already in use" })
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    // DTO validation via class-validator/class-transformer
    // minimal password rule: non-empty
    const exists = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      return res.status(409).json({ message: "email already in use" });
    }
    const passwordHash = await hashPassword(dto.password);
    // create user + authAccount in transaction
    const user = await prisma.$transaction(async (tx) => {
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
    // create session
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        channel: "web",
        expiresAt: expires,
      },
      select: { id: true },
    });
    // reset failedLoginCount on successful login
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, failedLoginLockedUntil: null } as any,
      });
    } catch (e) {}
    setSessionCookie(res, session.id, {
      maxAgeMs: expires.getTime() - Date.now(),
    });
    return res.json({ id: user.id, email: user.email });
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Login (local)" })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 200, description: "Authenticated" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() dto: RegisterDto, @Res() res: Response) {
    // DTO validation via class-validator/class-transformer
    // rate limit by IP
    const ip =
      (res.req as any).socket?.remoteAddress ||
      (res.req as any).ip ||
      "unknown";
    const ipCheck = rateLimiter.consumeIp(ip);
    if (!ipCheck.allowed)
      return res.status(429).json({
        message: "too_many_requests",
        retryAfter: ipCheck.retryAfterSec,
      });

    // find local auth account
    const acct = await prisma.authAccount.findUnique({
      where: {
        provider_providerId: { provider: "local", providerId: dto.email },
      },
      select: { id: true, passwordHash: true, userId: true },
    });
    if (!acct || !acct.passwordHash)
      return res.status(401).json({ message: "invalid credentials" });

    // check DB-backed lock
    const LOCK_THRESHOLD = 6;
    const LOCK_MS = 60 * 60 * 1000; // 1 hour
    const maybeUser = await prisma.user.findUnique({
      where: { id: acct.userId },
      select: { failedLoginLockedUntil: true },
    });
    if (
      maybeUser?.failedLoginLockedUntil &&
      maybeUser.failedLoginLockedUntil > new Date()
    ) {
      return res.status(429).json({ message: "too_many_requests" });
    }

    const ok = await verifyPassword(dto.password, acct.passwordHash);
    if (!ok) {
      // increment failedLoginCount and possibly lock account
      try {
        const updated = await prisma.user.update({
          where: { id: acct.userId },
          data: { failedLoginCount: { increment: 1 } as any },
          select: { failedLoginCount: true },
        });
        if (updated.failedLoginCount >= LOCK_THRESHOLD) {
          await prisma.user.update({
            where: { id: acct.userId },
            data: {
              failedLoginLockedUntil: new Date(Date.now() + LOCK_MS),
            } as any,
          });
          return res.status(429).json({ message: "too_many_requests" });
        }
      } catch (e) {}
      return res.status(401).json({ message: "invalid credentials" });
    }
    const user = await prisma.user.findUnique({ where: { id: acct.userId } });
    if (!user) return res.status(401).json({ message: "invalid credentials" });

    // reset failedLoginCount on successful login
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, failedLoginLockedUntil: null } as any,
      });
    } catch (e) {}

    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        channel: "web",
        expiresAt: expires,
      },
      select: { id: true },
    });
    setSessionCookie(res, session.id, {
      maxAgeMs: expires.getTime() - Date.now(),
    });
    return res.json({ id: user.id, email: user.email });
  }

  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Logout (revoke current session)" })
  @ApiResponse({ status: 204, description: "Logged out" })
  async logout(@Req() req: Request, @Res() res: Response) {
    try {
      const sid = (req as any).cookies?.[SESSION_COOKIE_NAME] || undefined;
      if (sid) {
        await prisma.session.updateMany({
          where: { id: sid },
          data: { revokedAt: new Date() },
        });
      }
    } catch (e) {
      // ignore errors during logout
    }
    clearSessionCookie(res);
    return res.status(204).send();
  }

  @Post("logout/all")
  @HttpCode(204)
  @ApiOperation({ summary: "Logout all sessions (revoke all user's sessions)" })
  @ApiResponse({ status: 204, description: "All sessions revoked" })
  @ApiResponse({ status: 401, description: "Unauthenticated" })
  async logoutAll(@Req() req: Request, @Res() res: Response) {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    try {
      await prisma.session.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });
    } catch (e) {
      // ignore errors during logout-all
    }

    // clear cookie on web clients
    clearSessionCookie(res);
    return res.status(204).send();
  }

  @Get("me")
  @ApiOperation({ summary: "Get current user (web session or bot headers)" })
  @ApiResponse({ status: 200, description: "Returns user info" })
  @ApiResponse({ status: 401, description: "Unauthenticated" })
  async me(@Req() req: Request, @Res() res: Response) {
    // web session populated by middleware
    const userId = (req as any).user?.id as string | undefined;
    if (userId) {
      const user = await prisma.user.findUnique({
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
      if (!user) return res.status(404).json({ message: "not found" });
      return res.json({ user });
    }

    // bot auth by headers
    const botToken = req.headers["x-bot-token"] as string | undefined;
    const tgId = req.headers["x-telegram-user-id"] as string | undefined;
    if (botToken && tgId) {
      // validate bot token (simple compare with env for now)
      if (botToken !== process.env.BOT_TOKEN)
        return res.status(401).json({ message: "invalid bot token" });
      // lookup by auth account provider=telegram
      let acct = await prisma.authAccount.findUnique({
        where: {
          provider_providerId: { provider: "telegram", providerId: tgId },
        },
        select: { userId: true },
      });
      let user = null;
      if (acct) {
        user = await prisma.user.findUnique({
          where: { id: acct.userId },
          select: { id: true, email: true, telegramId: true, profile: true },
        });
      } else {
        // create user and auth account without local password
        const fakeEmail = `tg-${tgId}@tg.local`;
        const created = await prisma.$transaction(async (tx) => {
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
        user = await prisma.user.findUnique({
          where: { id: created.id },
          select: { id: true, email: true, telegramId: true, profile: true },
        });
      }
      return res.json({ user });
    }

    return res.status(401).json({ message: "unauthenticated" });
  }

  @Patch("password")
  @HttpCode(200)
  @ApiOperation({ summary: "Change password (rotate)" })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: "Password changed" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async changePassword(
    @Req() req: Request,
    @Body() body: ChangePasswordDto,
    @Res() res: Response
  ) {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    const oldPassword = body?.oldPassword;
    const newPassword = body?.newPassword;
    if (!oldPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "oldPassword and newPassword are required" });

    // find local auth account for the user
    const acct = await prisma.authAccount.findFirst({
      where: { userId, provider: "local" },
      select: { id: true, passwordHash: true },
    });
    if (!acct || !acct.passwordHash)
      return res.status(400).json({ message: "no local password set" });

    const ok = await verifyPassword(oldPassword, acct.passwordHash);
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    const newHash = await hashPassword(newPassword);

    // rotate password, revoke existing sessions and create a new one
    let newSessionId: string;
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await prisma.$transaction(async (tx) => {
      await tx.authAccount.update({
        where: { id: acct.id },
        data: { passwordHash: newHash },
      });
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      // revoke all sessions for user
      await tx.session.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });

      const session = await tx.session.create({
        data: { userId, channel: "web", expiresAt: expires },
        select: { id: true },
      });
      newSessionId = session.id;
    });

    // set cookie for newly created session
    setSessionCookie(res, newSessionId!, {
      maxAgeMs: expires.getTime() - Date.now(),
    });

    return res.json({ id: userId });
  }

  @Post("link-token")
  @ApiOperation({ summary: "Create one-time token for Telegram linking" })
  @ApiResponse({ status: 200, description: "Token created" })
  @ApiResponse({ status: 401, description: "Unauthenticated" })
  async createLinkToken(@Req() req: Request, @Res() res: Response) {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ message: "unauthenticated" });

    // generate short token
    const token = Math.random().toString(36).slice(2, 8).toUpperCase(); // 6 chars
    const expires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    const link = await prisma.authLinkToken.create({
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

  @Post("link/confirm")
  @ApiOperation({
    summary: "Confirm link token from bot and attach Telegram account",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        token: { type: "string" },
        telegramUserId: { type: "string" },
      },
      required: ["token", "telegramUserId"],
    },
  })
  @ApiResponse({ status: 200, description: "Linked successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 401, description: "Invalid bot token" })
  @ApiResponse({ status: 404, description: "Token not found" })
  @ApiResponse({ status: 409, description: "Telegram already linked" })
  async confirmLink(
    @Req() req: Request,
    @Body() body: { token?: string; telegramUserId?: string },
    @Res() res: Response
  ) {
    const botToken = req.headers["x-bot-token"] as string | undefined;
    if (!botToken || botToken !== process.env.BOT_TOKEN)
      return res.status(401).json({ message: "invalid bot token" });

    const token = body?.token;
    const tgId = body?.telegramUserId;
    if (!token || !tgId)
      return res
        .status(400)
        .json({ message: "token and telegramUserId required" });

    const link = await prisma.authLinkToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!link) return res.status(404).json({ message: "token not found" });
    if (link.usedAt)
      return res.status(410).json({ message: "token already used" });
    if (link.expiresAt < new Date())
      return res.status(410).json({ message: "token expired" });

    // ensure telegram account not already linked
    const existing = await prisma.authAccount.findUnique({
      where: {
        provider_providerId: { provider: "telegram", providerId: tgId },
      },
    });
    if (existing)
      return res
        .status(409)
        .json({ message: "telegram account already linked" });

    // create auth account and mark token used
    await prisma.$transaction(async (tx) => {
      await tx.authAccount.create({
        data: { userId: link.userId, provider: "telegram", providerId: tgId },
      });
      await tx.authLinkToken.update({
        where: { id: link.id },
        data: { usedAt: new Date(), providerId: tgId },
      });
    });

    const user = await prisma.user.findUnique({
      where: { id: link.userId },
      select: { id: true, email: true },
    });
    return res.json({ user });
  }
}
