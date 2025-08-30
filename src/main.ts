import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { Logger } from "nestjs-pino";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Global validation pipe: transform DTOs, strip unknown properties and return unified error format
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const formatted = errors.map((e) => ({
          field: e.property,
          errors: Object.values(e.constraints || {}),
        }));
        return new BadRequestException({
          message: "validation_error",
          errors: formatted,
        });
      },
    })
  );

  // Swagger setup
  const config = new (require("@nestjs/swagger").DocumentBuilder)()
    .setTitle("Calorimeter API")
    .setDescription("API for Calorimeter backend")
    .setVersion("1.0")
    .addTag("auth")
    .addTag("records")
    .addTag("water")
    .addTag("food")
    .addTag("activity")
    .addTag("exercise")
    .build();
  const document = require("@nestjs/swagger").SwaggerModule.createDocument(
    app,
    config
  );
  require("@nestjs/swagger").SwaggerModule.setup("api", app, document);

  app.enableCors({
    origin: ["https://daysnap.ru"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  });
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap application", err);
  process.exit(1);
});
