import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ── projects ─────────────────────────────────────────────────────────────────

export const projects = sqliteTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  domain: text('domain'),
  personaPrompt: text('persona_prompt'),
  phase: text('phase', { enum: ['collect', 'simulate', 'deliver'] })
    .notNull()
    .default('collect'),
  maxQuestions: integer('max_questions').notNull().default(10),
  questionCount: integer('question_count').notNull().default(0),
  questionPlan: text('question_plan'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdateFn(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// ── messages ─────────────────────────────────────────────────────────────────

export const messages = sqliteTable('messages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['agent', 'user'] }).notNull(),
  content: text('content').notNull(),
  inputType: text('input_type', { enum: ['choice', 'text', 'yesno', 'file'] }),
  options: text('options'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ── collected_context ─────────────────────────────────────────────────────────

export const collectedContext = sqliteTable('collected_context', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  questionId: text('question_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type CollectedContext = typeof collectedContext.$inferSelect;
export type NewCollectedContext = typeof collectedContext.$inferInsert;

// ── simulations ───────────────────────────────────────────────────────────────

export const simulations = sqliteTable('simulations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  label: text('label').notNull(),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  rationale: text('rationale').notNull(),
  score: real('score'),
  isSelected: integer('is_selected').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Simulation = typeof simulations.$inferSelect;
export type NewSimulation = typeof simulations.$inferInsert;

// ── revision_options ──────────────────────────────────────────────────────────

export const revisionOptions = sqliteTable('revision_options', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  simulationId: text('simulation_id')
    .notNull()
    .references(() => simulations.id, { onDelete: 'cascade' }),
  selectedOption: text('selected_option').notNull(),
  customInput: text('custom_input'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type RevisionOption = typeof revisionOptions.$inferSelect;
export type NewRevisionOption = typeof revisionOptions.$inferInsert;

// ── uploaded_files ────────────────────────────────────────────────────────────

export const uploadedFiles = sqliteTable('uploaded_files', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  filePath: text('file_path').notNull(),
  extractedText: text('extracted_text'),
  analysis: text('analysis'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;
