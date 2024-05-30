const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'db', 'database.db');
const dbDir = path.dirname(dbPath);

function initializeDatabase() {
    const db = new Database(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT,
            filename TEXT,
            uploadDate DATETIME,
            modifyDate DATETIME,
            extension TEXT,
            size REAL,
            state TEXT,
            status TEXT DEFAULT 'В работе',
            relatedFiles TEXT,
            data BLOB
        );
        CREATE TABLE IF NOT EXISTS trash (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fileId INTEGER,
            filename TEXT,
            deleteDate DATETIME,
            data BLOB,
            FOREIGN KEY (fileId) REFERENCES files(id)
        );
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fileId INTEGER,
            filename TEXT,
            author TEXT,
            changeDate DATETIME,
            changeText TEXT,
            FOREIGN KEY (fileId) REFERENCES files(id)
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fileId INTEGER,
            author TEXT,
            comment TEXT,
            commentDate DATETIME,
            FOREIGN KEY (fileId) REFERENCES files(id)
        );
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            title TEXT,
            properties TEXT,
            metadata TEXT,
            content TEXT,
            data BLOB,
            status TEXT DEFAULT 'Ожидание',
            signatureId INTEGER,
            FOREIGN KEY (signatureId) REFERENCES signatures(id)
        );
        CREATE TABLE IF NOT EXISTS signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            certificateNumber TEXT,
            owner TEXT,
            validFrom DATE,
            validTo DATE,
            type TEXT
        );
        CREATE TABLE IF NOT EXISTS rejection_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId INTEGER,
            author TEXT,
            comment TEXT,
            commentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (documentId) REFERENCES documents(id)
        );
    `);

    return db;
}

function createDatabase() {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    return initializeDatabase();
}

let db;
try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    db = initializeDatabase();
} catch (error) {
    if (error.code === 'SQLITE_NOTADB') {
        console.error('Database file is corrupted. Recreating the database...');
        fs.unlinkSync(dbPath);
        db = createDatabase();
    } else {
        throw error;
    }
}

module.exports = db;
