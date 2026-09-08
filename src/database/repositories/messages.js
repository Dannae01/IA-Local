const db = require('../database');

const attachmentsRepository =
    require('./attachments');

function createMessage(conversationId, role, content) {

    const statement = db.prepare(`
        INSERT INTO messages (
            conversation_id,
            role,
            content
        )
        VALUES (?, ?, ?)
    `);

    const result = statement.run(
        conversationId,
        role,
        content
    );

    return result.lastInsertRowid;
}


function getMessages(conversationId) {

    const statement = db.prepare(`
        SELECT *
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
    `);

    const messages =
        statement.all(conversationId);

    return messages.map((message) => ({
        ...message,

        attachments:
            attachmentsRepository
                .getAttachmentsByMessageId(
                    message.id
                )
    }));
}


function deleteMessages(conversationId) {

    const statement = db.prepare(`
        DELETE FROM messages
        WHERE conversation_id = ?
    `);

    return statement.run(conversationId);
}


module.exports = {
    createMessage,
    getMessages,
    deleteMessages
};