const db = require('../database');


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

    return statement.all(conversationId);
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