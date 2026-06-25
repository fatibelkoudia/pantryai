import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountUp } from '../CountUp';

describe('CountUp', () => {
  it('counts up to the target value', async () => {
    const { container } = render(<CountUp to={30} suffix="kg" />);
    await waitFor(() => expect(container.textContent).toBe('30 kg'), { timeout: 4000 });
  });
});
