import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { generateText } from 'ai';
import { mainAgentModel } from '@/ai/providers';

// ── MIME type to file extension mapping ────────────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

export function getFileExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? 'bin';
}

// ── Upload directory helpers ───────────────────────────────────────────────

const UPLOAD_BASE = process.env.UPLOAD_PATH ?? 'uploads';

export function getUploadDir(projectId: string): string {
  return path.resolve(UPLOAD_BASE, projectId);
}

export function ensureUploadDir(projectId: string): string {
  const dir = getUploadDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── File type detection ────────────────────────────────────────────────────

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_TYPES = new Set(['application/pdf']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);

export function isImageType(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType);
}

export function isPdfType(mimeType: string): boolean {
  return PDF_TYPES.has(mimeType);
}

export function isTextType(mimeType: string): boolean {
  return TEXT_TYPES.has(mimeType);
}

// ── Image analysis via Vision API ──────────────────────────────────────────

export async function analyzeImage(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const { text } = await generateText({
    model: mainAgentModel(),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '이 이미지를 한국어로 설명해주세요. 컨설팅 맥락에서 유용한 내용에 집중해주세요.',
          },
          {
            type: 'image',
            image: buffer,
            mimeType: mimeType as
              | 'image/jpeg'
              | 'image/png'
              | 'image/webp'
              | 'image/gif',
          },
        ],
      },
    ],
  });

  return text;
}

// ── PDF text extraction ────────────────────────────────────────────────────

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

// ── Max file size ──────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
