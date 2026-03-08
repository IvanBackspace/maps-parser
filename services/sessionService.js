const { spawn } = require('child_process');
const path = require('path');
const { generateSessionId } = require('../utils/helpers');
const fileService = require('./fileService');

const MAX_CONCURRENT_SESSIONS = 5;
const activeParsers = new Map(); // sessionId -> { id, query, process, startTime, status, sessionDir }

function getActiveCount() {
    return Array.from(activeParsers.values()).filter(p => p.status === 'running').length;
}

function canStartNewSession() {
    return getActiveCount() < MAX_CONCURRENT_SESSIONS;
}

function startSession(query) {
    if (!canStartNewSession()) {
        throw new Error(`Достигнут лимит одновременных сессий (${MAX_CONCURRENT_SESSIONS})`);
    }

    const sessionId = generateSessionId();
    const sessionDir = fileService.createSessionDir(sessionId);
    fileService.saveSearchQuery(sessionDir, query);

    // Абсолютный путь к парсеру
    const parserPath = path.join(__dirname, '../parser/index.js');
    console.log(`Запуск парсера: node ${parserPath} ${sessionId}`);

    const parser = spawn('node', [parserPath, sessionId], {
        env: {
            ...process.env,
            SESSION_ID: sessionId,
            NODE_ENV: 'production',
            PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true',
            PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome-stable' // для Linux, в Windows не обязательно
        }
    });

    const sessionInfo = {
        id: sessionId,
        query,
        process: parser,
        startTime: new Date().toISOString(),
        status: 'running',
        sessionDir
    };

    activeParsers.set(sessionId, sessionInfo);

    parser.stdout.on('data', (data) => {
        console.log(`[${sessionId}] stdout: ${data}`);
    });

    parser.stderr.on('data', (data) => {
        console.error(`[${sessionId}] stderr: ${data}`);
    });

    parser.on('error', (err) => {
        console.error(`[${sessionId}] Ошибка запуска процесса:`, err);
        const session = activeParsers.get(sessionId);
        if (session) {
            session.status = 'failed';
            session.error = err.message;
        }
    });

    parser.on('close', (code) => {
        console.log(`[${sessionId}] parser exited with code ${code}`);
        const session = activeParsers.get(sessionId);
        if (session) {
            session.status = code === 0 ? 'completed' : 'failed';
            session.endTime = new Date().toISOString();
        }
    });

    return sessionId;
}

function getSessionInfo(sessionId) {
    return activeParsers.get(sessionId) || null;
}

function getAllSessions() {
    return Array.from(activeParsers.values()).map(({ id, query, status, startTime, endTime }) => ({
        id, query, status, startTime, endTime
    }));
}

function getSessionResultsPath(sessionId) {
    const session = activeParsers.get(sessionId);
    if (!session) return null;
    return path.join(session.sessionDir, 'results_with_details.json');
}

module.exports = {
    startSession,
    getSessionInfo,
    getAllSessions,
    getSessionResultsPath,
    MAX_CONCURRENT_SESSIONS,
    getActiveCount,
    canStartNewSession
};