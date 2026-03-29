import { describe, it, expect } from 'vitest';
import {
  extractedContextSchema,
  shouldEndSchema,
  nextQuestionSchema,
} from '@/ai/collect';

describe('Collect AI schemas (contract tests)', () => {
  // ── extractedContextSchema ──────────────────────────────────────────────

  describe('extractedContextSchema', () => {
    it('accepts valid context extraction output', () => {
      const valid = {
        contexts: [
          { key: 'target_audience', value: '대학생' },
          { key: 'budget_range', value: '100만원 이내' },
        ],
      };
      const result = extractedContextSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts empty contexts array', () => {
      const valid = { contexts: [] };
      const result = extractedContextSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing contexts field', () => {
      const invalid = {};
      const result = extractedContextSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects contexts item missing key', () => {
      const invalid = {
        contexts: [{ value: '대학생' }],
      };
      const result = extractedContextSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects contexts item missing value', () => {
      const invalid = {
        contexts: [{ key: 'target_audience' }],
      };
      const result = extractedContextSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ── shouldEndSchema ─────────────────────────────────────────────────────

  describe('shouldEndSchema', () => {
    it('accepts valid shouldEnd=true result', () => {
      const valid = {
        shouldEnd: true,
        reason: '핵심 정보가 충분히 수집되었습니다',
      };
      const result = shouldEndSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts valid shouldEnd=false result', () => {
      const valid = {
        shouldEnd: false,
        reason: '아직 예산 정보가 필요합니다',
      };
      const result = shouldEndSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing shouldEnd field', () => {
      const invalid = { reason: 'some reason' };
      const result = shouldEndSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing reason field', () => {
      const invalid = { shouldEnd: true };
      const result = shouldEndSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean shouldEnd', () => {
      const invalid = { shouldEnd: 'yes', reason: 'some reason' };
      const result = shouldEndSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ── nextQuestionSchema ──────────────────────────────────────────────────

  describe('nextQuestionSchema', () => {
    it('accepts choice type with options', () => {
      const valid = {
        question: '어떤 톤을 선호하시나요?',
        inputType: 'choice',
        options: ['격식체', '친근한 톤', '유머러스', '기타 (직접 입력)'],
      };
      const result = nextQuestionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts text type with null options', () => {
      const valid = {
        question: '자세히 알려주세요',
        inputType: 'text',
        options: null,
      };
      const result = nextQuestionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts yesno type with null options', () => {
      const valid = {
        question: '경력이 있으신가요?',
        inputType: 'yesno',
        options: null,
      };
      const result = nextQuestionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid inputType', () => {
      const invalid = {
        question: '질문',
        inputType: 'multiselect',
        options: null,
      };
      const result = nextQuestionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing question', () => {
      const invalid = {
        inputType: 'text',
        options: null,
      };
      const result = nextQuestionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing inputType', () => {
      const invalid = {
        question: '질문',
        options: null,
      };
      const result = nextQuestionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
