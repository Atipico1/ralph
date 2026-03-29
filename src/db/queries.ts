import { eq, desc, asc, and, max } from 'drizzle-orm';
import { db } from './index';
import {
  projects,
  messages,
  collectedContext,
  simulations,
  revisionOptions,
  uploadedFiles,
  type NewProject,
  type Project,
  type NewMessage,
  type Message,
  type NewCollectedContext,
  type CollectedContext,
  type NewSimulation,
  type Simulation,
  type NewRevisionOption,
  type RevisionOption,
  type NewUploadedFile,
  type UploadedFile,
} from './schema';

// ── projects ─────────────────────────────────────────────────────────────────

export function createProject(
  data: Omit<NewProject, 'id' | 'createdAt' | 'updatedAt'>
): Project {
  const row = db.insert(projects).values(data).returning().get();
  return row;
}

export function getProject(id: string): Project | undefined {
  return db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1)
    .get();
}

export function listProjects(limit?: number): Project[] {
  const query = db.select().from(projects).orderBy(desc(projects.createdAt));
  if (limit !== undefined) {
    return query.limit(limit).all();
  }
  return query.all();
}

export function updateProject(
  id: string,
  data: Partial<Omit<NewProject, 'id' | 'createdAt'>>
): void {
  db.update(projects).set(data).where(eq(projects.id, id)).run();
}

// ── messages ─────────────────────────────────────────────────────────────────

export function createMessage(
  data: Omit<NewMessage, 'id' | 'createdAt'>
): Message {
  const row = db.insert(messages).values(data).returning().get();
  return row;
}

export function getMessagesByProject(projectId: string): Message[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.projectId, projectId))
    .orderBy(asc(messages.createdAt))
    .all();
}

// ── collected_context ─────────────────────────────────────────────────────────

export function createCollectedContext(
  data: Omit<NewCollectedContext, 'id' | 'createdAt'>
): CollectedContext {
  const row = db.insert(collectedContext).values(data).returning().get();
  return row;
}

export function getCollectedContextByProject(
  projectId: string
): CollectedContext[] {
  return db
    .select()
    .from(collectedContext)
    .where(eq(collectedContext.projectId, projectId))
    .orderBy(desc(collectedContext.createdAt))
    .all();
}

// ── simulations ───────────────────────────────────────────────────────────────

export function createSimulation(
  data: Omit<NewSimulation, 'id' | 'createdAt'>
): Simulation {
  const row = db.insert(simulations).values(data).returning().get();
  return row;
}

export function getSimulationsByProject(projectId: string): Simulation[] {
  return db
    .select()
    .from(simulations)
    .where(eq(simulations.projectId, projectId))
    .orderBy(desc(simulations.createdAt))
    .all();
}

export function updateSimulation(
  id: string,
  data: Partial<Omit<NewSimulation, 'id' | 'createdAt'>>
): void {
  db.update(simulations).set(data).where(eq(simulations.id, id)).run();
}

// ── revision_options ──────────────────────────────────────────────────────────

export function createRevisionOption(
  data: Omit<NewRevisionOption, 'id' | 'createdAt'>
): RevisionOption {
  const row = db.insert(revisionOptions).values(data).returning().get();
  return row;
}

export function getLatestRevisionOption(
  projectId: string
): RevisionOption | undefined {
  return db
    .select()
    .from(revisionOptions)
    .where(eq(revisionOptions.projectId, projectId))
    .orderBy(desc(revisionOptions.createdAt))
    .limit(1)
    .get();
}

export function getSimulationsByProjectAndRound(
  projectId: string,
  round: number
): Simulation[] {
  return db
    .select()
    .from(simulations)
    .where(
      and(
        eq(simulations.projectId, projectId),
        eq(simulations.round, round),
      ),
    )
    .orderBy(asc(simulations.createdAt))
    .all();
}

export function getMaxRound(projectId: string): number {
  const result = db
    .select({ maxRound: max(simulations.round) })
    .from(simulations)
    .where(eq(simulations.projectId, projectId))
    .get();
  return result?.maxRound ?? 0;
}

/** Get the selected (is_selected=1) simulation from the latest round */
export function getSelectedSimulation(
  projectId: string,
): Simulation | undefined {
  const maxRound = getMaxRound(projectId);
  if (maxRound === 0) return undefined;
  const roundSims = getSimulationsByProjectAndRound(projectId, maxRound);
  return roundSims.find((s) => s.isSelected === 1);
}

export function deleteCollectedContextByProject(projectId: string): void {
  db.delete(collectedContext)
    .where(eq(collectedContext.projectId, projectId))
    .run();
}

export function deleteMessagesByProject(projectId: string): void {
  db.delete(messages).where(eq(messages.projectId, projectId)).run();
}

export function deleteSimulationsByProject(projectId: string): void {
  db.delete(simulations)
    .where(eq(simulations.projectId, projectId))
    .run();
}

export function deleteRevisionOptionsByProject(projectId: string): void {
  db.delete(revisionOptions)
    .where(eq(revisionOptions.projectId, projectId))
    .run();
}

// ── uploaded_files ────────────────────────────────────────────────────────────

export function createUploadedFile(
  data: Omit<NewUploadedFile, 'id' | 'createdAt'> & { id?: string }
): UploadedFile {
  const row = db.insert(uploadedFiles).values(data).returning().get();
  return row;
}

export function updateUploadedFile(
  id: string,
  data: Partial<Omit<NewUploadedFile, 'id' | 'createdAt'>>
): void {
  db.update(uploadedFiles).set(data).where(eq(uploadedFiles.id, id)).run();
}

export function getUploadedFilesByProject(projectId: string): UploadedFile[] {
  return db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.projectId, projectId))
    .orderBy(asc(uploadedFiles.createdAt))
    .all();
}

export function getUploadedFilesByMessage(messageId: string): UploadedFile[] {
  return db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.messageId, messageId))
    .orderBy(asc(uploadedFiles.createdAt))
    .all();
}
