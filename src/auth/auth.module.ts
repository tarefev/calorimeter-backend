import { Module } from "@nestjs/common";
import { AuthController } from "@/auth/auth.controller";
import { SessionCleanupJob } from "@/auth/session.cleanup";

@Module({
  controllers: [AuthController],
  providers: [SessionCleanupJob],
})
export class AuthModule {}
