import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";
import { Logger } from "nestjs-pino";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap application", err);
  process.exit(1);
});
