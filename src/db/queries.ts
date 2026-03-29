import { eq, desc, asc } from 'drizzle-orm';
import { db } from './index';
import {
  projects,
  messages,
  collectedContext,
  simulations,
  revisionOptions,
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

export function listProjects(): Project[] {
  return db.select().from(projects).orderBy(desc(projects.createdAt)).all();
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
