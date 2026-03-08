const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');

function ensureSessionsDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
}

function createSessionDir(sessionId) {
    ensureSessionsDir();
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
}

function saveSearchQuery(sessionDir, query) {
    fs.writeFileSync(path.join(sessionDir, 'search_query.txt'), query);
}

function readResultsFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

module.exports = {
    createSessionDir,
    saveSearchQuery,
    readResultsFile,
    SESSIONS_DIR
};