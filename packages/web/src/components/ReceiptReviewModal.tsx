'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OcrParsedItem } from '@pantryai/shared';

interface ReceiptReviewModalProps {
  items: OcrParsedItem[];
  retailer?: string | undefined;
  pending: boolean;
  onConfirm: (indices: number[]) => void;
  onCancel: () => void;
}

/**
 * Review step shown after a receipt is parsed: every detected item is checked by default,
 * the user unticks anything they don't want, then confirms to add the selection to stock.
 */
export function ReceiptReviewModal({
  items,
  retailer,
  pending,
  onConfirm,
  onCancel,
}: ReceiptReviewModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Every item starts selected.
  const [selected, setSelected] = useState<Set<number>>(() => new Set(items.map((_, i) => i)));

  // Move focus into the dialog on open (RGAA / keyboard users).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((_, i) => i)),
    );
  }, [items]);

  const confirm = useCallback(() => {
    onConfirm([...selected].sort((a, b) => a - b));
  }, [onConfirm, selected]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-card bg-surface-card p-5 shadow-xl outline-none"
      >
        <header>
          <h2 id={titleId} className="text-lg font-bold">
            {t('receipt.reviewTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {retailer ? `${retailer} — ` : ''}
            {t('receipt.detected', { count: items.length })}
          </p>
        </header>

        {items.length === 0 ? (
          <p className="text-sm text-slate-600">{t('receipt.none')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                {t('receipt.selectAll')}
              </label>
              <span className="text-sm text-slate-500">
                {t('receipt.selectedCount', { count: selected.size })}
              </span>
            </div>

            <ul className="flex flex-col gap-1 overflow-y-auto">
              {items.map((item, i) => {
                const fieldId = `${titleId}-item-${i}`;
                return (
                  <li key={i}>
                    <label
                      htmlFor={fieldId}
                      className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-surface"
                    >
                      <input
                        id={fieldId}
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggle(i)}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{item.name}</span>
                        {item.quantity != null || item.unit ? (
                          <span className="text-slate-500">
                            {' '}
                            — {[item.quantity, item.unit].filter(Boolean).join(' ')}
                          </span>
                        ) : null}
                      </span>
                      {item.confidence < 0.5 ? (
                        <span className="rounded bg-expiry-soon-bg px-1.5 py-0.5 text-xs text-expiry-soon">
                          {t('receipt.lowConfidence')}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <footer className="flex justify-end gap-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 font-medium"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending || selected.size === 0}
            className="rounded-md bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60"
          >
            {pending ? t('receipt.adding') : t('receipt.addToStock', { count: selected.size })}
          </button>
        </footer>
      </div>
    </div>
  );
}
