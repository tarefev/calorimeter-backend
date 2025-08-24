import { Module } from "@nestjs/common";
import { MetricsController } from "@/metrics/metrics.controller";

@Module({
  controllers: [MetricsController],
})
export class MetricsModule {}
