// nutrition-planner-lambda/index.js
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

    // Generate meal plan
    const mealPlan = generateMealPlan(
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
    console.error('Error:', error); // Kept console.error for debugging
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
    console.error('Spoonacular API error:', error); // Kept console.error
    // Return mock data if API fails
    return {
      meals: [
        { name: 'Breakfast', options: ['Oatmeal', 'Smoothie', 'Avocado Toast'] },
        { name: 'Lunch', options: ['Salad', 'Soup', 'Sandwich'] },
        { name: 'Dinner', options: ['Pasta', 'Rice Bowl', 'Curry'] },
        { name: 'Snack', options: ['Fruit', 'Nuts', 'Yogurt'] }
      ]
    };
  }
}

// Map dietary preferences to Spoonacular API diet parameters
function mapDietaryPreferenceToSpoonacular(preference) {
  const mapping = {
    'balanced': 'balanced',
    'high_protein': 'high-protein',
    'keto': 'ketogenic',
    'vegetarian': 'vegetarian',
    'vegan': 'vegan',
    'paleo': 'paleo'
  };

  return mapping[preference] || 'balanced';
}

function transformSpoonacularResponse(data) {
  // Extract meals from response
  const meals = data.meals || [];
  const nutrients = data.nutrients || {};

  // Get meal names and IDs to fetch additional details if needed
  const breakfast = meals.find(meal => meal.slot === 1) || { title: 'Breakfast' };
  const lunch = meals.find(meal => meal.slot === 2) || { title: 'Lunch' };
  const dinner = meals.find(meal => meal.slot === 3) || { title: 'Dinner' };
    
  // Include any options from Spoonacular's returned meals
  return {
    meals: [
      { name: 'Breakfast', options: [breakfast.title || 'Balanced Breakfast'] },
      { name: 'Lunch', options: [lunch.title || 'Healthy Lunch'] },
      { name: 'Dinner', options: [dinner.title || 'Nutritious Dinner'] },
      { name: 'Snack', options: ['Fruit', 'Nuts', 'Yogurt'] } // Spoonacular doesn't always include snacks
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

function generateMealPlan(calories, preference, foodData) {
  // Generate meals based on preferences and calorie needs
  const meals = [];
  let remainingCalories = calories;

  // Breakfast (30% of calories)
  const breakfastCalories = Math.round(calories * 0.3);
  remainingCalories -= breakfastCalories;

  const breakfast = generateMeal(
    'Breakfast',
    breakfastCalories,
    preference,
    foodData.meals[0].options
  );
  meals.push(breakfast);

  // Lunch (30% of calories)
  const lunchCalories = Math.round(calories * 0.3);
  remainingCalories -= lunchCalories;

  const lunch = generateMeal(
    'Lunch',
    lunchCalories,
    preference,
    foodData.meals[1].options
  );
  meals.push(lunch);

  // Dinner (30% of calories)
  const dinnerCalories = Math.round(calories * 0.3);
  remainingCalories -= dinnerCalories;

  const dinner = generateMeal(
    'Dinner',
    dinnerCalories,
    preference,
    foodData.meals[2].options
  );
  meals.push(dinner);

  // Snack (10% of calories)
  const snack = generateMeal(
    'Snack',
    remainingCalories, // Use remaining calories for snack
    preference,
    foodData.meals[3].options
  );
  meals.push(snack);

  return {
    meals,
    nutrients: foodData.nutrients // Include nutrient information from Spoonacular if available
  };
}

function getDefaultIngredients(mealType, preference) {
  // Mock ingredients based on meal type and preference
  if (mealType === 'Breakfast') {
    if (preference === 'vegetarian' || preference === 'vegan') {
      return ['oats', 'almond milk', 'banana', 'chia seeds', 'berries'];
    } else if (preference === 'keto') {
      return ['eggs', 'avocado', 'spinach', 'feta cheese'];
    } else {
      return ['eggs', 'whole grain bread', 'avocado', 'tomatoes'];
    }
  } else if (mealType === 'Lunch' || mealType === 'Dinner') {
    if (preference === 'vegetarian') {
      return ['quinoa', 'bell peppers', 'chickpeas', 'feta', 'olive oil'];
    } else if (preference === 'vegan') {
      return ['brown rice', 'tofu', 'broccoli', 'carrots', 'soy sauce'];
    } else if (preference === 'keto') {
      return ['chicken breast', 'cauliflower rice', 'broccoli', 'cheese'];
    } else {
      return ['chicken breast', 'brown rice', 'broccoli', 'olive oil'];
    }
  } else { // Snack
    if (preference === 'vegetarian' || preference === 'vegan') {
      return ['almonds', 'apple', 'peanut butter'];
    } else if (preference === 'keto') {
      return ['string cheese', 'beef jerky'];
    } else {
      return ['greek yogurt', 'honey', 'granola'];
    }
  }
}

function generateMeal(mealType, calories, preference, options) {
  // Select a random meal option from available options
  const selectedOption = options[Math.floor(Math.random() * options.length)];

  // Get default ingredients based on meal type and preference
  const ingredients = getDefaultIngredients(mealType, preference);

  return {
    meal: selectedOption,
    calories,
    ingredients
  };
}

function formatResponse(statusCode, body) {
  return body;
}