import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsInt,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

class FoodItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsInt()
  calories: number;

  @IsOptional()
  @IsInt()
  weightG?: number;

  @IsOptional()
  @IsString()
  time?: string; // HH:MM:SS

  @IsOptional()
  @IsObject()
  nutrients_per_100g?: Record<string, any>;
}

class WaterItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsInt()
  amountMl: number;

  @IsOptional()
  @IsString()
  time?: string;
}

class ActivityItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsInt()
  durationMin?: number;

  @IsOptional()
  @IsInt()
  calories?: number;
}

class MetricDto {
  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class CreateDayRecordDto {
  @IsNotEmpty()
  @IsString()
  dtype: string; // e.g. "day_record_v1"

  @IsNotEmpty()
  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @ValidateNested()
  @Type(() => MetricDto)
  metrics?: MetricDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodItemDto)
  food?: FoodItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaterItemDto)
  water?: WaterItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityItemDto)
  activity?: ActivityItemDto[];
}
