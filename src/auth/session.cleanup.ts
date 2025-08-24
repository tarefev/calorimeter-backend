import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@/prisma/prismaClient";

@Injectable()
export class SessionCleanupJob {
  private readonly logger = new Logger(SessionCleanupJob.name);

  // Runs every hour; can be adjusted via env in future
  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    const start = Date.now();
    const now = new Date();

    // delete expired sessions
    const expired = await prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // optionally: delete revoked sessions older than 30 days
    const revokedRetentionDays = Number(
      process.env.SESSION_REVOKED_RETENTION_DAYS || 30
    );
    const cutoff = new Date(
      now.getTime() - revokedRetentionDays * 24 * 60 * 60 * 1000
    );
    const revoked = await prisma.session.deleteMany({
      where: { revokedAt: { not: null, lt: cutoff } },
    });

    const ms = Date.now() - start;
    this.logger.log(
      `session cleanup done: expired=${expired.count}, revoked_old=${revoked.count}, ms=${ms}`
    );
  }
}
