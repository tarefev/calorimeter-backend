import { Module } from "@nestjs/common";
import { RecordsController } from "@/records/records.controller";
import { WaterController } from "@/records/water.controller";
import { FoodController } from "@/records/food.controller";
import { ActivityController } from "@/records/activity.controller";
import { ExerciseController } from "@/records/exercise.controller";

@Module({
  controllers: [
    RecordsController,
    WaterController,
    FoodController,
    ActivityController,
    ExerciseController,
  ],
})
export class RecordsModule {}
