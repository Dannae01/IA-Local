const db = require('../database');


function createConversation(title = 'Nueva conversación') {

    const statement = db.prepare(`
        INSERT INTO conversations (title)
        VALUES (?)
    `);

    const result = statement.run(title);

    return result.lastInsertRowid;
}


function getConversation(id) {

    const statement = db.prepare(`
        SELECT *
        FROM conversations
        WHERE id = ?
    `);

    return statement.get(id);
}


function getAllConversations() {

    const statement = db.prepare(`
        SELECT *
        FROM conversations
        ORDER BY updated_at DESC
    `);

    return statement.all();
}

function updateConversationTimestamp(id) {
    const statement = db.prepare(`
        UPDATE conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    return statement.run(id);
}

function deleteConversation(id) {

    const statement = db.prepare(`
        DELETE FROM conversations
        WHERE id = ?
    `);

    return statement.run(id);
}

function renameConversation(id, title) {

    const statement = db.prepare(`
        UPDATE conversations
        SET title = ?
        WHERE id = ?
    `);

    return statement.run(title, id);

}

module.exports = {
    createConversation,
    getConversation,
    getAllConversations,
    updateConversationTimestamp,
    deleteConversation,
    renameConversation
};