(function () {
  const data = {
    dtype: "day_record_v1",
    metrics: {
      weight: 104.1,
    },
    activity: [
      {
        date: "2025-08-24",
        steps: 1669,
      },
    ],
    sleep: [],
    water: [
      {
        date: "2025-08-24",
        time: "00:00:00",
        name: "Вода (включая кофе/капучино не считаем)",
        is_liquid: true,
        liquid_water_l: 2.25,
        weight_g: 2250,
      },
    ],
    food: [
      {
        date: "2025-08-24",
        time: "08:00:00",
        name: "Рис с печенью, овощами и соусом",
        weight_g: 350,
        kcal: 560,
        nutrients_per_100g: {
          kcal: 160,
          protein: 8,
          fat: 5.14,
          carbs: 18.57,
        },
      },
      {
        date: "2025-08-24",
        time: "08:30:00",
        name: "Капучино",
        weight_g: 200,
        is_liquid: true,
        liquid_water_l: 0.2,
        kcal: 110,
        nutrients_per_100g: {
          kcal: 55,
          protein: 3,
          fat: 3,
          carbs: 4.5,
        },
      },
      {
        date: "2025-08-24",
        time: "13:00:00",
        name: "Манты (3 шт) + лечо (кусочки)",
        weight_g: 300,
        kcal: 610,
        nutrients_per_100g: {
          kcal: 203.33,
          protein: 8.33,
          fat: 8,
          carbs: 24.33,
        },
      },
      {
        date: "2025-08-24",
        time: "19:00:00",
        name: "Курица запечённая (180 г) + картофель (100 г) + овощи гриль (120 г)",
        weight_g: 400,
        kcal: 483,
        nutrients_per_100g: {
          kcal: 120.75,
          protein: 9,
          fat: 6,
          carbs: 7,
        },
      },
      {
        date: "2025-08-24",
        time: "16:00:00",
        name: "Кофе 3 в 1 (18 г)",
        weight_g: 18,
        kcal: 80,
        nutrients_per_100g: {
          kcal: 444.44,
          protein: 5.56,
          fat: 11.11,
          carbs: 83.33,
        },
      },
    ],
    exercise: [],
    totals: {
      kcal: 1843,
      protein: 96,
      fat: 74,
      carbs: 190,
      food_weight_g: 1068,
      food_items_count: 5,
      water_l: 2.25,
      liquid_water_l: 0.2,
      steps: 1669,
      sleep_hours: 0,
      exercise_count: 0,
    },
    theoretical: {
      steps_burn_kcal: 0,
      net_deficit_kcal: 0,
      projected_weekly_kg: 0,
    },
  };
})();
