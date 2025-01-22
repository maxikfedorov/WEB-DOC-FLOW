CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    filename TEXT,
    uploadDate DATETIME,
    modifyDate DATETIME,
    extension TEXT,
    SIZE REAL,
    state TEXT,
    status TEXT DEFAULT 'В работе',
    relatedFiles TEXT,
    DATA BLOB
);

CREATE TABLE IF NOT EXISTS trash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fileId INTEGER,
    filename TEXT,
    deleteDate DATETIME,
    DATA BLOB,
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
    COMMENT TEXT,
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
    DATA BLOB,
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
    TYPE TEXT
);

CREATE TABLE IF NOT EXISTS rejection_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId INTEGER,
    author TEXT,
    COMMENT TEXT,
    commentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documentId) REFERENCES documents(id)
);