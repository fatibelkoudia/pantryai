'use client';

import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';
import type { OcrJob, OcrParsedItem } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { ReceiptReviewModal } from '@/components/ReceiptReviewModal';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TERMINAL = ['COMPLETED', 'CONFIRMED', 'FAILED'] as const;

export function ReceiptUploader() {
  const { t } = useTranslation();
  const inputId = useId();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      setProgress(0);
      // autoCommit: false → the API parses the receipt but does NOT add items yet.
      // The user reviews and confirms a selection below.
      return apiClient.scanReceipt(file, { onUploadProgress: setProgress, autoCommit: false });
    },
    onSuccess: ({ jobId: id }) => {
      setError(null);
      setAddedCount(null);
      setJobId(id);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : t('receipt.uploadFailed'));
    },
  });

  const job = useQuery<OcrJob>({
    queryKey: ['ocr-job', jobId],
    queryFn: () => apiClient.getOcrJob(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL.includes(status as (typeof TERMINAL)[number]) ? false : 1500;
    },
  });

  const confirm = useMutation({
    mutationFn: (indices: number[]) => apiClient.confirmOcrJob(jobId as string, indices),
    onSuccess: ({ added }) => {
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
      setAddedCount(added);
      setJobId(null);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : t('receipt.confirmFailed'));
    },
  });

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!ACCEPTED.includes(file.type)) {
        setError(t('receipt.unsupported'));
        return;
      }
      setError(null);
      setJobId(null);
      upload.mutate(file);
    },
    [upload, t],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDragOver(false);
      handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  const closeReview = useCallback(() => {
    setJobId(null);
  }, []);

  const uploading = upload.isPending;
  const status = job.data?.status;
  const polling = jobId !== null && status !== 'COMPLETED' && status !== 'FAILED';
  const parsedItems: OcrParsedItem[] = job.data?.parsedItems ?? [];
  // Show the review modal once parsing completes; closing/confirming clears jobId, which hides it.
  const reviewing = jobId !== null && status === 'COMPLETED';

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-10 text-center ${
          dragOver ? 'border-brand bg-green-50' : 'border-border bg-surface-card'
        }`}
      >
        <span className="font-medium">{t('receipt.drop')}</span>
        <span className="text-sm text-slate-500">{t('receipt.orClick')}</span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={uploading}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-expiry-expired">
          {error}
        </p>
      ) : null}

      {uploading ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="upload-progress" className="text-sm text-slate-600">
            {t('receipt.uploading', { progress })}
          </label>
          <progress
            id="upload-progress"
            max={100}
            value={progress}
            aria-label={t('receipt.uploadProgressA11y')}
            className="w-full"
          />
        </div>
      ) : null}

      {polling ? (
        <p role="status" className="text-sm text-slate-600">
          {t('receipt.processing', { status: status ?? 'PENDING' })}
        </p>
      ) : null}

      {status === 'FAILED' ? (
        <p role="alert" className="text-sm text-expiry-expired">
          {t('receipt.failed', { error: job.data?.error ?? t('common.unknownError') })}
        </p>
      ) : null}

      {addedCount !== null ? (
        <p role="status" className="text-sm font-medium text-expiry-ok">
          {t('receipt.added', { count: addedCount })}
        </p>
      ) : null}

      {reviewing ? (
        <ReceiptReviewModal
          items={parsedItems}
          retailer={job.data?.retailer}
          pending={confirm.isPending}
          onConfirm={(indices) => confirm.mutate(indices)}
          onCancel={closeReview}
        />
      ) : null}
    </div>
  );
}
