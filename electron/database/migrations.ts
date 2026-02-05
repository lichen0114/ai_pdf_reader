import type Database from 'better-sqlite3'

const SCHEMA_VERSION = 3
const REQUIRED_TABLES_V1 = [
  'documents',
  'interactions',
  'concepts',
  'interaction_concepts',
  'document_concepts',
  'review_cards',
] as const
const V2_TABLES = [
  'highlights',
  'bookmarks',
  'conversations',
  'conversation_messages',
  'documents_fts',
  'interactions_fts',
  'concepts_fts',
] as const
const V3_TABLES = [
  'workspaces',
  'workspace_documents',
  'conversation_sources',
] as const
const REQUIRED_TABLES_V2 = [...REQUIRED_TABLES_V1, ...V2_TABLES] as const
const REQUIRED_TABLES_V3 = [...REQUIRED_TABLES_V2, ...V3_TABLES] as const

type FtsSeedPlan = {
  documents: boolean
  interactions: boolean
  concepts: boolean
}

export type SchemaRepairResult = {
  repaired: boolean
  missingTables: string[]
}

export function runMigrations(db: Database.Database): void {
  ensureSchemaVersionTable(db)
  const currentVersion = getSchemaVersion(db)

  if (currentVersion < SCHEMA_VERSION) {
    applyMigrations(db, currentVersion)
  }
}

function ensureSchemaVersionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `)
}

function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
  return row?.version || 0
}

function setSchemaVersion(db: Database.Database, version: number = SCHEMA_VERSION): void {
  db.prepare('DELETE FROM schema_version').run()
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version)
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?`)
    .get(name) as { name: string } | undefined
  return Boolean(row)
}

function getTableCount(db: Database.Database, name: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number } | undefined
  return row?.count ?? 0
}

function getMissingTables(db: Database.Database, tables: readonly string[]): string[] {
  return tables.filter((name) => !tableExists(db, name))
}

function planFtsSeed(db: Database.Database): FtsSeedPlan {
  const plan: FtsSeedPlan = { documents: false, interactions: false, concepts: false }

  const documentsFtsExists = tableExists(db, 'documents_fts')
  const interactionsFtsExists = tableExists(db, 'interactions_fts')
  const conceptsFtsExists = tableExists(db, 'concepts_fts')

  if (!documentsFtsExists) {
    plan.documents = true
  } else if (tableExists(db, 'documents') && getTableCount(db, 'documents_fts') === 0) {
    plan.documents = getTableCount(db, 'documents') > 0
  }

  if (!interactionsFtsExists) {
    plan.interactions = true
  } else if (tableExists(db, 'interactions') && getTableCount(db, 'interactions_fts') === 0) {
    plan.interactions = getTableCount(db, 'interactions') > 0
  }

  if (!conceptsFtsExists) {
    plan.concepts = true
  } else if (tableExists(db, 'concepts') && getTableCount(db, 'concepts_fts') === 0) {
    plan.concepts = getTableCount(db, 'concepts') > 0
  }

  return plan
}

function applyMigrations(db: Database.Database, fromVersion: number): void {
  const migrations: Array<() => void> = [
    () => migration1(db),
    () => migration2(db),
    () => migration3(db),
  ]

  // Apply migrations sequentially
  db.transaction(() => {
    for (let i = fromVersion; i < migrations.length; i++) {
      migrations[i]()
    }

    // Update schema version
    setSchemaVersion(db)
  })()
}

