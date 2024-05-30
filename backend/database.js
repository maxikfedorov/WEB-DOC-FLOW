const path = require("path");
const Database = require("better-sqlite3");
const db = new Database(path.join(__dirname, "..", "db", "database.db"));

// Создание таблиц в базе данных, если они не существуют
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
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS rejection_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documentId INTEGER,
        author TEXT,
        comment TEXT,
        commentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentId) REFERENCES documents(id)
    );
`);


module.exports = db;
