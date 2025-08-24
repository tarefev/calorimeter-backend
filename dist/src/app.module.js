"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const node_crypto_1 = require("node:crypto");
const nestjs_pino_1 = require("nestjs-pino");
const health_module_1 = require("@/health/health.module");
const metrics_module_1 = require("@/metrics/metrics.module");
const auth_module_1 = require("@/auth/auth.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    level: process.env.NODE_ENV === "production" ? "info" : "debug",
                    genReqId: (req, res) => {
                        const incoming = req.headers["x-request-id"] ?? undefined;
                        const id = incoming && incoming.length > 0 ? incoming : (0, node_crypto_1.randomUUID)();
                        try {
                            res.setHeader("X-Request-Id", id);
                        }
                        catch { }
                        return id;
                    },
                    transport: process.env.NODE_ENV === "production"
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
                    customProps: (req) => ({ requestId: req.id }),
                },
            }),
            health_module_1.HealthModule,
            metrics_module_1.MetricsModule,
            auth_module_1.AuthModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map