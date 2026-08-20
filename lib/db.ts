import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export type User = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  pinned: number;
  archived: number;
  project_id: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments_json?: string;
  model?: string;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type TaskItem = {
  id: string;
  user_id: string;
  title: string;
  done: number;
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  user_id: string;
  theme: "dark" | "light";
  accent_theme: "cyan" | "violet" | "emerald";
  persona: "helper" | "coder" | "writer" | "analyst";
  ai_mode: "fast" | "thinking" | "deep";
  task_mode: "default" | "explain" | "rewrite";
  system_prompt: string;
  compact_mode: number;
  use_memory: number;
  memory: string;
  updated_at: string;
};

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = process.cwd();
  const dbPath = path.join(dbDir, "zerogen.db");

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      project_id TEXT NOT NULL DEFAULT 'general',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments_json TEXT,
      model TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'dark',
      accent_theme TEXT NOT NULL DEFAULT 'cyan',
      persona TEXT NOT NULL DEFAULT 'helper',
      ai_mode TEXT NOT NULL DEFAULT 'fast',
      task_mode TEXT NOT NULL DEFAULT 'default',
      system_prompt TEXT NOT NULL DEFAULT 'You are ZeroGen, a practical and thoughtful AI assistant.',
      compact_mode INTEGER NOT NULL DEFAULT 0,
      use_memory INTEGER NOT NULL DEFAULT 1,
      memory TEXT NOT NULL DEFAULT 'No saved memory yet.',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  dbInstance = db;
  return dbInstance;
}

// -------------------------------------------------------------
// USER OPERATIONS
// -------------------------------------------------------------

export function createUser(user: { id: string; email: string; name: string; password_hash: string }): User {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(user.id, user.email.toLowerCase().trim(), user.name.trim(), user.password_hash, now, now);

  // Initialize default project, settings, and welcome conversation
  const defaultProjectId = `proj_general_${user.id}`;
  db.prepare(`
    INSERT OR IGNORE INTO projects (id, user_id, name, color, created_at)
    VALUES (?, ?, 'General', 'cyan', ?)
  `).run(defaultProjectId, user.id, now);

  db.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, theme, accent_theme, persona, ai_mode, task_mode, system_prompt, compact_mode, use_memory, memory, updated_at)
    VALUES (?, 'dark', 'cyan', 'helper', 'fast', 'default', 'You are ZeroGen, a practical, intelligent AI assistant.', 0, 1, 'No saved memory yet.', ?)
  `).run(user.id, now);

  const initialChatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`
    INSERT INTO conversations (id, user_id, title, pinned, archived, project_id, created_at, updated_at)
    VALUES (?, ?, 'Welcome to ZeroGen', 0, 0, ?, ?, ?)
  `).run(initialChatId, user.id, defaultProjectId, now, now);

  db.prepare(`
    INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, 'assistant', 'Hello! I am ZeroGen, your AI assistant. How can I help you today?', ?)
  `).run(`msg_${Date.now()}_init`, initialChatId, user.id, now);

  return findUserById(user.id)!;
}

export function findUserByEmail(email: string): User | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const result = stmt.get(email.toLowerCase().trim()) as User | undefined;
  return result ?? null;
}

export function findUserById(id: string): User | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const result = stmt.get(id) as User | undefined;
  return result ?? null;
}

// -------------------------------------------------------------
// SESSION OPERATIONS
// -------------------------------------------------------------

export function createSession(userId: string, token: string, expiresAt: Date): Session {
  const db = getDb();
  const now = new Date().toISOString();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(sessionId, userId, token, expiresAt.toISOString(), now);
  return {
    id: sessionId,
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
    created_at: now,
  };
}

export function findSessionByToken(token: string): (Session & { user: Omit<User, "password_hash"> }) | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT s.id, s.user_id, s.token, s.expires_at, s.created_at,
           u.email, u.name, u.created_at as user_created_at, u.updated_at as user_updated_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `);
  const row = stmt.get(token) as Record<string, unknown> | undefined;
  if (!row) return null;

  const now = new Date();
  const expiresAt = new Date(row.expires_at as string);
  if (expiresAt < now) {
    deleteSessionByToken(token);
    return null;
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    token: row.token as string,
    expires_at: row.expires_at as string,
    created_at: row.created_at as string,
    user: {
      id: row.user_id as string,
      email: row.email as string,
      name: row.name as string,
      created_at: row.user_created_at as string,
      updated_at: row.user_updated_at as string,
    },
  };
}

export function deleteSessionByToken(token: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM sessions WHERE token = ?");
  stmt.run(token);
}

export function deleteSessionsByUserId(userId: string): void {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM sessions WHERE user_id = ?");
  stmt.run(userId);
}

// -------------------------------------------------------------
// CONVERSATION OPERATIONS
// -------------------------------------------------------------

