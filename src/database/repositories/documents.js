const db = require('../database');

function createDocument(document) {
    const statement = db.prepare(`
        INSERT INTO documents (
            name,
            path,
            extension,
            size,
            characters
        )
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = statement.run(
        document.name,
        document.path,
        document.extension,
        document.size,
        document.characters
    );

    return result.lastInsertRowid;
}


function getDocumentByPath(filePath) {
    const statement = db.prepare(`
        SELECT *
        FROM documents
        WHERE path = ?
    `);

    return statement.get(filePath);
}


function getDocumentById(id) {
    const statement = db.prepare(`
        SELECT *
        FROM documents
        WHERE id = ?
    `);

    return statement.get(id);
}


function getAllDocuments() {
    const statement = db.prepare(`
        SELECT *
        FROM documents
        ORDER BY created_at DESC
    `);

    return statement.all();
}


function deleteDocument(id) {
    const statement = db.prepare(`
        DELETE FROM documents
        WHERE id = ?
    `);

    return statement.run(id);
}


function createChunk(
    documentId,
    chunkIndex,
    content,
    embedding = null
) {
    const statement = db.prepare(`
        INSERT INTO document_chunks (
            document_id,
            chunk_index,
            content,
            embedding
        )
        VALUES (?, ?, ?, ?)
    `);

    const embeddingData =
        embedding
            ? JSON.stringify(embedding)
            : null;

    const result = statement.run(
        documentId,
        chunkIndex,
        content,
        embeddingData
    );

    return result.lastInsertRowid;
}


function getChunksByDocumentId(documentId) {
    const statement = db.prepare(`
        SELECT *
        FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_index ASC
    `);

    return statement.all(documentId);
}

function getChunkEmbedding(chunkId) {

    const statement = db.prepare(`
        SELECT embedding
        FROM document_chunks
        WHERE id = ?
    `);

    const result =
        statement.get(chunkId);

    if (
        !result ||
        !result.embedding
    ) {
        return null;
    }

    return JSON.parse(
        result.embedding
    );
}

function deleteChunksByDocumentId(documentId) {
    const statement = db.prepare(`
        DELETE FROM document_chunks
        WHERE document_id = ?
    `);

    return statement.run(documentId);
}

function deleteDocumentCompletely(documentId) {

    deleteChunksByDocumentId(documentId);

    const statement = db.prepare(`
        DELETE FROM documents
        WHERE id = ?
    `);

    return statement.run(documentId);
}

module.exports = {
    createDocument,
    getDocumentByPath,
    getDocumentById,
    getAllDocuments,
    deleteDocument,
    createChunk,
    getChunksByDocumentId,
    getChunkEmbedding,
    deleteDocumentCompletely,
    deleteChunksByDocumentId
};