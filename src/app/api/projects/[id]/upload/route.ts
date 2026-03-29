import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import {
  getProject,
  createUploadedFile,
  createCollectedContext,
} from '@/db/queries';
import {
  getFileExtension,
  ensureUploadDir,
  isImageType,
  isPdfType,
  isTextType,
  analyzeImage,
  extractPdfText,
  MAX_FILE_SIZE,
} from '@/lib/file-processing';

// ── POST /api/projects/[id]/upload ─────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Load project and validate phase
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.phase !== 'collect') {
    return Response.json(
      { error: 'Project is not in collect phase' },
      { status: 400 },
    );
  }

  // 2. Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: 'Invalid form data' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  const messageId = formData.get('messageId');

  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: 'file field is required and must be a File' },
      { status: 400 },
    );
  }

  if (!messageId || typeof messageId !== 'string') {
    return Response.json(
      { error: 'messageId field is required' },
      { status: 400 },
    );
  }

  // 3. Validate file size (10MB max)
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: 'File size exceeds 10MB limit' },
      { status: 413 },
    );
  }

  // 4. Read file buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 5. Pre-generate ID, determine extension, compute paths
  const fileId = nanoid();
  const mimeType = file.type || 'application/octet-stream';
  const ext = getFileExtension(mimeType);
  const uploadDir = ensureUploadDir(id);
  const savedFilename = `${fileId}.${ext}`;
  const savedPath = path.join(uploadDir, savedFilename);
  const relativePath = path.join('uploads', id, savedFilename);

  // 6. Save file to disk
  fs.writeFileSync(savedPath, buffer);

  // 7. Process file based on MIME type
  let extractedText: string | undefined;
  let analysis: string | undefined;

  try {
    if (isImageType(mimeType)) {
      analysis = await analyzeImage(buffer, mimeType);
    } else if (isPdfType(mimeType)) {
      extractedText = await extractPdfText(buffer);
    } else if (isTextType(mimeType)) {
      extractedText = buffer.toString('utf-8');
    }
    // Other types: no processing, filename only stored
  } catch (err: unknown) {
    // Log but don't fail the upload — file is already saved to disk
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`File processing error for ${file.name}: ${errorMsg}`);
  }

  // 8. Create uploaded_files DB record (with all data at once)
  const filename = file.name || 'unnamed';

  createUploadedFile({
    id: fileId,
    projectId: id,
    messageId,
    filename,
    mimeType,
    filePath: relativePath,
    extractedText: extractedText ?? null,
    analysis: analysis ?? null,
  });

  // 9. Create collected_context entry from extracted content
  const contextValue =
    analysis ??
    extractedText ??
    `[파일 업로드됨: ${filename}]`;

  const contextKey = analysis
    ? `파일 분석: ${filename}`
    : extractedText
      ? `파일 내용: ${filename}`
      : `업로드된 파일: ${filename}`;

  createCollectedContext({
    projectId: id,
    key: contextKey,
    value: contextValue,
    questionId: messageId,
  });

  // 10. Return response
  return Response.json({
    fileId,
    filename,
    mimeType,
    ...(extractedText ? { extractedText } : {}),
    ...(analysis ? { analysis } : {}),
  });
}
