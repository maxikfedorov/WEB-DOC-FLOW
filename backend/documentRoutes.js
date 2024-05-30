const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");
const { getMetadata } = require("docx-templates");
const db = require("./database");
const router = express.Router();
const upload = multer({ dest: "uploads/" });
const iconv = require("iconv-lite");

router.post("/upload", upload.single("docxFile"), async (req, res) => {
    const filePath = path.join(__dirname, "..", req.file.path);
    const fileBuffer = fs.readFileSync(filePath);

    try {
        req.file.originalname = iconv.decode(
            Buffer.from(req.file.originalname, "latin1"),
            "utf-8"
        );
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        let content = result.value;
        content = content.replace(/(\r\n|\n|\r){2,}/g, "\n").trim();
        const metadata = await getMetadata(fileBuffer);
        const properties = {
            pages: metadata.pages,
            words: metadata.words,
            characters: metadata.characters,
            lines: metadata.lines,
            paragraphs: metadata.paragraphs,
            template: metadata.template,
        };
        const documentMetadata = {
            creator: metadata.creator,
            lastModifiedBy: metadata.lastModifiedBy,
            revision: metadata.revision,
            created: metadata.created,
            modified: metadata.modified,
        };

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

        res.json({
            title: metadata.title || "Заголовок документа",
            properties,
            metadata: documentMetadata,
            content,
        });
    } catch (error) {
        console.error("Ошибка при обработке файла:", error);
        res.status(500).json({
            error: `Ошибка при обработке файла: ${error.message}`,
        });
    } finally {
        fs.unlinkSync(filePath);
    }
});

router.get("/documents", (req, res) => {
	const stmt = db.prepare(`SELECT id, filename FROM documents`);
	const documents = stmt.all();
	res.json(documents);
});

router.get("/documents/:id", (req, res) => {
	const id = parseInt(req.params.id);
	const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
	const document = stmt.get(id);
	if (!document) {
		return res.status(404).send("Документ не найден");
	}
	res.json(document);
});

router.get("/documents/:id/comments", (req, res) => {
    const id = parseInt(req.params.id);
    const stmt = db.prepare(`SELECT author, comment, commentDate FROM rejection_comments WHERE documentId = ?`);
    const comments = stmt.all(id);
    res.json(comments);
});



router.post("/archive/:id", (req, res) => {
	const id = parseInt(req.params.id);
	const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
	const document = stmt.get(id);

	if (!document) {
		return res.status(404).send("Документ не найден");
	}

	const insertStmt = db.prepare(`
      INSERT INTO files (author, filename, uploadDate, modifyDate, extension, size, state, relatedFiles, data)
      VALUES (?, ?, datetime('now'), datetime('now'), ?, ?, 'Current', ?, ?)
    `);
	const info = insertStmt.run(
		"system", // author
		document.filename,
		path.extname(document.filename),
		Buffer.byteLength(document.content, "utf-8") / 1024, // size in KB
		JSON.stringify([]), // relatedFiles
		document.data,
	);

	const deleteStmt = db.prepare(`DELETE FROM documents WHERE id = ?`);
	deleteStmt.run(id);

	// Запись в историю изменений
	const historyStmt = db.prepare(`
      INSERT INTO history (fileId, filename, author, changeDate, changeText)
      VALUES (?, ?, ?, datetime('now'), ?)
    `);
	historyStmt.run(
		info.lastInsertRowid,
		document.filename,
		"system",
		"Файл вышел из оборота",
	);

	res.sendStatus(200);
});

// Маршрут для изменения статуса документа
router.post('/update-status/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const newStatus = req.body.status;
  const updateStmt = db.prepare(`UPDATE documents SET status = ? WHERE id = ?`);
  updateStmt.run(newStatus, id);
  res.sendStatus(200);
});

router.post("/sign/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const { certificateNumber, owner, validFrom, validTo, type } = req.body;

    const insertSignatureStmt = db.prepare(`
        INSERT INTO signatures (certificateNumber, owner, validFrom, validTo, type)
        VALUES (?, ?, ?, ?, ?)
    `);
    const signatureInfo = insertSignatureStmt.run(certificateNumber, owner, validFrom, validTo, type);

    const updateDocumentStmt = db.prepare(`
        UPDATE documents SET status = 'Подписанный', signatureId = ? WHERE id = ?
    `);
    updateDocumentStmt.run(signatureInfo.lastInsertRowid, id);

    res.sendStatus(200);
});

// Маршрут для получения данных подписи по ID
router.get('/signatures/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const stmt = db.prepare(`SELECT * FROM signatures WHERE id = ?`);
    const signature = stmt.get(id);
    if (!signature) {
        return res.status(404).send("Подпись не найдена");
    }
    res.json(signature);
});

// Маршрут для отклонения документа
router.post('/reject/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { author, comment } = req.body;

    if (!author || !comment) {
        return res.status(400).json({ error: "Автор и комментарий обязательны для заполнения" });
    }

    const updateStmt = db.prepare(`UPDATE documents SET status = 'Отклонённый' WHERE id = ?`);
    updateStmt.run(id);

    const insertCommentStmt = db.prepare(`
        INSERT INTO rejection_comments (documentId, author, comment)
        VALUES (?, ?, ?)
    `);
    insertCommentStmt.run(id, author, comment);

    res.sendStatus(200);
});



// Маршрут для отзыва документа
router.post('/revoke/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updateStmt = db.prepare(`UPDATE documents SET status = 'Ожидание' WHERE id = ?`);
  updateStmt.run(id);
  res.sendStatus(200);
});

// Маршрут для пересмотра документа
router.post('/review/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updateStmt = db.prepare(`UPDATE documents SET status = 'Ожидание' WHERE id = ?`);
  updateStmt.run(id);
  res.sendStatus(200);
});

// Маршрут для уничтожения документа
router.post('/destroy/:id', (req, res) => {
  const id = parseInt(req.params.id);

  // Удаление зависимых записей из таблицы rejection_comments
  const deleteRejectionCommentsStmt = db.prepare(`DELETE FROM rejection_comments WHERE documentId = ?`);
  deleteRejectionCommentsStmt.run(id);

  // Удаление зависимых записей из таблицы comments
  const deleteCommentsStmt = db.prepare(`DELETE FROM comments WHERE fileId = ?`);
  deleteCommentsStmt.run(id);

  // Удаление самого документа
  const deleteStmt = db.prepare(`DELETE FROM documents WHERE id = ?`);
  deleteStmt.run(id);

  res.sendStatus(200);
});





// Маршрут для получения документов по статусу
router.get('/documents/status/:status', (req, res) => {
  const status = req.params.status;
  const stmt = db.prepare(`SELECT * FROM documents WHERE status = ?`);
  const documents = stmt.all(status);
  res.json(documents);
});



module.exports = router;
