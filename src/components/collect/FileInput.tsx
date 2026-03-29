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
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600"
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
            <span className="text-sm font-medium text-green-800">
              업로드 완료
            </span>
          </div>
          <p className="text-sm text-green-700">{uploadResult.filename}</p>
          {resultPreview && (
            <p className="mt-2 rounded-lg bg-white/60 p-3 text-xs leading-relaxed text-gray-600">
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
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition duration-200 ease-out ${
          disabled || isUploading
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50'
            : isDragOver
              ? 'border-blue-500 bg-blue-50'
              : selectedFile
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
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
          <div className="flex w-full flex-col items-center gap-3">
            {preview ? (
              /* Image thumbnail */
              <div className="relative h-24 w-24 overflow-hidden rounded-lg shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={selectedFile.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              /* File type icon */
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                {getFileIcon(selectedFile.type)}
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              className="text-xs text-gray-400 transition hover:text-red-500"
            >
              파일 변경
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-6 w-6 text-gray-400"
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
              <p className="text-sm font-medium text-gray-700">
                파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="mt-1 text-xs text-gray-400">
                PDF, 이미지, 텍스트 (최대 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!selectedFile || disabled || isUploading}
        className="self-end rounded-xl bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-sm transition duration-200 ease-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            업로드 중...
          </span>
        ) : (
          '업로드'
        )}
      </button>
    </div>
  );
}
