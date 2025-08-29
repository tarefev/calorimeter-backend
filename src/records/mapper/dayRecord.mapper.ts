import { DayRecord as PrismaDayRecord } from "@prisma/client";
import {
  sumFoodTotals,
  sumWaterTotals,
  sumSteps,
} from "@/records/mapper/helpers";
import { generateEtag } from "@/records/utils/etag";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function mapDayRecordToJson(day: PrismaDayRecord & any) {
  if (!day) return null;

  const foodTotals = sumFoodTotals(day.food);
  const waterTotals = sumWaterTotals(day.water);
  const steps = sumSteps(day.activity);

  const totals = {
    kcal: foodTotals.kcal,
    protein: foodTotals.protein,
    fat: foodTotals.fat,
    carbs: foodTotals.carbs,
    food_weight_g: foodTotals.food_weight_g,
    food_items_count: foodTotals.food_items_count,
    water_l: waterTotals.water_l,
    liquid_water_l: waterTotals.liquid_water_l,
    steps: steps,
    sleep_hours: day.sleep
      ? Math.round(((day.sleep.durationMin || 0) / 60) * 100) / 100
      : 0,
  };

  const theoretical = {
    steps_burn_kcal: 0,
    net_deficit_kcal: 0,
    projected_weekly_kg: 0,
  };

  const out: any = {
    dtype: "day_record_v1",
    date: formatDate(day.date),
    metrics: day.metric || null,
    activity: day.activity || [],
    sleep: day.sleep || null,
    water: day.water || [],
    food: day.food || [],
    exercise: day.exercise || [],
    totals,
    theoretical,
    etag: generateEtag(
      day.updatedAt?.toISOString?.() || new Date().toISOString()
    ),
  };

  return out;
}
