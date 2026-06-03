import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OcrParsedItem } from '@pantryai/shared';
import { ReceiptReviewModal } from '../ReceiptReviewModal';

const items: OcrParsedItem[] = [
  { name: 'Lait', quantity: 1, unit: 'L', confidence: 0.9 },
  { name: 'Pain', quantity: 2, confidence: 0.8 },
  { name: 'Sel', confidence: 0.3 },
];

function setup(onConfirm = vi.fn(), onCancel = vi.fn()) {
  render(
    <ReceiptReviewModal items={items} pending={false} onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { onConfirm, onCancel };
}

describe('ReceiptReviewModal', () => {
  it('renders every detected item checked by default', () => {
    setup();
    const boxes = screen.getAllByRole('checkbox');
    // 3 items + 1 "select all" toggle, all checked
    expect(boxes).toHaveLength(4);
    boxes.forEach((box) => expect(box).toBeChecked());
    expect(screen.getByText('Lait')).toBeInTheDocument();
  });

  it('flags low-confidence items', () => {
    setup();
    expect(screen.getByText('Low confidence')).toBeInTheDocument();
  });

  it('confirms all indices when nothing is unticked', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: /add 3 to stock/i }));
    expect(onConfirm).toHaveBeenCalledWith([0, 1, 2]);
  });

  it('excludes unticked items from the confirmed selection', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByLabelText(/Pain/));
    fireEvent.click(screen.getByRole('button', { name: /add 2 to stock/i }));
    expect(onConfirm).toHaveBeenCalledWith([0, 2]);
  });

  it('disables the confirm button when nothing is selected', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Select all')); // untick all
    expect(screen.getByRole('button', { name: /add 0 to stock/i })).toBeDisabled();
  });

  it('cancels on Escape', () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
