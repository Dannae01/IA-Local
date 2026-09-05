const db = require('./database');

function initializeDatabase() {

    db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );


        CREATE TABLE IF NOT EXISTS messages (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            conversation_id INTEGER NOT NULL,

            role TEXT NOT NULL,

            content TEXT NOT NULL,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (conversation_id)
                REFERENCES conversations(id)
                ON DELETE CASCADE

        );


        CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id);


        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );


        CREATE TABLE IF NOT EXISTS documents (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            path TEXT NOT NULL UNIQUE,

            extension TEXT,

            size INTEGER,

            characters INTEGER,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );


        CREATE TABLE IF NOT EXISTS document_chunks (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            document_id INTEGER NOT NULL,

            chunk_index INTEGER NOT NULL,

            content TEXT NOT NULL,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (document_id)
                REFERENCES documents(id)
                ON DELETE CASCADE

        );


        CREATE INDEX IF NOT EXISTS idx_document_chunks_document
        ON document_chunks(document_id);

        CREATE TABLE IF NOT EXISTS conversation_documents (
            conversation_id INTEGER NOT NULL,
            document_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            PRIMARY KEY (
                conversation_id,
                document_id
            ),

            FOREIGN KEY (conversation_id)
                REFERENCES conversations(id)
                ON DELETE CASCADE,

            FOREIGN KEY (document_id)
                REFERENCES documents(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS memories (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            type TEXT NOT NULL,

            content TEXT NOT NULL,

            source TEXT,

            importance INTEGER DEFAULT 1,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_memories_type
        ON memories(type);

        CREATE INDEX IF NOT EXISTS idx_memories_importance
        ON memories(importance);

        CREATE INDEX IF NOT EXISTS
        idx_conversation_documents_conversation
        ON conversation_documents(conversation_id);

        CREATE INDEX IF NOT EXISTS
        idx_conversation_documents_document
        ON conversation_documents(document_id);

    `);

    try {

        db.exec(`
            ALTER TABLE document_chunks
            ADD COLUMN embedding TEXT;
        `);

    } catch (error) {

        if (
            !error.message.includes(
                'duplicate column name'
            )
        ) {
            throw error;
        }

    }

    try {
        db.prepare(`
            ALTER TABLE memories
            ADD COLUMN embedding TEXT
        `).run();
    } catch (error) {
        if (!error.message.includes('duplicate column name')) {
            throw error;
        }
    }

    console.log('Tablas de NOVA inicializadas.');
}

module.exports = {
    initializeDatabase
};