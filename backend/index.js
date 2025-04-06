const axios = require('axios');

exports.handler = async (event) => {
  try {
    // Parse request body
    const body = event;

    const { calories, dietaryPreference, adjustment = 0, includeWorkout = false } = body;

    // Basic validation
    if (!calories || !dietaryPreference) {
      return formatResponse(400, { error: 'Missing required parameters' });
    }

    // Get food data from Spoonacular API
    const foodData = await getFoodData(dietaryPreference, calories);

    // Get workout data from Fitness Tracker API
    let workoutData = null;
    if (includeWorkout) {
      workoutData = await getWorkoutData(calories, dietaryPreference);
    } else {
      // Default workout data when not fetching from API
      workoutData = {
        recommendations: []
      };
    }

    // Calculate adjusted calories based on workout
    const totalCaloriesBurned = workoutData.recommendations.reduce(
      (sum, workout) => sum + workout.estimatedCaloriesBurned, 0
    );
    const adjustedCalories = calories + adjustment + (totalCaloriesBurned * 0.8); // 80% of burned calories

    // Generate meal plan - Now async due to ingredient fetching
    const mealPlan = await generateMealPlan(
      adjustedCalories,
      dietaryPreference, 
      foodData
    );

    // Add workout recommendations to response if available
    if (workoutData.recommendations.length > 0) {
      mealPlan.workoutRecommendations = workoutData.recommendations;
    }

    mealPlan.workoutCaloriesBurned = totalCaloriesBurned;
    mealPlan.totalCalories = adjustedCalories;

    return formatResponse(201, mealPlan);
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(500, { error: 'Internal server error' });
  }
};

async function getFoodData(dietaryPreference, targetCalories) {
  try {
    // Spoonacular API - Get Meal Plan
    const apiKey = process.env.SPOONACULAR_API_KEY;
    const diet = mapDietaryPreferenceToSpoonacular(dietaryPreference);

    const url = `https://api.spoonacular.com/mealplanner/generate?apiKey=${apiKey}&timeFrame=day&targetCalories=${targetCalories}&diet=${diet}`;

    const response = await axios.get(url);

    // Transform the response
    return transformSpoonacularResponse(response.data);
  } catch (error) {
    console.error('Spoonacular API error (getFoodData):', error); 
    // Return mock data if API fails - including mock IDs for potential fallback
    return {
      meals: [
        { name: 'Breakfast', id: null, title: 'Oatmeal' }, 
        { name: 'Lunch', id: null, title: 'Salad' }, 
        { name: 'Dinner', id: null, title: 'Pasta' }, 
        { name: 'Snack', options: [ 'Fruit', 'Nuts', 'Yogurt' ] } 
      ],
      nutrients: {}
    };
  }
}

// Map dietary preferences to Spoonacular API diet parameters
function mapDietaryPreferenceToSpoonacular(preference) {
  const mapping = {
    'balanced': '', 
    'high_protein': 'high protein', 
    'keto': 'ketogenic',
    'vegetarian': 'vegetarian',
    'vegan': 'vegan',
    'paleo': 'paleo'
  };
  // Return the mapped preference, default to empty string if not found
  return mapping[preference] || '';
}

function transformSpoonacularResponse(data) {
  // Extract meals from response
  const meals = data.meals || [];
  const nutrients = data.nutrients || {};

  // Find meals by slot and extract ID and Title
  const breakfastData = meals[0];
  const lunchData = meals[1];
  const dinnerData = meals[2];

  // Prepare the meal structure, including ID and Title
  return {
    meals: [
      { name: 'Breakfast', id: breakfastData?.id, title: breakfastData?.title || 'Balanced Breakfast' },
      { name: 'Lunch', id: lunchData?.id, title: lunchData?.title || 'Healthy Lunch' },
      { name: 'Dinner', id: dinnerData?.id, title: dinnerData?.title || 'Nutritious Dinner' },
      { name: 'Snack', options: [ 'Fruit', 'Nuts', 'Yogurt' ] } // Keep snacks simple as before
    ],
    nutrients: nutrients // Keep the nutrient information for reference
  };
}

