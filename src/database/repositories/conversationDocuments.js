const db = require('../database');

function addDocumentToConversation(
    conversationId,
    documentId
) {
    const statement = db.prepare(`
        INSERT OR IGNORE INTO conversation_documents (
            conversation_id,
            document_id
        )
        VALUES (?, ?)
    `);

    return statement.run(
        conversationId,
        documentId
    );
}

function getDocumentsByConversationId(
    conversationId
) {
    const statement = db.prepare(`
        SELECT
            d.*
        FROM conversation_documents cd
        INNER JOIN documents d
            ON d.id = cd.document_id
        WHERE cd.conversation_id = ?
        ORDER BY cd.created_at ASC
    `);

    return statement.all(
        conversationId
    );
}

function getDocumentIdsByConversationId(
    conversationId
) {
    const statement = db.prepare(`
        SELECT document_id
        FROM conversation_documents
        WHERE conversation_id = ?
    `);

    return statement
        .all(conversationId)
        .map(row => row.document_id);
}

function removeDocumentFromConversation(
    conversationId,
    documentId
) {
    const statement = db.prepare(`
        DELETE FROM conversation_documents
        WHERE conversation_id = ?
        AND document_id = ?
    `);

    return statement.run(
        conversationId,
        documentId
    );
}

module.exports = {
    addDocumentToConversation,
    getDocumentsByConversationId,
    getDocumentIdsByConversationId,
    removeDocumentFromConversation
};