import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepProgress } from '../StepProgress';

describe('StepProgress', () => {
  it('exposes the step position as a progressbar', () => {
    render(<StepProgress stepIndex={1} totalSteps={3} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAccessibleName('Step 2 of 3');
  });
});
