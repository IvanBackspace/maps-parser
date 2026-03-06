const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Хранилище для активных парсеров
let activeParsers = {};
const MAX_CONCURRENT_SESSIONS = 5;

// Функция для генерации уникального ID на основе даты и времени
function generateSessionId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Функция для подсчета активных сессий
function getActiveSessionsCount() {
    return Object.values(activeParsers).filter(p => p.status === 'running').length;
}

// Эндпоинт для запуска нового парсера
app.post('/run', (req, res) => {
    // Проверяем количество активных сессий
    const activeCount = getActiveSessionsCount();
    
    if (activeCount >= MAX_CONCURRENT_SESSIONS) {
        console.log(`❌ Отказ в запуске: достигнут лимит сессий (${activeCount}/${MAX_CONCURRENT_SESSIONS})`);
        return res.status(429).json({ 
            success: false, 
            message: `Достигнут лимит одновременных сессий (${MAX_CONCURRENT_SESSIONS}). Дождитесь завершения текущих.`
        });
    }

    const query = req.body.query;
    const sessionId = generateSessionId();
    
    console.log(`\n🆕 Запуск нового парсера с ID: ${sessionId}`);
    console.log(`📝 Запрос: ${query}`);
    console.log(`📊 Активных сессий: ${activeCount + 1}/${MAX_CONCURRENT_SESSIONS}`);

    // Создаем директорию для сессии
    const sessionDir = path.join(__dirname, 'sessions', sessionId);
    if (!fs.existsSync(path.join(__dirname, 'sessions'))) {
        fs.mkdirSync(path.join(__dirname, 'sessions'), { recursive: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });

    // Создаем файл с запросом в директории сессии
    fs.writeFileSync(path.join(sessionDir, 'search_query.txt'), query);

    // Запускаем парсер с параметром сессии и правильными переменными окружения
    const parser = spawn('node', ['parser.js', sessionId], {
        env: { 
            ...process.env, 
            SESSION_ID: sessionId,
            NODE_ENV: 'production',
            PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true',
            PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome-stable'
        }
    });

    // Сохраняем информацию о парсере
    activeParsers[sessionId] = {
        id: sessionId,
        query: query,
        process: parser,
        startTime: new Date().toISOString(),
        status: 'running',
        sessionDir: sessionDir
    };

    // Обработка вывода
    parser.stdout.on('data', (data) => {
        console.log(`[${sessionId}] stdout: ${data}`);
    });

    parser.stderr.on('data', (data) => {
        console.error(`[${sessionId}] stderr: ${data}`);
    });

    parser.on('close', (code) => {
        console.log(`[${sessionId}] Парсер завершен с кодом ${code}`);
        if (activeParsers[sessionId]) {
            activeParsers[sessionId].status = 'completed';
            activeParsers[sessionId].endTime = new Date().toISOString();
            
            const remainingActive = getActiveSessionsCount();
            console.log(`📊 Активных сессий осталось: ${remainingActive}/${MAX_CONCURRENT_SESSIONS}`);
        }
    });

    // Сразу отправляем ID сессии
    res.json({ 
        success: true, 
        sessionId: sessionId,
        message: 'Парсер запущен',
        activeSessions: activeCount + 1,
        maxSessions: MAX_CONCURRENT_SESSIONS
    });
});

// Эндпоинт для проверки статуса парсера
app.get('/status/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    if (!activeParsers[sessionId]) {
        return res.status(404).json({ error: 'Сессия не найдена' });
    }

    const parser = activeParsers[sessionId];
    const resultsPath = path.join(parser.sessionDir, 'results_with_details.json');
    
    let hasResults = false;
    try {
        hasResults = fs.existsSync(resultsPath);
    } catch (e) {}

    res.json({
        id: sessionId,
        query: parser.query,
        status: parser.status,
        startTime: parser.startTime,
        endTime: parser.endTime || null,
        hasResults: hasResults
    });
});

// Эндпоинт для скачивания CSV конкретной сессии
app.get('/download-csv/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    if (!activeParsers[sessionId]) {
        return res.status(404).send('Сессия не найдена');
    }

    const parser = activeParsers[sessionId];
    const resultsPath = path.join(parser.sessionDir, 'results_with_details.json');

    // Проверяем наличие результатов
    if (!fs.existsSync(resultsPath)) {
        return res.status(404).send('Нет данных. Парсер еще не завершен или не нашел результатов.');
    }

    try {
        const data = fs.readFileSync(resultsPath, 'utf8');
        const results = JSON.parse(data);

        if (results.length === 0) {
            return res.status(404).send('Нет данных для скачивания');
        }

        // Генерируем CSV строку
        const headers = ['Название', 'Адрес', 'Телефон', 'Сайт', 'Ссылка', 'Поисковый запрос', 'Дата сбора'];
        
        let csvContent = headers.join(',') + '\n';
        
        results.forEach(item => {
            const row = [
                `"${(item.title || '').replace(/"/g, '""')}"`,
                `"${(item.address || '').replace(/"/g, '""')}"`,
                `"${(item.phone || '').replace(/"/g, '""')}"`,
                `"${(item.website || '').replace(/"/g, '""')}"`,
                `"${(item.link || '').replace(/"/g, '""')}"`,
                `"${(item.query || '').replace(/"/g, '""')}"`,
                `"${(item.collected_at || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        // Отправляем как файл для скачивания
        const filename = `google_maps_results_${sessionId}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
        res.send(csvContent);

    } catch (error) {
        console.error(`Ошибка при генерации CSV для сессии ${sessionId}:`, error);
        res.status(500).send('Ошибка при генерации CSV файла');
    }
});

// Эндпоинт для получения списка всех сессий
app.get('/sessions', (req, res) => {
    const sessionsList = Object.values(activeParsers).map(p => ({
        id: p.id,
        query: p.query,
        status: p.status,
        startTime: p.startTime,
        endTime: p.endTime
    }));
    res.json(sessionsList);
});

// Эндпоинт для получения количества активных сессий
app.get('/active-count', (req, res) => {
    const activeCount = getActiveSessionsCount();
    res.json({ 
        active: activeCount, 
        max: MAX_CONCURRENT_SESSIONS,
        available: MAX_CONCURRENT_SESSIONS - activeCount 
    });
});

// Запускаем сервер на всех интерфейсах
app.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Сервер запущен на http://localhost:3000');
    console.log(`📊 Максимум одновременных сессий: ${MAX_CONCURRENT_SESSIONS}`);
    console.log('📁 Сессии будут сохраняться в папке /sessions');
});