// nutrition-planner-frontend/src/App.tsx
import React, { useState } from 'react';
import './App.css';
interface Meal {
  meal: string;
  calories: number;
  ingredients: string[];
}

interface WorkoutRecommendation {
  workoutType: string;
  durationMinutes: number;
  intensity: string;
  estimatedCaloriesBurned: number;
  description: string;
}

interface MealPlan {
  meals: Meal[];
  totalCalories: number;
  workoutCaloriesBurned: number;
  workoutRecommendations?: WorkoutRecommendation[];
  nutrients?: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
  };
}

interface FormErrors {
  calories: string;
  adjustment: string;
}

function App() {
  const [calories, setCalories] = useState<string>('2000');
  const [dietaryPreference, setDietaryPreference] = useState<string>('balanced');
  const [adjustment, setAdjustment] = useState<string>('0');
  const [includeWorkout, setIncludeWorkout] = useState<boolean>(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formErrors, setFormErrors] = useState<FormErrors>({
    calories: '',
    adjustment: ''
  });

  const handleCaloriesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty input for typing or only numbers
    if (value === '' || /^\d+$/.test(value)) {
      setCalories(value);

      // Validate the range
      const newErrors = { ...formErrors };
      if (value !== '' && (parseInt(value) < 1000 || parseInt(value) > 5000)) {
        newErrors.calories = 'Please enter a value between 1000 and 5000 calories';
      } else {
        newErrors.calories = '';
      }
      setFormErrors(newErrors);
    }
  };

  const handleAdjustmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string, minus sign alone, or number with optional minus
    if (value === '' || value === '-' || /^-?\d+$/.test(value)) {
      setAdjustment(value);

      // Validate the range
      const newErrors = { ...formErrors };
      if (value !== '' && value !== '-' && (parseInt(value) < -500 || parseInt(value) > 500)) {
        newErrors.adjustment = 'Please enter a value between -500 and 500 calories';
      } else {
        newErrors.adjustment = '';
      }
      setFormErrors(newErrors);
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: FormErrors = {
      calories: '',
      adjustment: ''
    };

    // Validate calories
    if (!calories || calories === '') {
      newErrors.calories = 'Calories field is required';
      isValid = false;
    } else if (!/^\d+$/.test(calories)) {
      newErrors.calories = 'Calories must be a valid number';
      isValid = false;
    } else if (parseInt(calories) < 1000 || parseInt(calories) > 5000) {
      newErrors.calories = 'Please enter a value between 1000 and 5000 calories';
      isValid = false;
    }

    // Validate adjustment
    if (!/^-?\d+$/.test(adjustment)) {
      newErrors.adjustment = 'Adjustment must be a valid number';
      isValid = false;
    } else if (parseInt(adjustment) < -500 || parseInt(adjustment) > 500) {
      newErrors.adjustment = 'Please enter a value between -500 and 500 calories';
      isValid = false;
    }

    setFormErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}/nutrition/meal-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calories: parseInt(calories || '0'),
          dietaryPreference,
          adjustment: parseInt(adjustment || '0'),
          includeWorkout
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create meal plan');
      }

      setMealPlan(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Nutrition Planner</h1>
        <p>Create a personalized meal plan based on your caloric needs</p>
      </header>

      <main>
        <form onSubmit={handleSubmit} className="meal-plan-form">
          <div className="form-group">
            <label htmlFor="calories">Target Daily Calories:</label>
            <input
              type="text"
              id="calories"
              value={calories}
              onChange={handleCaloriesChange}
              placeholder="Enter calories (e.g. 2000)"
              className={formErrors.calories ? 'error-input' : ''}
              required
            />
            {formErrors.calories && <div className="input-error">{formErrors.calories}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="preference">Dietary Preference:</label>
            <select
              id="preference"
              value={dietaryPreference}
              onChange={(e) => setDietaryPreference(e.target.value)}
            >
              <option value="balanced">Balanced</option>
              <option value="high_protein">High Protein</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="keto">Keto</option>
              <option value="paleo">Paleo</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="adjustment">Caloric Adjustment:</label>
            <input
              type="text"
              id="adjustment"
              value={adjustment}
              onChange={handleAdjustmentChange}
              placeholder="e.g. -500, 0, 250"
              className={formErrors.adjustment ? 'error-input' : ''}
            />
            {formErrors.adjustment && <div className="input-error">{formErrors.adjustment}</div>}
            <span className="hint">Add/subtract calories for special activities</span>
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={includeWorkout}
                onChange={(e) => setIncludeWorkout(e.target.checked)}
              />
              Include Workout Recommendations
            </label>
          </div>

          <button type="submit" disabled={loading} className="submit-button">
            {loading ? 'Creating Plan...' : 'Create Meal Plan'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {mealPlan && (
          <div className="meal-plan">
            <h2>Your Personalized Meal Plan</h2>

            {mealPlan.nutrients && (
              <div className="nutrition-summary">
                <h3>Nutrition Summary</h3>
                <div className="nutrition-grid">
                  <div className="nutrition-item">
                    <span className="nutrient-label">Calories</span>
                    <span className="nutrient-value">{mealPlan.nutrients.calories}</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrient-label">Protein</span>
                    <span className="nutrient-value">{mealPlan.nutrients.protein}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrient-label">Carbs</span>
                    <span className="nutrient-value">{mealPlan.nutrients.carbohydrates}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrient-label">Fat</span>
                    <span className="nutrient-value">{mealPlan.nutrients.fat}g</span>
                  </div>
                </div>
              </div>
            )}

            <p className="total-calories">
              <strong>Total Calories:</strong> {mealPlan.totalCalories.toFixed(0)}
              {mealPlan.workoutCaloriesBurned > 0 && (
                <span className="workout-calories">
                  (Including {mealPlan.workoutCaloriesBurned} calories for workout)
                </span>
              )}
            </p>

            <div className="meals-container">
              {mealPlan.meals.map((meal, index) => (
                <div key={index} className="meal-card">
                  <h3>{meal.meal}</h3>
                  <p className="meal-calories">{meal.calories.toFixed(0)} calories</p>
                  <div className="ingredients">
                    <h4>Ingredients:</h4>
                    <ul>
                      {meal.ingredients.map((ingredient, i) => (
                        <li key={i}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {mealPlan.workoutRecommendations && mealPlan.workoutRecommendations.length > 0 && (
              <div className="workout-recommendations">
                <h2>Complementary Workout Plan</h2>
                <div className="workout-grid">
                  {mealPlan.workoutRecommendations.map((rec, index) => (
                    <div key={index} className="recommendation-card">
                      <h3>{rec.workoutType.charAt(0).toUpperCase() + rec.workoutType.slice(1)}</h3>
                      <p><strong>Duration:</strong> {rec.durationMinutes} minutes</p>
                      <p><strong>Intensity:</strong> {rec.intensity}</p>
                      <p><strong>Calories Burned:</strong> ~{rec.estimatedCaloriesBurned}</p>
                      <p>{rec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Nutrition Planner</p>
      </footer>
    </div>
  );
}

export default App;