export function listConversations(userId: string, search?: string, projectId?: string): (Conversation & { last_message?: string; message_count: number })[] {
  const db = getDb();
  let query = `
    SELECT c.*,
      (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.user_id = ? AND c.archived = 0
  `;
  const params: (string | number | null)[] = [userId];

  if (projectId && projectId !== "all") {
    query += " AND c.project_id = ?";
    params.push(projectId);
  }

  if (search && search.trim()) {
    query += " AND (c.title LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content LIKE ?))";
    const pattern = `%${search.trim()}%`;
    params.push(pattern, pattern);
  }

  query += " ORDER BY c.pinned DESC, c.updated_at DESC";

  const stmt = db.prepare(query);
  return stmt.all(...params) as unknown as (Conversation & { last_message?: string; message_count: number })[];
}

export function verifyConversation(id: string, userId: string): { id: string; title: string } | null {
  const db = getDb();
  const stmt = db.prepare("SELECT id, title FROM conversations WHERE id = ? AND user_id = ?");
  const result = stmt.get(id, userId) as { id: string; title: string } | undefined;
  return result ?? null;
}

export function getRecentMessageHistory(conversationId: string, userId: string, limit = 8): { role: "user" | "assistant" | "system"; content: string }[] {
  const db = getDb();
  const stmt = db.prepare(
    "SELECT role, content FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?"
  );
  const rows = stmt.all(conversationId, userId, limit) as unknown as { role: "user" | "assistant" | "system"; content: string }[];
  return rows.reverse();
}

export function getConversationById(id: string, userId: string): (Conversation & { messages: Message[] }) | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?");
  const conversation = stmt.get(id, userId) as Conversation | undefined;
  if (!conversation) return null;

  const msgStmt = db.prepare("SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC");
  const messages = msgStmt.all(id, userId) as unknown as Message[];

  return {
    ...conversation,
    messages,
  };
}

export function createConversation(userId: string, title = "New Chat", projectId = "general"): Conversation {
  const db = getDb();
  const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO conversations (id, user_id, title, pinned, archived, project_id, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, ?, ?, ?)
  `);
  stmt.run(id, userId, title, projectId, now, now);

  const initialMsgId = `msg_${Date.now()}_init`;
  db.prepare(`
    INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, 'assistant', 'Hello! I am ZeroGen. Ask anything and I will assist you.', ?)
  `).run(initialMsgId, id, userId, now);

  return {
    id,
    user_id: userId,
    title,
    pinned: 0,
    archived: 0,
    project_id: projectId,
    created_at: now,
    updated_at: now,
  };
}

export function updateConversation(
  id: string,
  userId: string,
  updates: { title?: string; pinned?: boolean; archived?: boolean; project_id?: string }
): Conversation | null {
  const db = getDb();
  const current = getConversationById(id, userId);
  if (!current) return null;

  const now = new Date().toISOString();
  const newTitle = updates.title !== undefined ? updates.title.trim() : current.title;
  const newPinned = updates.pinned !== undefined ? (updates.pinned ? 1 : 0) : current.pinned;
  const newArchived = updates.archived !== undefined ? (updates.archived ? 1 : 0) : current.archived;
  const newProjectId = updates.project_id !== undefined ? updates.project_id : current.project_id;

  const stmt = db.prepare(`
    UPDATE conversations
    SET title = ?, pinned = ?, archived = ?, project_id = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `);
  stmt.run(newTitle, newPinned, newArchived, newProjectId, now, id, userId);

  return getConversationById(id, userId);
}

export function touchConversation(id: string, userId: string, newTitle?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (newTitle) {
    db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(newTitle, now, id, userId);
  } else {
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?")
      .run(now, id, userId);
  }
}

export function deleteConversation(id: string, userId: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?");
  stmt.run(id, userId);
  return true;
}

// -------------------------------------------------------------
// MESSAGE OPERATIONS
// -------------------------------------------------------------

export function addMessage(msg: {
  id?: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments_json?: string;
  model?: string;
}): Message {
  const db = getDb();
  const id = msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, user_id, role, content, attachments_json, model, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, msg.conversation_id, msg.user_id, msg.role, msg.content, msg.attachments_json ?? null, msg.model ?? null, now);

  touchConversation(msg.conversation_id, msg.user_id);

  return {
    id,
    conversation_id: msg.conversation_id,
    user_id: msg.user_id,
    role: msg.role,
    content: msg.content,
    attachments_json: msg.attachments_json,
    model: msg.model,
    created_at: now,
  };
}

export function updateMessageContent(id: string, userId: string, content: string): Message | null {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE messages SET content = ? WHERE id = ? AND user_id = ?
  `);
  stmt.run(content, id, userId);

  const getStmt = db.prepare("SELECT * FROM messages WHERE id = ? AND user_id = ?");
  const result = getStmt.get(id, userId) as Message | undefined;
  return result ?? null;
}

