const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const iconv = require('iconv-lite');
const db = require('./database'); // Импорт базы данных из нового файла
const archiveRoutes = require('./archiveRoutes'); // Подключение нового файла с маршрутами архива
const documentRoutes = require('./documentRoutes'); // Подключение нового файла с маршрутами документооборота

const app = express();
const PORT = 3000;

// Настройка CORS
app.use(cors());

// Для обработки JSON данных
app.use(express.json());

// Использование статических файлов
app.use(express.static(path.join(__dirname, '..', 'public'))); // Обновленный путь к статическим файлам

// Настройка шаблонного движка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'public', 'document-management'));

// Использование статических файлов
app.use('/archive', express.static(path.join(__dirname, '..', 'public', 'archive'))); // Обновленный путь
app.use('/document-management', express.static(path.join(__dirname, '..', 'public', 'document-management'))); // Обновленный путь
app.use('/media', express.static(path.join(__dirname, '..', 'public', 'media'))); // Обновленный путь

// Перенаправление с корневого URL на /archive
app.get('/', (req, res) => {
    res.redirect('/archive');
});

// Подключение маршрутов архива
archiveRoutes(app);


app.use('/document-management', documentRoutes); // Подключение маршрутов документооборота


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
