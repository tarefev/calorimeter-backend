import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "@/health/health.module";
import { MetricsModule } from "@/metrics/metrics.module";
import { AuthModule } from "@/auth/auth.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        genReqId: (req, res) => {
          const incoming =
            (req.headers["x-request-id"] as string | undefined) ?? undefined;
          const id = incoming && incoming.length > 0 ? incoming : randomUUID();
          try {
            res.setHeader("X-Request-Id", id);
          } catch {}
          return id;
        },
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "SYS:standard",
                },
              },
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          'res.headers["set-cookie"]',
        ],
        customProps: (req) => ({ requestId: (req as any).id }),
      },
    }),
    HealthModule,
    MetricsModule,
    AuthModule,
  ],
})
export class AppModule {}
