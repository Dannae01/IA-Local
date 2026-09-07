const db = require('../database');

function createAttachment(
    messageId,
    conversationId,
    type,
    name,
    filePath,
    mimeType = null
) {
    const statement = db.prepare(`
        INSERT INTO message_attachments (
            message_id,
            conversation_id,
            type,
            name,
            path,
            mime_type
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = statement.run(
        messageId,
        conversationId,
        type,
        name,
        filePath,
        mimeType
    );

    return result.lastInsertRowid;
}

function getAttachmentsByMessageId(
    messageId
) {
    const statement = db.prepare(`
        SELECT *
        FROM message_attachments
        WHERE message_id = ?
        ORDER BY id ASC
    `);

    return statement.all(
        messageId
    );
}

function getAttachmentsByConversationId(
    conversationId
) {
    const statement = db.prepare(`
        SELECT *
        FROM message_attachments
        WHERE conversation_id = ?
        ORDER BY id ASC
    `);

    return statement.all(
        conversationId
    );
}

module.exports = {
    createAttachment,
    getAttachmentsByMessageId,
    getAttachmentsByConversationId
};