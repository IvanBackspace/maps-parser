const sessionService = require('../services/sessionService');
const fileService = require('../services/fileService');
const csvService = require('../services/csvService');
const fs = require('fs');

async function runParser(req, res) {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, message: 'Не указан поисковый запрос' });
        }

        if (!sessionService.canStartNewSession()) {
            return res.status(429).json({
                success: false,
                message: `Достигнут лимит одновременных сессий (${sessionService.MAX_CONCURRENT_SESSIONS})`
            });
        }

        const sessionId = sessionService.startSession(query);
        const activeCount = sessionService.getActiveCount();

        res.json({
            success: true,
            sessionId,
            message: 'Парсер запущен',
            activeSessions: activeCount,
            maxSessions: sessionService.MAX_CONCURRENT_SESSIONS
        });
    } catch (error) {
        console.error('Error in runParser:', error);
        res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
    }
}

function getStatus(req, res) {
    try {
        const { sessionId } = req.params;
        const session = sessionService.getSessionInfo(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Сессия не найдена' });
        }

        const resultsPath = sessionService.getSessionResultsPath(sessionId);
        const hasResults = resultsPath ? fs.existsSync(resultsPath) : false;

        res.json({
            id: session.id,
            query: session.query,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime || null,
            hasResults
        });
    } catch (error) {
        console.error('Error in getStatus:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

function downloadCsv(req, res) {
    try {
        const { sessionId } = req.params;
        const session = sessionService.getSessionInfo(sessionId);

        if (!session) {
            return res.status(404).send('Сессия не найдена');
        }

        const resultsPath = sessionService.getSessionResultsPath(sessionId);
        if (!resultsPath || !fs.existsSync(resultsPath)) {
            return res.status(404).send('Нет данных. Парсер еще не завершен или не нашел результатов.');
        }

        const results = fileService.readResultsFile(resultsPath);
        if (!results || results.length === 0) {
            return res.status(404).send('Нет данных для скачивания');
        }

        const csv = csvService.generateCsv(results);
        const filename = `google_maps_results_${sessionId}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
        res.send(csv);
    } catch (error) {
        console.error('Error in downloadCsv:', error);
        res.status(500).send('Ошибка при генерации CSV файла');
    }
}

function listSessions(req, res) {
    try {
        const sessions = sessionService.getAllSessions();
        res.json(sessions);
    } catch (error) {
        console.error('Error in listSessions:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

function getActiveCount(req, res) {
    try {
        const active = sessionService.getActiveCount();
        res.json({
            active,
            max: sessionService.MAX_CONCURRENT_SESSIONS,
            available: sessionService.MAX_CONCURRENT_SESSIONS - active
        });
    } catch (error) {
        console.error('Error in getActiveCount:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = {
    runParser,
    getStatus,
    downloadCsv,
    listSessions,
    getActiveCount
};