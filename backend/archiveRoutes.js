const express = require('express');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');
const iconv = require('iconv-lite');

const db = new Database(path.join(__dirname, '..', 'db', 'database.db')); // Обновленный путь к базе данных

// Настройка хранилища для multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        // Конвертация имени файла в UTF-8
        file.originalname = iconv.decode(Buffer.from(file.originalname, 'latin1'), 'utf-8');
        cb(null, true);
    }
});

module.exports = (app) => {
    // Маршрут для получения истории изменений с фильтрацией по времени
    app.get('/history', (req, res) => {
        const filter = req.query.filter || 'last10';
        let query = `SELECT * FROM history ORDER BY changeDate DESC`;
        let params = [];

        switch (filter) {
            case 'lastHour':
                query = `SELECT * FROM history WHERE changeDate >= datetime('now', '-1 hour') ORDER BY changeDate DESC`;
                break;
            case 'today':
                query = `SELECT * FROM history WHERE date(changeDate) = date('now') ORDER BY changeDate DESC`;
                break;
            case 'yesterday':
                query = `SELECT * FROM history WHERE date(changeDate) = date('now', '-1 day') ORDER BY changeDate DESC`;
                break;
            case 'last7Days':
                query = `SELECT * FROM history WHERE changeDate >= datetime('now', '-7 days') ORDER BY changeDate DESC`;
                break;
            case 'allTime':
                query = `SELECT * FROM history ORDER BY changeDate DESC`;
                break;
            default:
                query = `SELECT * FROM history ORDER BY changeDate DESC LIMIT 10`;
                break;
        }

        const stmt = db.prepare(query);
        const history = stmt.all(...params);
        res.json(history);
    });

    // Маршрут для очистки истории изменений
    app.post('/clear-history', (req, res) => {
        const deleteStmt = db.prepare(`DELETE FROM history`);
        deleteStmt.run();
        res.sendStatus(200);
    });

    // Маршрут для получения списка файлов
    app.get('/files', (req, res) => {
        const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
        const filterParam = req.query.filterParam === 'size' ? 'size' : 'id';
        const author = req.query.author || '';
        const filename = req.query.filename || '';
        const searchType = req.query.searchType === 'exact' ? '=' : 'LIKE';
        const authorQuery = searchType === 'LIKE' ? `%${author}%` : author;
        const filenameQuery = searchType === 'LIKE' ? `%${filename}%` : filename;

        let query = `
            SELECT id, filename, size, status FROM files 
            WHERE state = 'Current'
        `;
        const params = [];

        if (author) {
            query += ` AND author ${searchType} ?`;
            params.push(authorQuery);
        }

        if (filename) {
            query += ` AND filename ${searchType} ?`;
            params.push(filenameQuery);
        }

        query += ` ORDER BY ${filterParam} ${order}`;

        const stmt = db.prepare(query);
        const files = stmt.all(...params);
        res.json(files);
    });

    // Маршрут для загрузки файлов
    app.post('/upload', upload.single('file'), (req, res) => {
        if (!req.file) {
            return res.status(400).send('Файл не загружен');
        }

        const stmt = db.prepare(`
            INSERT INTO files (author, filename, uploadDate, modifyDate, extension, size, state, relatedFiles, data)
            VALUES (?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            req.body.username || 'guest',
            req.file.originalname,
            path.extname(req.file.originalname),
            req.file.size / 1024, // Размер файла в килобайтах
            'Current',
            JSON.stringify([]),
            req.file.buffer
        );

        // Запись в историю
        const historyStmt = db.prepare(`
            INSERT INTO history (fileId, filename, author, changeDate, changeText)
            VALUES (?, ?, ?, datetime('now'), ?)
        `);
        historyStmt.run(info.lastInsertRowid, req.file.originalname, req.body.username || 'guest', 'Файл загружен');

        res.json({ id: info.lastInsertRowid, filename: req.file.originalname, size: req.file.size / 1024 });
    });

    // Маршрут для удаления файлов (перемещение в корзину)
    app.delete('/delete/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const stmt = db.prepare(`
            SELECT * FROM files WHERE id = ?
        `);
        const fileMeta = stmt.get(id);

        if (!fileMeta) {
            return res.status(404).send('Файл не найден');
        }

        const deleteStmt = db.prepare(`
            INSERT INTO trash (fileId, filename, deleteDate, data)
            VALUES (?, ?, datetime('now'), ?)
        `);
        deleteStmt.run(id, fileMeta.filename, fileMeta.data);

        const updateStmt = db.prepare(`
            UPDATE files SET state = 'Deleted', modifyDate = datetime('now') WHERE id = ?
        `);
        updateStmt.run(id);

        // Запись в историю
        const historyStmt = db.prepare(`
            INSERT INTO history (fileId, filename, author, changeDate, changeText)
            VALUES (?, ?, ?, datetime('now'), ?)
        `);
        historyStmt.run(id, fileMeta.filename, fileMeta.author, 'Файл удалён');

        res.sendStatus(200);
    });

    // Маршрут для замены файлов
    app.post('/replace', upload.single('file'), (req, res) => {
        const oldId = parseInt(req.body.oldId);
        const stmt = db.prepare(`
            SELECT * FROM files WHERE id = ?
        `);
        const oldFileMeta = stmt.get(oldId);

        if (!oldFileMeta) {
            return res.status(404).send('Старый файл не найден');
        }

        const deleteStmt = db.prepare(`
            INSERT INTO trash (fileId, filename, deleteDate, data)
            VALUES (?, ?, datetime('now'), ?)
        `);
        deleteStmt.run(oldId, oldFileMeta.filename, oldFileMeta.data);

        const updateStmt = db.prepare(`
            UPDATE files SET state = 'Deleted', modifyDate = datetime('now') WHERE id = ?
        `);
        updateStmt.run(oldId);

        const insertStmt = db.prepare(`
            INSERT INTO files (author, filename, uploadDate, modifyDate, extension, size, state, relatedFiles, data)
            VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
        `);

        const info = insertStmt.run(
            oldFileMeta.author,
            req.file.originalname,
            oldFileMeta.uploadDate,
            path.extname(req.file.originalname),
            req.file.size / 1024, // Размер файла в килобайтах
            'Current',
            JSON.stringify([oldId]),
            req.file.buffer
        );

        // Обновление поля relatedFiles у старого файла
        const newId = info.lastInsertRowid;
        const relatedFiles = JSON.parse(oldFileMeta.relatedFiles);
        relatedFiles.push(newId);

        const updateRelatedFilesStmt = db.prepare(`
            UPDATE files SET relatedFiles = ? WHERE id = ?
        `);
        updateRelatedFilesStmt.run(JSON.stringify(relatedFiles), oldId);

        // Запись в историю
        const historyStmt = db.prepare(`
            INSERT INTO history (fileId, filename, author, changeDate, changeText)
            VALUES (?, ?, ?, datetime('now'), ?)
        `);
        historyStmt.run(oldId, oldFileMeta.filename, oldFileMeta.author, 'Файл заменён');

        res.json({ id: newId, filename: req.file.originalname, oldFilename: oldFileMeta.filename });
    });

    // Маршрут для скачивания файла
    app.get('/download/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const stmt = db.prepare(`
            SELECT filename, data FROM files WHERE id = ?
        `);
        const file = stmt.get(id);

        if (!file) {
            return res.status(404).send('Файл не найден');
        }

        const encodedFileName = encodeURIComponent(file.filename);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
        res.send(file.data);
    });

    // Маршрут для получения метаданных конкретного файла
    app.get('/metadata/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const stmt = db.prepare(`
            SELECT * FROM files WHERE id = ?
        `);
        const fileMetadata = stmt.get(id);

        if (!fileMetadata) {
            return res.status(404).send('Файл не найден');
        }

        res.json(fileMetadata);
    });

    // Маршрут для обновления статуса конкретного файла
    app.post('/update-status/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const newStatus = req.body.status;

        const updateStmt = db.prepare(`
            UPDATE files SET status = ?, modifyDate = datetime('now') WHERE id = ?
        `);
        updateStmt.run(newStatus, id);

        // Запись в историю
        const historyStmt = db.prepare(`
            INSERT INTO history (fileId, filename, author, changeDate, changeText)
            VALUES (?, (SELECT filename FROM files WHERE id = ?), 'system', datetime('now'), ?)
        `);
        historyStmt.run(id, id, `Статус изменён на ${newStatus}`);

        res.sendStatus(200);
    });

    // Маршрут для добавления комментария
    app.post('/add-comment', (req, res) => {
        const { fileId, author, comment } = req.body;
        const stmt = db.prepare(`
            INSERT INTO comments (fileId, author, comment, commentDate)
            VALUES (?, ?, ?, datetime('now'))
        `);
        stmt.run(fileId, author, comment);
        res.sendStatus(200);
    });

    // Маршрут для получения комментариев к файлу
    app.get('/comments/:fileId', (req, res) => {
        const fileId = parseInt(req.params.fileId);
        const stmt = db.prepare(`
            SELECT * FROM comments WHERE fileId = ? ORDER BY commentDate DESC
        `);
        const comments = stmt.all(fileId);
        res.json(comments);
    });

    //Очистка корзины
    app.post('/empty-trash', (req, res) => {
        const deleteStmt = db.prepare(`
            DELETE FROM trash
        `);
        deleteStmt.run();

        const updateStmt = db.prepare(`
            UPDATE files SET state = 'Purged', modifyDate = datetime('now') WHERE state = 'Deleted'
        `);
        updateStmt.run();

        res.sendStatus(200);
    });
};