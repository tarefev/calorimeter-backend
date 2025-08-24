(function () {
  const data = {
    dtype: "day_record_v1",
    metrics: {
      weight: 104.1,
    },
    activity: [],
    sleep: [],
    water: [],
    food: [],
    exercise: [],
    totals: {
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      food_weight_g: 0,
      food_items_count: 0,
      water_l: 0,
      liquid_water_l: 0,
      steps: 0,
      sleep_hours: 0,
      exercise_count: 0,
    },
    theoretical: {
      steps_burn_kcal: 0,
      net_deficit_kcal: 0,
      projected_weekly_kg: 0,
    },
  };

  window /** @type {any} */.__CALORIMETER_DATA =
    window /** @type {any} */.__CALORIMETER_DATA || {};
  window /** @type {any} */.__CALORIMETER_DATA["2025-08-24"] = data;
})();
