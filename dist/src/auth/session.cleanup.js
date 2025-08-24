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
var SessionCleanupJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCleanupJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prismaClient_1 = require("@/prisma/prismaClient");
let SessionCleanupJob = SessionCleanupJob_1 = class SessionCleanupJob {
    constructor() {
        this.logger = new common_1.Logger(SessionCleanupJob_1.name);
    }
    async handleCleanup() {
        const start = Date.now();
        const now = new Date();
        const expired = await prismaClient_1.prisma.session.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        const revokedRetentionDays = Number(process.env.SESSION_REVOKED_RETENTION_DAYS || 30);
        const cutoff = new Date(now.getTime() - revokedRetentionDays * 24 * 60 * 60 * 1000);
        const revoked = await prismaClient_1.prisma.session.deleteMany({
            where: { revokedAt: { not: null, lt: cutoff } },
        });
        const ms = Date.now() - start;
        this.logger.log(`session cleanup done: expired=${expired.count}, revoked_old=${revoked.count}, ms=${ms}`);
    }
};
exports.SessionCleanupJob = SessionCleanupJob;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SessionCleanupJob.prototype, "handleCleanup", null);
exports.SessionCleanupJob = SessionCleanupJob = SessionCleanupJob_1 = __decorate([
    (0, common_1.Injectable)()
], SessionCleanupJob);
//# sourceMappingURL=session.cleanup.js.map