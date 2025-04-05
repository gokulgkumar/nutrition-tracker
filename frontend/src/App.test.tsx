// nutrition/frontend/src/App.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from './App'; 


describe('App Component', () => {
  beforeEach(() => {
    render(<App />);
  });

  it('should render the main heading', () => {

    expect(screen.getByRole('heading', { level: 1, name: /Nutrition Planner/i })).toBeInTheDocument(); 
  });

  it('should have an input field for calories', () => {

    const calorieInput = screen.getByLabelText(/Target Daily Calories/i);
    expect(calorieInput).toBeInTheDocument();
    expect(calorieInput).toHaveAttribute('type', 'text');
  });

  it('should update calorie input value on change', async () => {
    const user = userEvent.setup();
    const calorieInput = screen.getByLabelText(/Target Daily Calories/i);

    await user.clear(calorieInput);
    await user.type(calorieInput, '2000');

    expect(calorieInput).toHaveValue('2000');
  });

  it('should have a dropdown for dietary preference', () => {
    const preferenceSelect = screen.getByLabelText(/Dietary Preference/i);
    expect(preferenceSelect).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Balanced' })).toBeInTheDocument();
  });

  it('should have a submit button', () => {
    const submitButton = screen.getByRole('button', { name: /Create Meal Plan/i });
    expect(submitButton).toBeInTheDocument();
  });

});