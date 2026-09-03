const db = require('../database');

function getSetting(key) {

    const statement = db.prepare(`
        SELECT value
        FROM settings
        WHERE key = ?
    `);

    const result = statement.get(key);

    return result ? result.value : null;
}


function setSetting(key, value) {

    const statement = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value
    `);

    return statement.run(
        key,
        value
    );
}


module.exports = {
    getSetting,
    setSetting
};