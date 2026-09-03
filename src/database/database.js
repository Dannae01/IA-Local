const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataPath = path.join(__dirname, '../../data');

if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

const dbPath = path.join(dataPath, 'nova.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

console.log('Base de datos de NOVA conectada.');

module.exports = db;