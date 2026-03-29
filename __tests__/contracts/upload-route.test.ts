import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock nanoid ────────────────────────────────────────────────────────────

vi.mock('nanoid', () => ({
  nanoid: () => 'test-file-id',
}));

// ── Mock node:fs ───────────────────────────────────────────────────────────

const mockWriteFileSync = vi.fn();
vi.mock('node:fs', () => ({
  default: {
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    mkdirSync: vi.fn(),
  },
}));

// ── Mock file-processing ───────────────────────────────────────────────────

const mockAnalyzeImage = vi.fn();
const mockExtractPdfText = vi.fn();

vi.mock('@/lib/file-processing', () => ({
  analyzeImage: (...args: unknown[]) => mockAnalyzeImage(...args),
  extractPdfText: (...args: unknown[]) => mockExtractPdfText(...args),
  ensureUploadDir: () => '/tmp/uploads/test-id',
  getFileExtension: (mimeType: string) => {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/markdown': 'md',
    };
    return map[mimeType] ?? 'bin';
  },
  isImageType: (m: string) => m.startsWith('image/'),
  isPdfType: (m: string) => m === 'application/pdf',
  isTextType: (m: string) => m === 'text/plain' || m === 'text/markdown',
  MAX_FILE_SIZE: 10 * 1024 * 1024,
}));

// ── Mock DB queries ────────────────────────────────────────────────────────

const mockGetProject = vi.fn();
const mockCreateUploadedFile = vi.fn();
const mockCreateCollectedContext = vi.fn();

vi.mock('@/db/queries', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  createUploadedFile: (...args: unknown[]) => mockCreateUploadedFile(...args),
  createCollectedContext: (...args: unknown[]) => mockCreateCollectedContext(...args),
}));

// ── Import route AFTER mocks ───────────────────────────────────────────────

import { POST } from '@/app/api/projects/[id]/upload/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormDataRequest(projectId: string, file: File, messageId: string): Request {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('messageId', messageId);
  return new Request(`http://localhost:3000/api/projects/${projectId}/upload`, {
    method: 'POST',
    body: formData,
  });
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ── Shared fixtures ────────────────────────────────────────────────────────

