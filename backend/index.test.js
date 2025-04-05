const { handler } = require('./index');
const axios = require('axios');

jest.mock('axios');
process.env.SPOONACULAR_API_KEY = 'mock-key';
process.env.FITNESS_TRACKER_API_URL = 'mock-fitness-api-url';

describe('Backend Lambda Handler', () => {

  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
  });

  describe('Input Validation', () => {
    it('should return 400 if calories are missing', async () => {
      const event = { dietaryPreference: 'balanced' };
      const response = await handler(event);
      expect(response.error).toBe('Missing required parameters');
    });

    it('should return 400 if dietaryPreference is missing', async () => {
      const event = { calories: 2000 };
      const response = await handler(event);
      expect(response.error).toBe('Missing required parameters');
    });
  });

  describe('API Interaction and Meal Plan Generation', () => {
    it('should call Spoonacular and generate a plan without workout', async () => {
      const mockSpoonacularData = {
        meals: [
          { slot: 1, title: 'Mock Breakfast' },
          { slot: 2, title: 'Mock Lunch' },
          { slot: 3, title: 'Mock Dinner' }
        ],
        nutrients: { calories: 2000, protein: 100, fat: 70, carbohydrates: 210 }
      };
      axios.get.mockResolvedValue({ data: mockSpoonacularData });

      const event = { calories: 2000, dietaryPreference: 'balanced', includeWorkout: false };
      const response = await handler(event);

      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('https://api.spoonacular.com/mealplanner/generate'));
      expect(response.meals).toHaveLength(4);
      expect(response.nutrients).toEqual(mockSpoonacularData.nutrients);
      expect(response.workoutRecommendations).toBeUndefined();
      expect(response.workoutCaloriesBurned).toBe(0);
      expect(response.totalCalories).toBe(2000);
    });

    it('should call Spoonacular and Fitness API and generate a plan with workout', async () => {
      const mockSpoonacularData = {
        meals: [{ slot: 1, title: 'B' }, { slot: 2, title: 'L' }, { slot: 3, title: 'D' }],
        nutrients: { calories: 2500 }
      };
      const mockFitnessData = {
        recommendations: [
          { workoutType: 'cardio', estimatedCaloriesBurned: 300 },
          { workoutType: 'strength', estimatedCaloriesBurned: 200 }
        ]
      };
      axios.get.mockResolvedValue({ data: mockSpoonacularData });
      axios.post.mockResolvedValue({ data: mockFitnessData });

      const event = { calories: 2500, dietaryPreference: 'high_protein', includeWorkout: true };
      const response = await handler(event);

      const expectedBurned = 300 + 200;
      const expectedAdjustedCalories = 2500 + (expectedBurned * 0.8);

      expect(response.meals).toHaveLength(4);
      expect(response.workoutRecommendations).toEqual(mockFitnessData.recommendations);
      expect(response.workoutCaloriesBurned).toBe(expectedBurned);
      expect(response.totalCalories).toBeCloseTo(expectedAdjustedCalories);
    });

    it('should handle Spoonacular API failure gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Spoonacular API down'));
      axios.post.mockResolvedValue({ data: { recommendations: [] } });

      const event = { calories: 1800, dietaryPreference: 'vegan', includeWorkout: true };
      const response = await handler(event);

      expect(response.meals).toHaveLength(4);
    });

    it('should handle Fitness API failure gracefully', async () => {
      const mockSpoonacularData = { meals: [{ slot: 1, title: 'B' }], nutrients: {} };
      axios.get.mockResolvedValue({ data: mockSpoonacularData });
      axios.post.mockRejectedValue(new Error('Fitness API down'));

      const event = { calories: 1800, dietaryPreference: 'vegan', includeWorkout: true };
      const response = await handler(event);

      const expectedBurned = 300 + 200;
      const expectedAdjustedCalories = 1800 + (expectedBurned * 0.8);

      expect(response.workoutCaloriesBurned).toBe(expectedBurned);
      expect(response.totalCalories).toBeCloseTo(expectedAdjustedCalories);
    });
  });
});