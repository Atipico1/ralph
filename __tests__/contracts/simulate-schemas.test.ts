import { describe, it, expect } from 'vitest';
import {
  evaluationSchema,
  getApproachAngles,
  calculateNextRound,
  buildSummary,
  buildCandidateSystemPrompt,
  buildCandidateUserPrompt,
  type CollectedContextItem,
  type ApproachAngle,
} from '@/ai/simulate';

describe('Simulate AI schemas (contract tests)', () => {
  // ── evaluationSchema ─────────────────────────────────────────────────────

  describe('evaluationSchema', () => {
    const validEvaluation = {
      criteria: [
        { name: '목적 적합성', weight: 0.4 },
        { name: '톤/스타일', weight: 0.3 },
        { name: '구조/완성도', weight: 0.3 },
      ],
      scores: [
        { candidateIndex: 0, criteriaScores: [85, 90, 80], totalScore: 85 },
        { candidateIndex: 1, criteriaScores: [75, 70, 85], totalScore: 76 },
        { candidateIndex: 2, criteriaScores: [70, 65, 75], totalScore: 70 },
      ],
      selectedIndex: 0,
      rationale: [
        '감성적 접근이 타겟층에 가장 적합합니다.',
        '실용적 접근은 구체적이나 감성이 부족합니다.',
        '창의적 접근은 참신하나 목적에서 벗어납니다.',
      ],
    };

    it('accepts valid evaluation output', () => {
      const result = evaluationSchema.safeParse(validEvaluation);
      expect(result.success).toBe(true);
    });

    it('accepts evaluation with 2 candidates', () => {
      const valid = {
        criteria: [{ name: '종합', weight: 1 }],
        scores: [
          { candidateIndex: 0, criteriaScores: [80], totalScore: 80 },
          { candidateIndex: 1, criteriaScores: [70], totalScore: 70 },
        ],
        selectedIndex: 0,
        rationale: ['좋습니다.', '괜찮습니다.'],
      };
      const result = evaluationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing criteria', () => {
      const { criteria: _, ...invalid } = validEvaluation;
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing scores', () => {
      const { scores: _, ...invalid } = validEvaluation;
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing selectedIndex', () => {
      const { selectedIndex: _, ...invalid } = validEvaluation;
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing rationale', () => {
      const { rationale: _, ...invalid } = validEvaluation;
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects non-number selectedIndex', () => {
      const invalid = { ...validEvaluation, selectedIndex: 'zero' };
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects scores item missing totalScore', () => {
      const invalid = {
        ...validEvaluation,
        scores: [
          { candidateIndex: 0, criteriaScores: [85, 90, 80] },
        ],
      };
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects criteria item missing weight', () => {
      const invalid = {
        ...validEvaluation,
        criteria: [{ name: '목적 적합성' }],
      };
      const result = evaluationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

// ── Pure logic unit tests ──────────────────────────────────────────────────

describe('Simulate pure logic', () => {
  describe('getApproachAngles', () => {
    it('returns 5 approach angles', () => {
      const angles = getApproachAngles('career_coach');
      expect(angles).toHaveLength(5);
    });

    it('each angle has label and instruction', () => {
      const angles = getApproachAngles(null);
      for (const angle of angles) {
        expect(angle.label).toBeTruthy();
        expect(angle.instruction).toBeTruthy();
      }
    });

    it('labels are distinct', () => {
      const angles = getApproachAngles('travel_planner');
      const labels = angles.map((a) => a.label);
      expect(new Set(labels).size).toBe(5);
    });
  });

  describe('calculateNextRound', () => {
    it('returns 1 for empty simulations', () => {
      expect(calculateNextRound([])).toBe(1);
    });

    it('returns 2 when max round is 1', () => {
      const sims = [{ round: 1 }, { round: 1 }, { round: 1 }];
      expect(calculateNextRound(sims)).toBe(2);
    });

    it('returns max+1 for mixed rounds', () => {
      const sims = [
        { round: 1 },
        { round: 1 },
        { round: 2 },
        { round: 2 },
        { round: 3 },
      ];
      expect(calculateNextRound(sims)).toBe(4);
    });
  });

  describe('buildSummary', () => {
    it('returns first meaningful line trimmed', () => {
      const content = '# My Title\nSome body text';
      expect(buildSummary(content)).toBe('My Title');
    });

    it('truncates long lines to 100 chars', () => {
      const longLine = 'A'.repeat(200);
      const summary = buildSummary(longLine);
      expect(summary.length).toBe(100);
      expect(summary.endsWith('...')).toBe(true);
    });

    it('handles empty content', () => {
      expect(buildSummary('')).toBe('');
    });

    it('strips markdown heading prefix', () => {
      expect(buildSummary('## Section Title')).toBe('Section Title');
    });
  });

  describe('buildCandidateSystemPrompt', () => {
    it('includes persona prompt and angle label', () => {
      const angle: ApproachAngle = {
        label: '감성적 접근',
        instruction: 'Be emotional',
      };
      const prompt = buildCandidateSystemPrompt('You are a coach', angle);
      expect(prompt).toContain('You are a coach');
      expect(prompt).toContain('감성적 접근');
    });

    it('includes angle instruction', () => {
      const angle: ApproachAngle = {
        label: '실용적 접근',
        instruction: 'Be practical',
      };
      const prompt = buildCandidateSystemPrompt('Persona', angle);
      expect(prompt).toContain('Be practical');
    });
  });

  describe('buildCandidateUserPrompt', () => {
    it('formats collected context as bullet list', () => {
      const contexts: CollectedContextItem[] = [
        { key: 'target', value: '대학생' },
        { key: 'budget', value: '100만원' },
      ];
      const prompt = buildCandidateUserPrompt(contexts);
      expect(prompt).toContain('- target: 대학생');
      expect(prompt).toContain('- budget: 100만원');
    });

    it('handles empty context', () => {
      const prompt = buildCandidateUserPrompt([]);
      expect(prompt).toContain('수집된 정보');
    });
  });
});