export function verifyAndRepairSchema(db: Database.Database): SchemaRepairResult {
  ensureSchemaVersionTable(db)

  const missingV1Tables = getMissingTables(db, REQUIRED_TABLES_V1)
  const missingV2Tables = getMissingTables(db, REQUIRED_TABLES_V2).filter(
    (name) => !missingV1Tables.includes(name)
  )
  const missingV3Tables = getMissingTables(db, REQUIRED_TABLES_V3).filter(
    (name) => !missingV1Tables.includes(name) && !missingV2Tables.includes(name)
  )
  const missingAllTables = getMissingTables(db, REQUIRED_TABLES_V3)

  if (missingV1Tables.length > 0) {
    db.transaction(() => {
      migration1(db)
      const seedPlan = planFtsSeed(db)
      migration2(db, { seedFts: seedPlan })
      migration3(db)
      setSchemaVersion(db)
    })()
    return { repaired: true, missingTables: missingAllTables }
  }

  if (missingV2Tables.length > 0) {
    db.transaction(() => {
      const seedPlan = planFtsSeed(db)
      migration2(db, { seedFts: seedPlan })
      migration3(db)
      setSchemaVersion(db)
    })()
    return { repaired: true, missingTables: [...missingV2Tables, ...missingV3Tables] }
  }

  if (missingV3Tables.length > 0) {
    db.transaction(() => {
      migration3(db)
      setSchemaVersion(db)
    })()
    return { repaired: true, missingTables: missingV3Tables }
  }

  if (getSchemaVersion(db) < SCHEMA_VERSION) {
    setSchemaVersion(db)
  }

  return { repaired: false, missingTables: [] }
}

function migration1(db: Database.Database): void {
  db.exec(`
    -- Documents: tracks opened PDF files
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL UNIQUE,
      last_opened_at INTEGER NOT NULL,
      scroll_position REAL DEFAULT 0,
      total_pages INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Interactions: every AI query
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      selected_text TEXT NOT NULL,
      page_context TEXT,
      response TEXT NOT NULL,
      page_number INTEGER,
      scroll_position REAL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    -- Concepts: extracted key terms
    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    -- Junction: concepts in interactions
    CREATE TABLE IF NOT EXISTS interaction_concepts (
      interaction_id TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      PRIMARY KEY (interaction_id, concept_id),
      FOREIGN KEY (interaction_id) REFERENCES interactions(id),
      FOREIGN KEY (concept_id) REFERENCES concepts(id)
    );

    -- Document-concept links
    CREATE TABLE IF NOT EXISTS document_concepts (
      document_id TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      occurrence_count INTEGER DEFAULT 1,
      PRIMARY KEY (document_id, concept_id),
      FOREIGN KEY (document_id) REFERENCES documents(id),
      FOREIGN KEY (concept_id) REFERENCES concepts(id)
    );

    -- Spaced repetition cards
    CREATE TABLE IF NOT EXISTS review_cards (
      id TEXT PRIMARY KEY,
      interaction_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      next_review_at INTEGER NOT NULL,
      interval_days INTEGER DEFAULT 1,
      ease_factor REAL DEFAULT 2.5,
      review_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (interaction_id) REFERENCES interactions(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_interactions_doc ON interactions(document_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_review_cards_next ON review_cards(next_review_at);
    CREATE INDEX IF NOT EXISTS idx_documents_last_opened ON documents(last_opened_at);

    -- Indexes for concept junction tables (prevent O(n) scans)
    CREATE INDEX IF NOT EXISTS idx_interaction_concepts_concept ON interaction_concepts(concept_id);
    CREATE INDEX IF NOT EXISTS idx_document_concepts_concept ON document_concepts(concept_id);
    CREATE INDEX IF NOT EXISTS idx_concepts_name_lower ON concepts(name COLLATE NOCASE);
  `)
}