async function getWorkoutData(calories, dietaryPreference) {
  try {
    // Call to Fitness Tracker API
    const url = process.env.FITNESS_TRACKER_API_URL;

    // Map dietary preferences to fitness tracker goals
    const goalMapping = {
      'balanced': 'maintenance',
      'high_protein': 'muscle_gain',
      'keto': 'weight_loss',
      'vegetarian': 'maintenance',
      'vegan': 'maintenance',
      'paleo': 'weight_loss'
    };

    const response = await axios.post(`${url}/workout-recommendations`, {
      caloriesConsumed: calories,
      dietaryGoal: goalMapping[dietaryPreference] || 'maintenance',
    });

    return response.data;
  } catch (error) {
    console.error('Fitness API error:', error); // Kept console.error
    // Return default data if API fails
    return {
      recommendations: [
        { workoutType: 'cardio', estimatedCaloriesBurned: 300, durationMinutes: 30, intensity: 'moderate', description: 'Cardio workout to complement your meal plan.' },
        { workoutType: 'strength', estimatedCaloriesBurned: 200, durationMinutes: 25, intensity: 'moderate', description: 'Strength training focusing on major muscle groups.' }
      ]
    };
  }
}


async function generateMealPlan(calories, preference, foodData) {
  // Generate meals based on preferences and calorie needs
  const mealPromises = []; 
  let remainingCalories = calories;

  // Breakfast (30% of calories)
  const breakfastCalories = Math.round(calories * 0.3);
  remainingCalories -= breakfastCalories;
  const breakfastMealData = foodData.meals[0]; 
  mealPromises.push(generateMeal(
    breakfastMealData.name,
    breakfastCalories,
    preference,
    breakfastMealData.title,
    breakfastMealData.id 
  ));

  // Lunch (30% of calories)
  const lunchCalories = Math.round(calories * 0.3);
  remainingCalories -= lunchCalories;
  const lunchMealData = foodData.meals[1];
  mealPromises.push(generateMeal(
    lunchMealData.name,
    lunchCalories,
    preference,
    lunchMealData.title,
    lunchMealData.id 
  ));

  // Dinner (30% of calories)
  const dinnerCalories = Math.round(calories * 0.3);
  remainingCalories -= dinnerCalories;
  const dinnerMealData = foodData.meals[2]; 
  mealPromises.push(generateMeal(
    dinnerMealData.name,
    dinnerCalories,
    preference,
    dinnerMealData.title,
    dinnerMealData.id 
  ));

  // Snack (10% of calories) - Still uses options/fallback
  const snackMealData = foodData.meals[3]; // { name, options }
  mealPromises.push(generateMeal(
    snackMealData.name,
    remainingCalories, // Use remaining calories for snack
    preference,
    snackMealData.options[Math.floor(Math.random() * snackMealData.options.length)], // Select random snack option
    null 
  ));

  // Await all meal generation promises
  const meals = await Promise.all(mealPromises);

  return {
    meals,
    nutrients: foodData.nutrients // Include nutrient information from Spoonacular if available
  };
}

async function getIngredientsForMeal(mealId) {
  if (!mealId) {
    return [ 'Ingredient details not available' ];
  }

  try {
    const apiKey = process.env.SPOONACULAR_API_KEY;
    const url = `https://api.spoonacular.com/recipes/${mealId}/ingredientWidget.json?apiKey=${apiKey}`;

    const response = await axios.get(url);
    const ingredients = response.data?.ingredients || [];

    return ingredients.map(ing => {
        const amount = ing.amount?.us?.value || '';
        const unit = ing.amount?.us?.unit || '';
        const name = ing.name || 'Unknown ingredient';
        return `${amount} ${unit} ${name}`.trim();
    });

  } catch (error) {
    console.error(`Spoonacular API error (getIngredientsForMeal ${mealId}):`, error.response?.data || error.message);
    return [ 'Could not fetch ingredients' ];
  }
}

// Modified to fetch ingredients via API
async function generateMeal(mealType, calories, preference, selectedOption, mealId) {
  let ingredients = [];

  // Fetch ingredients from API if mealId is provided (i.e., for Breakfast, Lunch, Dinner)
  if (mealId) {
    ingredients = await getIngredientsForMeal(mealId);
  } else {
    // Fallback for snacks or if mealId wasn't available (e.g., API error in getFoodData)
    // Using a simple placeholder or could use preference for basic suggestion
    switch (mealType) {
    case 'Snack':
      ingredients = [ `${selectedOption} (approx. ${calories} kcal)` ];
      break;
    default:
      ingredients = [ 'Ingredient details unavailable' ];
    }
  }

  return {
    meal: selectedOption,
    calories,
    ingredients
  };
}

function formatResponse(statusCode, body) {
  return body;
}