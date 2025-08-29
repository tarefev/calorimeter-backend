(function () {
  const data = {
    dtype: "day_record_v1",
    metrics: {
      weight: 104.1,
    },
    activity: [
      {
        date: "2025-08-26",
        // урок на мотоцикле — 2 часа, затрат ~200 ккал
        steps: 10261,
        notes: "motorcycle_lesson_2h_burn_200kcal",
      },
    ],
    sleep: [],
    water: [],
    food: [
      // Завтрак (кафе)
      {
        date: "2025-08-26",
        time: "08:00:00",
        name: "Кофе с молоком",
        weight_g: 100,
        kcal: 40,
        nutrients_per_100g: { kcal: 40, protein: 2, fat: 2, carbs: 3 },
      },
      {
        date: "2025-08-26",
        time: "08:10:00",
        name: "2 яйца (глазунья)",
        weight_g: 100,
        kcal: 143,
        nutrients_per_100g: { kcal: 143, protein: 12, fat: 10, carbs: 1 },
      },
      {
        date: "2025-08-26",
        time: "08:15:00",
        name: "2 сосиски",
        weight_g: 90,
        kcal: 270,
        nutrients_per_100g: {
          kcal: 300,
          protein: 11.11,
          fat: 26.67,
          carbs: 2.22,
        },
      },
      {
        date: "2025-08-26",
        time: "08:20:00",
        name: "Овощи (помидор, огурец)",
        weight_g: 80,
        kcal: 20,
        nutrients_per_100g: { kcal: 25, protein: 1.25, fat: 0, carbs: 5 },
      },
      {
        date: "2025-08-26",
        time: "08:30:00",
        name: "Тосты 2 шт",
        weight_g: 60,
        kcal: 160,
        nutrients_per_100g: {
          kcal: 266.67,
          protein: 10,
          fat: 3.33,
          carbs: 53.33,
        },
      },
      // Перекусы днём
      {
        date: "2025-08-26",
        time: "11:00:00",
        name: "Голубика",
        weight_g: 250,
        kcal: 143,
        nutrients_per_100g: { kcal: 57.2, protein: 0.8, fat: 0, carbs: 33 },
      },
      {
        date: "2025-08-26",
        time: "12:00:00",
        name: "Куриная грудка гриль",
        weight_g: 229,
        kcal: 277,
        nutrients_per_100g: {
          kcal: 120.96,
          protein: 22.7,
          fat: 2.62,
          carbs: 0,
        },
      },
      {
        date: "2025-08-26",
        time: "13:00:00",
        name: "Кальмар сушёный (стружка)",
        weight_g: 142,
        kcal: 428,
        nutrients_per_100g: {
          kcal: 301.41,
          protein: 69.72,
          fat: 4.93,
          carbs: 0,
        },
      },
      {
        date: "2025-08-26",
        time: "14:00:00",
        name: "Салат овощной",
        weight_g: 304,
        kcal: 213,
        nutrients_per_100g: {
          kcal: 70.07,
          protein: 1.64,
          fat: 3.95,
          carbs: 6.58,
        },
      },
      // Ужин (кафе)
      {
        date: "2025-08-26",
        time: "19:00:00",
        name: "Тёплый салат с курицей, грибами, соусом",
        weight_g: 320,
        kcal: 430,
        nutrients_per_100g: {
          kcal: 134.38,
          protein: 10,
          fat: 8.13,
          carbs: 3.75,
        },
      },
      {
        date: "2025-08-26",
        time: "19:30:00",
        name: "Айс-латте",
        weight_g: 250,
        kcal: 110,
        nutrients_per_100g: { kcal: 44, protein: 2, fat: 1.6, carbs: 4.8 },
      },
    ],
    exercise: [
      {
        date: "2025-08-26",
        name: "motorcycle_lesson",
        duration_min: 120,
        estimated_kcal: 200,
      },
    ],
    totals: {
      kcal: 2234,
      protein: 226,
      fat: 94,
      carbs: 119,
      food_weight_g: 0,
      food_items_count: 0,
      water_l: 0,
      liquid_water_l: 0,
      steps: 10261,
      sleep_hours: 0,
      exercise_count: 1,
    },
    theoretical: {
      steps_burn_kcal: 200,
      net_deficit_kcal: 2034,
      projected_weekly_kg: 0,
    },
  };
})();
