const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');

/**
 * Удаляет старые папки сессий, оставляя только последние `maxKeep` штук.
 * Сортировка по дате создания папки (или модификации).
 * @param {number} maxKeep - количество последних папок, которые нужно сохранить.
 */
async function cleanupOldSessions(maxKeep = 20) {
    console.log(`🧹 Запуск очистки старых сессий (оставляем последние ${maxKeep})...`);

    try {
        // Проверяем, существует ли папка sessions
        if (!fsSync.existsSync(SESSIONS_DIR)) {
            console.log('📁 Папка sessions не найдена, очистка не требуется.');
            return;
        }

        // Получаем список всех подпапок в sessions
        const items = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
        const sessionFolders = items
            .filter(item => item.isDirectory())
            .map(dir => ({
                name: dir.name,
                path: path.join(SESSIONS_DIR, dir.name),
                // Получаем время создания (или модификации) папки
                ctime: fsSync.statSync(path.join(SESSIONS_DIR, dir.name)).birthtimeMs
            }))
            .sort((a, b) => b.ctime - a.ctime); // сортируем от новых к старым

        if (sessionFolders.length <= maxKeep) {
            console.log(`✅ Всего папок: ${sessionFolders.length}, очистка не требуется.`);
            return;
        }

        // Папки для удаления – все, кроме первых maxKeep
        const toDelete = sessionFolders.slice(maxKeep);
        console.log(`🗑 Найдено ${toDelete.length} старых папок для удаления.`);

        for (const folder of toDelete) {
            try {
                // Рекурсивно удаляем папку со всем содержимым
                await fs.rm(folder.path, { recursive: true, force: true });
                console.log(`   Удалено: ${folder.name}`);
            } catch (err) {
                console.error(`   Ошибка при удалении ${folder.name}:`, err.message);
            }
        }

        console.log('✅ Очистка завершена.');
    } catch (error) {
        console.error('❌ Ошибка во время очистки сессий:', error);
    }
}

module.exports = { cleanupOldSessions };