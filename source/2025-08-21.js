(function () {
  const data = {
    dtype: "day_record_v1",
    metrics: {
      weight: 104.5,
      waist: 110,
      chest: 105,
      hips: 109,
      leg_left: 64,
      leg_right: 63,
      neck: 44,
    },
    activity: [
      {
        date: "2025-08-21",
        steps: 7919,
      },
    ],
    sleep: [],
    water: [
      {
        date: "2025-08-21",
        time: "09:00:00",
        amount_l: 1.0,
      },
      {
        date: "2025-08-21",
        time: "09:00:00",
        amount_l: 0.25,
        note: "Стакан воды для кофе",
      },
    ],
    food: [
      {
        date: "2025-08-21",
        time: "09:00:00",
        name: "Сыр полутвёрдый",
        weight_g: 200,
        kcal: 700,
        nutrients_per_100g: {
          kcal: 350,
          protein: 25,
          fat: 27,
          carbs: 2,
        },
      },
      {
        date: "2025-08-21",
        time: "09:00:00",
        name: "Кофе 3 в 1",
        weight_g: 20,
        kcal: 80,
        nutrients_per_100g: {
          kcal: 400,
          protein: 2,
          fat: 6,
          carbs: 80,
        },
      },
    ],
    exercise: [],
    totals: {
      kcal: 780.0,
      protein: 50.4,
      fat: 55.2,
      carbs: 20.0,
      food_weight_g: 220,
      food_items_count: 2,
      water_l: 1.25,
      steps: 7919,
      sleep_hours: 0,
      exercise_count: 0,
    },
    theoretical: {
      steps_burn_kcal: 413.78,
      net_deficit_kcal: 1855.41,
      projected_weekly_kg: 1.69,
    },
  };

  window /** @type {any} */.__CALORIMETER_DATA =
    window /** @type {any} */.__CALORIMETER_DATA || {};
  window /** @type {any} */.__CALORIMETER_DATA["2025-08-21"] = data;
})();
