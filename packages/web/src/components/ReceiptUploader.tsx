'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';
import type { OcrJob } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const TERMINAL = ['COMPLETED', 'FAILED'] as const;

export function ReceiptUploader() {
  const inputId = useId();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      setProgress(0);
      return apiClient.scanReceipt(file, { onUploadProgress: setProgress });
    },
    onSuccess: ({ jobId: id }) => {
      setError(null);
      setJobId(id);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : 'Upload failed');
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

  // When the job completes, refresh the stock list so the new items appear.
  const jobStatus = job.data?.status;
  useEffect(() => {
    if (jobStatus === 'COMPLETED') {
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
    }
  }, [jobStatus, queryClient]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!ACCEPTED.includes(file.type)) {
        setError('Unsupported file type — use JPEG, PNG or WebP.');
        return;
      }
      setError(null);
      setJobId(null);
      upload.mutate(file);
    },
    [upload],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDragOver(false);
      handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  const uploading = upload.isPending;
  const status = job.data?.status;
  const polling = jobId !== null && status !== 'COMPLETED' && status !== 'FAILED';

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
        <span className="font-medium">Drag &amp; drop a receipt image here</span>
        <span className="text-sm text-slate-500">or click to choose a file (JPEG, PNG, WebP)</span>
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
            Uploading… {progress}%
          </label>
          <progress
            id="upload-progress"
            max={100}
            value={progress}
            aria-label="Upload progress"
            className="w-full"
          />
        </div>
      ) : null}

      {polling ? (
        <p role="status" className="text-sm text-slate-600">
          Processing receipt… (status: {status ?? 'PENDING'})
        </p>
      ) : null}

      {status === 'FAILED' ? (
        <p role="alert" className="text-sm text-expiry-expired">
          Receipt processing failed: {job.data?.error ?? 'unknown error'}
        </p>
      ) : null}

      {status === 'COMPLETED' ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm font-medium text-expiry-ok">
            Receipt processed — {job.data?.parsedItems?.length ?? 0} item(s) added to your stock.
          </p>
          {job.data?.parsedItems?.length ? (
            <ul className="list-inside list-disc text-sm text-slate-700">
              {job.data.parsedItems.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  {p.name}
                  {p.quantity ? ` — ${p.quantity}${p.unit ? ` ${p.unit}` : ''}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
