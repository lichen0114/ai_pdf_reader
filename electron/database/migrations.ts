import type Database from 'better-sqlite3'

const SCHEMA_VERSION = 2

export function runMigrations(db: Database.Database): void {
  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `)

  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
  const currentVersion = row?.version || 0

  if (currentVersion < SCHEMA_VERSION) {
    applyMigrations(db, currentVersion)
  }
}

function applyMigrations(db: Database.Database, fromVersion: number): void {
  const migrations: Array<() => void> = [
    // Migration 1: Initial schema
    () => {
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
      `)
    },

    // Migration 2: Highlights, bookmarks, conversations, and FTS
    () => {
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

      // Populate FTS tables with existing data
      db.exec(`
        INSERT INTO documents_fts(rowid, filename) SELECT rowid, filename FROM documents;
        INSERT INTO interactions_fts(rowid, selected_text, response) SELECT rowid, selected_text, response FROM interactions;
        INSERT INTO concepts_fts(rowid, name) SELECT rowid, name FROM concepts;
      `)
    },
  ]

  // Apply migrations sequentially
  db.transaction(() => {
    for (let i = fromVersion; i < migrations.length; i++) {
      migrations[i]()
    }

    // Update schema version
    db.prepare('DELETE FROM schema_version').run()
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
  })()
}
