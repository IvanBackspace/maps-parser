const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

async function readSearchQueries(sessionDir) {
    const queryFile = path.join(sessionDir, 'search_query.txt');
    if (!fsSync.existsSync(queryFile)) {
        return ['Вывод из запоя в москве'];
    }

    const fileContent = await fs.readFile(queryFile, 'utf8');
    const trimmed = fileContent.trim();
    if (!trimmed) return ['Вывод из запоя в москве'];

    if (trimmed.includes('|||')) {
        return trimmed.split('|||').map(q => q.trim()).filter(q => q);
    }

    if (trimmed.includes(',') || trimmed.includes('\n')) {
        return trimmed.split(/[,\n]/).map(q => q.trim()).filter(q => q);
    }

    return [trimmed];
}

async function saveResults(sessionDir, data, filename) {
    const filePath = path.join(sessionDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function loadLinks(sessionDir) {
    const linksPath = path.join(sessionDir, 'all_links.json');
    if (!fsSync.existsSync(linksPath)) {
        return null;
    }
    const content = await fs.readFile(linksPath, 'utf8');
    return JSON.parse(content);
}

module.exports = {
    readSearchQueries,
    saveResults,
    loadLinks
};