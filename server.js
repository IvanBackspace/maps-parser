const express = require('express');
const path = require('path');
const routes = require('./routes');
const { cleanupOldSessions } = require('./services/cleanupService');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname))); // для отдачи index.html и assets

// Подключаем маршруты
app.use('/', routes);

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Максимум одновременных сессий: 5`);
    console.log('📁 Сессии будут сохраняться в папке /sessions');

    // Очистка в папке /sessions сессий при старте
    cleanupOldSessions(20).catch(err => console.error('Ошибка при начальной очистке:', err));
});