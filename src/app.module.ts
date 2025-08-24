import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "@/health/health.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
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
          "res.headers[set-cookie]",
        ],
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