export function deleteMessagesAfter(conversationId: string, userId: string, messageCreatedAt: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM messages
    WHERE conversation_id = ? AND user_id = ? AND created_at > ?
  `);
  stmt.run(conversationId, userId, messageCreatedAt);
}

// -------------------------------------------------------------
// PROJECTS, NOTES, TASKS, SETTINGS
// -------------------------------------------------------------

export function listProjects(userId: string): Project[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at ASC");
  return stmt.all(userId) as unknown as Project[];
}

export function createProject(userId: string, name: string, color: string): Project {
  const db = getDb();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO projects (id, user_id, name, color, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, name.trim(), color, now);
  return { id, user_id: userId, name: name.trim(), color, created_at: now };
}

export function deleteProject(id: string, userId: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?");
  stmt.run(id, userId);
  return true;
}

export function listNotes(userId: string): Note[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC");
  return stmt.all(userId) as unknown as Note[];
}

export function createNote(userId: string, title: string, content = ""): Note {
  const db = getDb();
  const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, title.trim(), content, now, now);
  return { id, user_id: userId, title: title.trim(), content, created_at: now, updated_at: now };
}

export function updateNote(id: string, userId: string, title: string, content: string): Note | null {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `);
  stmt.run(title.trim(), content, now, id, userId);
  const getStmt = db.prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?");
  return (getStmt.get(id, userId) as Note | undefined) ?? null;
}

export function deleteNote(id: string, userId: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM notes WHERE id = ? AND user_id = ?");
  stmt.run(id, userId);
  return true;
}

export function listTasks(userId: string): TaskItem[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC");
  return stmt.all(userId) as unknown as TaskItem[];
}

export function createTask(userId: string, title: string): TaskItem {
  const db = getDb();
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO tasks (id, user_id, title, done, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `);
  stmt.run(id, userId, title.trim(), now, now);
  return { id, user_id: userId, title: title.trim(), done: 0, created_at: now, updated_at: now };
}

export function toggleTask(id: string, userId: string): TaskItem | null {
  const db = getDb();
  const now = new Date().toISOString();
  const getStmt = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?");
  const task = getStmt.get(id, userId) as TaskItem | undefined;
  if (!task) return null;

  const nextDone = task.done === 1 ? 0 : 1;
  const stmt = db.prepare("UPDATE tasks SET done = ?, updated_at = ? WHERE id = ? AND user_id = ?");
  stmt.run(nextDone, now, id, userId);

  return { ...task, done: nextDone, updated_at: now };
}

export function deleteTask(id: string, userId: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
  stmt.run(id, userId);
  return true;
}

export function getUserSettings(userId: string): UserSettings {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM user_settings WHERE user_id = ?");
  const settings = stmt.get(userId) as UserSettings | undefined;
  if (settings) return settings;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO user_settings (user_id, theme, accent_theme, persona, ai_mode, task_mode, system_prompt, compact_mode, use_memory, memory, updated_at)
    VALUES (?, 'dark', 'cyan', 'helper', 'fast', 'default', 'You are ZeroGen, a practical, intelligent AI assistant.', 0, 1, 'No saved memory yet.', ?)
  `).run(userId, now);

  return (stmt.get(userId) as UserSettings | undefined)!;
}

export function updateUserSettings(userId: string, updates: Partial<UserSettings>): UserSettings {
  const current = getUserSettings(userId);
  const db = getDb();
  const now = new Date().toISOString();

  const next = {
    theme: updates.theme ?? current.theme,
    accent_theme: updates.accent_theme ?? current.accent_theme,
    persona: updates.persona ?? current.persona,
    ai_mode: updates.ai_mode ?? current.ai_mode,
    task_mode: updates.task_mode ?? current.task_mode,
    system_prompt: updates.system_prompt ?? current.system_prompt,
    compact_mode: updates.compact_mode !== undefined ? updates.compact_mode : current.compact_mode,
    use_memory: updates.use_memory !== undefined ? updates.use_memory : current.use_memory,
    memory: updates.memory ?? current.memory,
    updated_at: now,
  };

  const stmt = db.prepare(`
    UPDATE user_settings
    SET theme = ?, accent_theme = ?, persona = ?, ai_mode = ?, task_mode = ?, system_prompt = ?, compact_mode = ?, use_memory = ?, memory = ?, updated_at = ?
    WHERE user_id = ?
  `);
  stmt.run(
    next.theme,
    next.accent_theme,
    next.persona,
    next.ai_mode,
    next.task_mode,
    next.system_prompt,
    next.compact_mode,
    next.use_memory,
    next.memory,
    now,
    userId
  );

  return { ...next, user_id: userId };
}