function migration2(
  db: Database.Database,
  options?: {
    seedFts?: FtsSeedPlan
  }
): void {
  const seedFts: FtsSeedPlan = options?.seedFts ?? {
    documents: true,
    interactions: true,
    concepts: true,
  }

  db.exec(`
    -- Highlights: persistent text highlights with notes
    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      selected_text TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'yellow',
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- Bookmarks: page-level bookmarks
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      label TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, page_number)
    );

    -- Conversations: persistent AI conversations
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      highlight_id TEXT,
      selected_text TEXT NOT NULL,
      page_context TEXT,
      page_number INTEGER,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE SET NULL
    );

    -- Conversation messages: individual messages in conversations
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      action_type TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- Indexes for new tables
    CREATE INDEX IF NOT EXISTS idx_highlights_doc ON highlights(document_id);
    CREATE INDEX IF NOT EXISTS idx_highlights_page ON highlights(document_id, page_number);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_doc ON bookmarks(document_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_doc ON conversations(document_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
    CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON conversation_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages(created_at);

    -- FTS virtual tables for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      filename,
      content='documents',
      content_rowid='rowid'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS interactions_fts USING fts5(
      selected_text,
      response,
      content='interactions',
      content_rowid='rowid'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS concepts_fts USING fts5(
      name,
      content='concepts',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync with main tables
    CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, filename) VALUES (NEW.rowid, NEW.filename);
    END;
    CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, filename) VALUES('delete', OLD.rowid, OLD.filename);
    END;
    CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, filename) VALUES('delete', OLD.rowid, OLD.filename);
      INSERT INTO documents_fts(rowid, filename) VALUES (NEW.rowid, NEW.filename);
    END;

    CREATE TRIGGER IF NOT EXISTS interactions_ai AFTER INSERT ON interactions BEGIN
      INSERT INTO interactions_fts(rowid, selected_text, response) VALUES (NEW.rowid, NEW.selected_text, NEW.response);
    END;
    CREATE TRIGGER IF NOT EXISTS interactions_ad AFTER DELETE ON interactions BEGIN
      INSERT INTO interactions_fts(interactions_fts, rowid, selected_text, response) VALUES('delete', OLD.rowid, OLD.selected_text, OLD.response);
    END;
    CREATE TRIGGER IF NOT EXISTS interactions_au AFTER UPDATE ON interactions BEGIN
      INSERT INTO interactions_fts(interactions_fts, rowid, selected_text, response) VALUES('delete', OLD.rowid, OLD.selected_text, OLD.response);
      INSERT INTO interactions_fts(rowid, selected_text, response) VALUES (NEW.rowid, NEW.selected_text, NEW.response);
    END;

    CREATE TRIGGER IF NOT EXISTS concepts_ai AFTER INSERT ON concepts BEGIN
      INSERT INTO concepts_fts(rowid, name) VALUES (NEW.rowid, NEW.name);
    END;
    CREATE TRIGGER IF NOT EXISTS concepts_ad AFTER DELETE ON concepts BEGIN
      INSERT INTO concepts_fts(concepts_fts, rowid, name) VALUES('delete', OLD.rowid, OLD.name);
    END;
    CREATE TRIGGER IF NOT EXISTS concepts_au AFTER UPDATE ON concepts BEGIN
      INSERT INTO concepts_fts(concepts_fts, rowid, name) VALUES('delete', OLD.rowid, OLD.name);
      INSERT INTO concepts_fts(rowid, name) VALUES (NEW.rowid, NEW.name);
    END;
  `)

  const seedStatements: string[] = []

  if (seedFts.documents) {
    seedStatements.push(
      `INSERT INTO documents_fts(rowid, filename) SELECT rowid, filename FROM documents;`
    )
  }

  if (seedFts.interactions) {
    seedStatements.push(
      `INSERT INTO interactions_fts(rowid, selected_text, response) SELECT rowid, selected_text, response FROM interactions;`
    )
  }

  if (seedFts.concepts) {
    seedStatements.push(`INSERT INTO concepts_fts(rowid, name) SELECT rowid, name FROM concepts;`)
  }

  if (seedStatements.length > 0) {
    db.exec(seedStatements.join('\n'))
  }
}

function migration3(db: Database.Database): void {
  db.exec(`
    -- Workspaces: groups of related documents for multi-document chat
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Junction table: documents in workspaces
    CREATE TABLE IF NOT EXISTS workspace_documents (
      workspace_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, document_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- Conversation sources: tracks multiple documents contributing to a conversation
    CREATE TABLE IF NOT EXISTS conversation_sources (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      quoted_text TEXT,
      page_number INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- Indexes for workspace tables
    CREATE INDEX IF NOT EXISTS idx_workspace_documents_workspace ON workspace_documents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_documents_document ON workspace_documents(document_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_sources_conversation ON conversation_sources(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_sources_document ON conversation_sources(document_id);
    CREATE INDEX IF NOT EXISTS idx_workspaces_updated ON workspaces(updated_at);
  `)

  // Add workspace_id column to conversations table if it doesn't exist
  const columns = db.pragma('table_info(conversations)') as Array<{ name: string }>
  const hasWorkspaceId = columns.some((col) => col.name === 'workspace_id')
  if (!hasWorkspaceId) {
    db.exec(`ALTER TABLE conversations ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);`)
  }
}
