const db = require('../database');


function createMemory(
    type,
    content,
    source = null,
    importance = 1
) {

    const statement = db.prepare(`
        INSERT INTO memories (
            type,
            content,
            source,
            importance
        )
        VALUES (?, ?, ?, ?)
    `);

    const result = statement.run(
        type,
        content,
        source,
        importance
    );

    return result.lastInsertRowid;
}


function getMemoryById(id) {

    const statement = db.prepare(`
        SELECT *
        FROM memories
        WHERE id = ?
    `);

    return statement.get(id);
}


function getAllMemories() {

    const statement = db.prepare(`
        SELECT *
        FROM memories
        ORDER BY importance DESC, updated_at DESC
    `);

    return statement.all();
}


function getMemoriesByType(type) {

    const statement = db.prepare(`
        SELECT *
        FROM memories
        WHERE type = ?
        ORDER BY importance DESC, updated_at DESC
    `);

    return statement.all(type);
}


function searchMemories(query) {

    const statement = db.prepare(`
        SELECT *
        FROM memories
        WHERE content LIKE ?
        ORDER BY importance DESC, updated_at DESC
    `);

    return statement.all(
        `%${query}%`
    );
}


function updateMemory(
    id,
    content,
    type = null,
    source = null,
    importance = null
) {

    const current =
        getMemoryById(id);

    if (!current) {
        return {
            success: false,
            error: 'Memoria no encontrada.'
        };
    }

    const statement = db.prepare(`
        UPDATE memories
        SET
            content = ?,
            type = ?,
            source = ?,
            importance = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const result = statement.run(
        content,
        type ?? current.type,
        source ?? current.source,
        importance ?? current.importance,
        id
    );

    return {
        success: true,
        changes: result.changes
    };
}


function deleteMemory(id) {

    const statement = db.prepare(`
        DELETE FROM memories
        WHERE id = ?
    `);

    return statement.run(id);
}


module.exports = {
    createMemory,
    getMemoryById,
    getAllMemories,
    getMemoriesByType,
    searchMemories,
    updateMemory,
    deleteMemory
};