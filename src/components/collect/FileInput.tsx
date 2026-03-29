'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';

interface UploadResult {
  fileId: string;
  filename: string;
  mimeType: string;
  extractedText?: string;
  analysis?: string;
}

interface FileInputProps {
  onUpload: (file: File) => Promise<UploadResult>;
  disabled: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = 'image/*,.pdf,.txt,.md';

export default function FileInput({ onUpload, disabled }: FileInputProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback((file: File) => {
    setError(null);
    setUploadResult(null);

    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 10MB 이하여야 합니다.');
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }

  function handleZoneClick() {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  }

  async function handleUpload() {
    if (!selectedFile || disabled || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await onUpload(selectedFile);
      setUploadResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다.';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveFile() {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼';
    if (mimeType === 'application/pdf') return '📄';
    return '📝';
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  // After successful upload, show the result
  if (uploadResult) {
    const resultPreview = uploadResult.analysis ?? uploadResult.extractedText;

    return (
      <div className="flex w-full flex-col gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50/50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-4.5 w-4.5 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-emerald-800">
                업로드 완료
              </span>
              <p className="text-xs text-emerald-600">{uploadResult.filename}</p>
            </div>
          </div>
          {resultPreview && (
            <p className="rounded-xl bg-white/70 p-3.5 text-xs leading-relaxed text-text-secondary">
              {truncateText(resultPreview, 200)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Drag-and-drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleZoneClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleZoneClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-200 ${
          disabled || isUploading
            ? 'cursor-not-allowed border-border-default bg-surface-secondary opacity-50'
            : isDragOver
              ? 'border-zinc-400 bg-zinc-50 shadow-lg shadow-zinc-900/10'
              : selectedFile
                ? 'border-zinc-300 bg-zinc-50/30'
                : 'border-border-default bg-surface-primary hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md hover:shadow-zinc-900/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {selectedFile ? (
          /* File selected state */
          <div className="flex w-full flex-col items-center gap-4">
            {preview ? (
              /* Image thumbnail */
              <div className="relative h-28 w-28 overflow-hidden rounded-xl shadow-md ring-2 ring-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={selectedFile.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              /* File type icon */
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-2xl shadow-sm">
                {getFileIcon(selectedFile.type)}
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-text-primary">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-tertiary transition-all duration-200 hover:bg-red-50 hover:text-red-500"
            >
              파일 변경
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 transition-colors duration-200 group-hover:bg-zinc-200">
              <svg
                className="h-7 w-7 text-zinc-400 transition-colors duration-200 group-hover:text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text-primary">
                파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="mt-1.5 text-xs text-text-tertiary">
                PDF, 이미지, 텍스트 (최대 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
          <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {error}
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!selectedFile || disabled || isUploading}
        className="group/btn relative self-end overflow-hidden rounded-2xl bg-zinc-900 px-8 py-3.5 text-base font-medium text-text-inverse shadow-md shadow-zinc-900/15 transition-all duration-200 hover:bg-zinc-800 hover:shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100"
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            업로드 중...
          </span>
        ) : (
          <>
            <span className="relative z-10">업로드</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover/btn:translate-x-full" />
          </>
        )}
      </button>
    </div>
  );
}