const baseProject = {
  id: 'test-id',
  title: 'Test Project',
  domain: 'career_coach',
  personaPrompt: 'You are a career coach',
  phase: 'collect' as const,
  maxQuestions: 10,
  questionCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testImageFile = new File(
  [new Uint8Array([137, 80, 78, 71])], // PNG magic bytes
  'test.png',
  { type: 'image/png' },
);

const testPdfFile = new File(
  [new Uint8Array([37, 80, 68, 70])], // PDF magic bytes
  'test.pdf',
  { type: 'application/pdf' },
);

const testTextFile = new File(
  [new TextEncoder().encode('Hello world')],
  'test.txt',
  { type: 'text/plain' },
);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/projects/[id]/upload (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetProject.mockReturnValue(baseProject);
    mockCreateUploadedFile.mockReturnValue({
      id: 'test-file-id',
      projectId: 'test-id',
      messageId: 'msg-1',
      filename: 'test.png',
      mimeType: 'image/png',
      filePath: 'uploads/test-id/test-file-id.png',
      extractedText: null,
      analysis: null,
      createdAt: new Date(),
    });
    mockCreateCollectedContext.mockReturnValue({
      id: 'ctx-1',
      projectId: 'test-id',
      key: '파일 분석: test.png',
      value: 'Image analysis result',
      questionId: 'msg-1',
      createdAt: new Date(),
    });
    mockAnalyzeImage.mockResolvedValue('이미지 분석 결과입니다');
    mockExtractPdfText.mockResolvedValue('PDF에서 추출된 텍스트입니다');
  });

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 404 for non-existent project', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await POST(
      makeFormDataRequest('bad-id', testImageFile, 'msg-1'),
      makeParams('bad-id'),
    );
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Project not found');
  });

  it('returns 400 for project not in collect phase', async () => {
    mockGetProject.mockReturnValue({ ...baseProject, phase: 'simulate' });
    const response = await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('not in collect phase');
  });

  it('returns 400 for missing file field', async () => {
    const formData = new FormData();
    formData.append('messageId', 'msg-1');
    const request = new Request('http://localhost:3000/api/projects/test-id/upload', {
      method: 'POST',
      body: formData,
    });
    const response = await POST(request, makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('file');
  });

  it('returns 400 for missing messageId field', async () => {
    const formData = new FormData();
    formData.append('file', testImageFile);
    const request = new Request('http://localhost:3000/api/projects/test-id/upload', {
      method: 'POST',
      body: formData,
    });
    const response = await POST(request, makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('messageId');
  });

  it('returns 400 for invalid form data', async () => {
    const request = new Request('http://localhost:3000/api/projects/test-id/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ not: 'formdata' }),
    });
    const response = await POST(request, makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Invalid form data');
  });

  // ── File size validation ────────────────────────────────────────────────

  it('returns 413 for file exceeding 10MB limit', async () => {
    const oversizedContent = new Uint8Array(10 * 1024 * 1024 + 1); // 10MB + 1 byte
    const oversizedFile = new File([oversizedContent], 'huge.png', { type: 'image/png' });
    const response = await POST(
      makeFormDataRequest('test-id', oversizedFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(413);
    const json = await response.json();
    expect(json.error).toContain('10MB');
  });

  it('accepts file exactly at 10MB limit', async () => {
    const exactContent = new Uint8Array(10 * 1024 * 1024); // exactly 10MB
    const exactFile = new File([exactContent], 'exact.png', { type: 'image/png' });
    const response = await POST(
      makeFormDataRequest('test-id', exactFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
  });

  // ── Image processing ────────────────────────────────────────────────────

  it('calls analyzeImage for image files and returns analysis', async () => {
    const response = await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(mockAnalyzeImage).toHaveBeenCalledOnce();
    expect(mockAnalyzeImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/png',
    );
    expect(json.analysis).toBe('이미지 분석 결과입니다');
    expect(json.extractedText).toBeUndefined();
  });

  it('returns correct response schema for image files', async () => {
    const response = await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );
    const json = await response.json();

    expect(json).toEqual({
      fileId: 'test-file-id',
      filename: 'test.png',
      mimeType: 'image/png',
      analysis: '이미지 분석 결과입니다',
    });
  });

  // ── PDF processing ──────────────────────────────────────────────────────

  it('calls extractPdfText for PDF files and returns extractedText', async () => {
    const response = await POST(
      makeFormDataRequest('test-id', testPdfFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(mockExtractPdfText).toHaveBeenCalledOnce();
    expect(mockExtractPdfText).toHaveBeenCalledWith(expect.any(Buffer));
    expect(json.extractedText).toBe('PDF에서 추출된 텍스트입니다');
    expect(json.analysis).toBeUndefined();
  });

  it('returns correct response schema for PDF files', async () => {
    const response = await POST(
      makeFormDataRequest('test-id', testPdfFile, 'msg-1'),
      makeParams('test-id'),
    );
    const json = await response.json();

    expect(json).toEqual({
      fileId: 'test-file-id',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      extractedText: 'PDF에서 추출된 텍스트입니다',
    });
  });

  // ── Text processing ─────────────────────────────────────────────────────

  it('returns text content as extractedText for text files', async () => {
    const response = await POST(
      makeFormDataRequest('test-id', testTextFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.extractedText).toBe('Hello world');
    expect(json.analysis).toBeUndefined();
    // Should not call analyzeImage or extractPdfText
    expect(mockAnalyzeImage).not.toHaveBeenCalled();
    expect(mockExtractPdfText).not.toHaveBeenCalled();
  });

  it('returns correct response schema for text files', async () => {
    const response = await POST(
      makeFormDataRequest('test-id', testTextFile, 'msg-1'),
      makeParams('test-id'),
    );
    const json = await response.json();

    expect(json).toEqual({
      fileId: 'test-file-id',
      filename: 'test.txt',
      mimeType: 'text/plain',
      extractedText: 'Hello world',
    });
  });

  // ── Unknown file type ───────────────────────────────────────────────────

  it('returns response without extractedText or analysis for unknown types', async () => {
    const binaryFile = new File(
      [new Uint8Array([0x00, 0x01, 0x02])],
      'data.bin',
      { type: 'application/octet-stream' },
    );
    const response = await POST(
      makeFormDataRequest('test-id', binaryFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toEqual({
      fileId: 'test-file-id',
      filename: 'data.bin',
      mimeType: 'application/octet-stream',
    });
    expect(json.extractedText).toBeUndefined();
    expect(json.analysis).toBeUndefined();
  });

  // ── DB records ──────────────────────────────────────────────────────────

  it('creates uploadedFile DB record with correct data for image', async () => {
    await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateUploadedFile).toHaveBeenCalledOnce();
    expect(mockCreateUploadedFile).toHaveBeenCalledWith({
      id: 'test-file-id',
      projectId: 'test-id',
      messageId: 'msg-1',
      filename: 'test.png',
      mimeType: 'image/png',
      filePath: expect.stringContaining('uploads/test-id/test-file-id.png'),
      extractedText: null,
      analysis: '이미지 분석 결과입니다',
    });
  });

  it('creates uploadedFile DB record with correct data for PDF', async () => {
    await POST(
      makeFormDataRequest('test-id', testPdfFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateUploadedFile).toHaveBeenCalledOnce();
    expect(mockCreateUploadedFile).toHaveBeenCalledWith({
      id: 'test-file-id',
      projectId: 'test-id',
      messageId: 'msg-1',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      filePath: expect.stringContaining('uploads/test-id/test-file-id.pdf'),
      extractedText: 'PDF에서 추출된 텍스트입니다',
      analysis: null,
    });
  });

  it('creates uploadedFile DB record with correct data for text', async () => {
    await POST(
      makeFormDataRequest('test-id', testTextFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateUploadedFile).toHaveBeenCalledOnce();
    expect(mockCreateUploadedFile).toHaveBeenCalledWith({
      id: 'test-file-id',
      projectId: 'test-id',
      messageId: 'msg-1',
      filename: 'test.txt',
      mimeType: 'text/plain',
      filePath: expect.stringContaining('uploads/test-id/test-file-id.txt'),
      extractedText: 'Hello world',
      analysis: null,
    });
  });

  it('creates collectedContext with analysis for image files', async () => {
    await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateCollectedContext).toHaveBeenCalledOnce();
    expect(mockCreateCollectedContext).toHaveBeenCalledWith({
      projectId: 'test-id',
      key: '파일 분석: test.png',
      value: '이미지 분석 결과입니다',
      questionId: 'msg-1',
    });
  });

  it('creates collectedContext with extractedText for PDF files', async () => {
    await POST(
      makeFormDataRequest('test-id', testPdfFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateCollectedContext).toHaveBeenCalledOnce();
    expect(mockCreateCollectedContext).toHaveBeenCalledWith({
      projectId: 'test-id',
      key: '파일 내용: test.pdf',
      value: 'PDF에서 추출된 텍스트입니다',
      questionId: 'msg-1',
    });
  });

  it('creates collectedContext with extractedText for text files', async () => {
    await POST(
      makeFormDataRequest('test-id', testTextFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateCollectedContext).toHaveBeenCalledOnce();
    expect(mockCreateCollectedContext).toHaveBeenCalledWith({
      projectId: 'test-id',
      key: '파일 내용: test.txt',
      value: 'Hello world',
      questionId: 'msg-1',
    });
  });

  it('creates collectedContext with fallback for unknown file types', async () => {
    const binaryFile = new File(
      [new Uint8Array([0x00, 0x01, 0x02])],
      'data.bin',
      { type: 'application/octet-stream' },
    );
    await POST(
      makeFormDataRequest('test-id', binaryFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockCreateCollectedContext).toHaveBeenCalledOnce();
    expect(mockCreateCollectedContext).toHaveBeenCalledWith({
      projectId: 'test-id',
      key: '업로드된 파일: data.bin',
      value: '[파일 업로드됨: data.bin]',
      questionId: 'msg-1',
    });
  });

  // ── File saved to disk ──────────────────────────────────────────────────

  it('writes file to disk with correct path', async () => {
    await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('test-file-id.png'),
      expect.any(Buffer),
    );
  });

  // ── Processing errors (graceful degradation) ────────────────────────────

  it('saves file even if image analysis fails', async () => {
    mockAnalyzeImage.mockRejectedValue(new Error('Vision API unavailable'));
    const response = await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);

    // File was still written to disk
    expect(mockWriteFileSync).toHaveBeenCalledOnce();

    // DB records still created (without analysis)
    expect(mockCreateUploadedFile).toHaveBeenCalledOnce();
    expect(mockCreateUploadedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: null,
        extractedText: null,
      }),
    );

    // Response should not include analysis
    const json = await response.json();
    expect(json.analysis).toBeUndefined();
    expect(json.fileId).toBe('test-file-id');
  });

  it('saves file even if PDF extraction fails', async () => {
    mockExtractPdfText.mockRejectedValue(new Error('PDF corrupted'));
    const response = await POST(
      makeFormDataRequest('test-id', testPdfFile, 'msg-1'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);

    // File was still written to disk
    expect(mockWriteFileSync).toHaveBeenCalledOnce();

    // DB records still created (without extractedText)
    expect(mockCreateUploadedFile).toHaveBeenCalledOnce();
    expect(mockCreateUploadedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedText: null,
        analysis: null,
      }),
    );

    // Response should not include extractedText
    const json = await response.json();
    expect(json.extractedText).toBeUndefined();
    expect(json.fileId).toBe('test-file-id');
  });

  it('creates fallback collectedContext when processing fails', async () => {
    mockAnalyzeImage.mockRejectedValue(new Error('Vision API unavailable'));
    await POST(
      makeFormDataRequest('test-id', testImageFile, 'msg-1'),
      makeParams('test-id'),
    );

    // When processing fails, contextValue falls through to the fallback
    expect(mockCreateCollectedContext).toHaveBeenCalledWith({
      projectId: 'test-id',
      key: '업로드된 파일: test.png',
      value: '[파일 업로드됨: test.png]',
      questionId: 'msg-1',
    });
  });
});
