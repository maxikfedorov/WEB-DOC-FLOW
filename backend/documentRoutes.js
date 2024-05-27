const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const { getMetadata } = require('docx-templates');
const db = require('./database');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const iconv = require('iconv-lite');

router.post('/upload', upload.single('docxFile'), async (req, res) => {
    const filePath = path.join(__dirname, '..', req.file.path);
    const fileBuffer = fs.readFileSync(filePath);
  
    try {
      req.file.originalname = iconv.decode(Buffer.from(req.file.originalname, 'latin1'), 'utf-8');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      let content = result.value;
      content = content.replace(/(\r\n|\n|\r){2,}/g, '\n').trim();
      const metadata = await getMetadata(fileBuffer);
      const properties = { pages: metadata.pages, words: metadata.words, characters: metadata.characters, lines: metadata.lines, paragraphs: metadata.paragraphs, template: metadata.template };
      const documentMetadata = { creator: metadata.creator, lastModifiedBy: metadata.lastModifiedBy, revision: metadata.revision, created: metadata.created, modified: metadata.modified };
  
      const stmt = db.prepare(`
        INSERT INTO documents (filename, title, properties, metadata, content, data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        req.file.originalname,
        metadata.title || "Заголовок документа",
        JSON.stringify(properties),
        JSON.stringify(documentMetadata),
        content,
        fileBuffer
      );
  
      res.json({ title: metadata.title || "Заголовок документа", properties, metadata: documentMetadata, content });
    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      res.status(500).json({ error: `Ошибка при обработке файла: ${error.message}` });
    } finally {
      fs.unlinkSync(filePath);
    }
  });

router.get('/documents', (req, res) => {
    const stmt = db.prepare(`SELECT id, filename FROM documents`);
    const documents = stmt.all();
    res.json(documents);
});

router.get('/documents/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
    const document = stmt.get(id);
    if (!document) {
        return res.status(404).send('Документ не найден');
    }
    res.json(document);
});

router.post('/archive/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
    const document = stmt.get(id);
  
    if (!document) {
      return res.status(404).send('Документ не найден');
    }
  
    const insertStmt = db.prepare(`
      INSERT INTO files (author, filename, uploadDate, modifyDate, extension, size, state, relatedFiles, data)
      VALUES (?, ?, datetime('now'), datetime('now'), ?, ?, 'Current', ?, ?)
    `);
    const info = insertStmt.run(
      'system', // author
      document.filename,
      path.extname(document.filename),
      Buffer.byteLength(document.content, 'utf-8') / 1024, // size in KB
      JSON.stringify([]), // relatedFiles
      document.data
    );
  
    const deleteStmt = db.prepare(`DELETE FROM documents WHERE id = ?`);
    deleteStmt.run(id);
  
    // Запись в историю изменений
    const historyStmt = db.prepare(`
      INSERT INTO history (fileId, filename, author, changeDate, changeText)
      VALUES (?, ?, ?, datetime('now'), ?)
    `);
    historyStmt.run(info.lastInsertRowid, document.filename, 'system', 'Файл вышел из оборота');
  
    res.sendStatus(200);
  });


module.exports = router;
