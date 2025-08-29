// Helper aggregation functions for dayRecord mapper

type FoodItem = {
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  weightG?: number | null;
  kcalPer100G?: number | null;
  proteinPer100G?: number | null;
  fatPer100G?: number | null;
  carbsPer100G?: number | null;
};

type WaterItem = {
  amountMl?: number | null;
  liquidWaterL?: number | null; // possible legacy field
};

type ActivityItem = {
  steps?: number | null;
};

function safeNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function sumFoodTotals(items: FoodItem[] | undefined) {
  const res = {
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    food_weight_g: 0,
    food_items_count: 0,
  } as {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    food_weight_g: number;
    food_items_count: number;
  };

  if (!items || items.length === 0) return res;

  for (const it of items) {
    res.food_items_count += 1;
    const weight = safeNum(it.weightG);
    res.food_weight_g += weight;

    // calories: prefer explicit calories, else derive from kcalPer100G
    let kcal = safeNum(it.calories);
    if (!kcal && it.kcalPer100G)
      kcal = (safeNum(it.kcalPer100G) * weight) / 100;
    res.kcal += Math.round(kcal);

    // macros: prefer explicit grams, else derive from per100g
    let protein = safeNum(it.proteinG);
    if (!protein && it.proteinPer100G)
      protein = (safeNum(it.proteinPer100G) * weight) / 100;
    res.protein += Math.round(protein);

    let fat = safeNum(it.fatG);
    if (!fat && it.fatPer100G) fat = (safeNum(it.fatPer100G) * weight) / 100;
    res.fat += Math.round(fat);

    let carbs = safeNum(it.carbsG);
    if (!carbs && it.carbsPer100G)
      carbs = (safeNum(it.carbsPer100G) * weight) / 100;
    res.carbs += Math.round(carbs);
  }

  return res;
}

export function sumWaterTotals(items: WaterItem[] | undefined) {
  const res = { water_l: 0, liquid_water_l: 0 };
  if (!items || items.length === 0) return res;
  for (const it of items) {
    if (it.liquidWaterL !== undefined && it.liquidWaterL !== null) {
      res.liquid_water_l += safeNum(it.liquidWaterL);
      res.water_l += safeNum(it.liquidWaterL);
      continue;
    }
    const ml = safeNum(it.amountMl);
    const l = ml / 1000;
    res.water_l += l;
    res.liquid_water_l += l;
  }

  // round to 2 decimals
  res.water_l = Math.round(res.water_l * 100) / 100;
  res.liquid_water_l = Math.round(res.liquid_water_l * 100) / 100;
  return res;
}

export function sumSteps(items: ActivityItem[] | undefined) {
  if (!items || items.length === 0) return 0;
  let total = 0;
  for (const it of items) total += safeNum(it.steps);
  return total;
}
