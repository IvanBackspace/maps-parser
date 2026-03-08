const { launchBrowser, newPage } = require('./browser');
const { collectLinksForQuery } = require('./collectLinks');
const { parseDetails } = require('./checkPhones');
const fileManager = require('./fileManager');
const utils = require('./utils');
const config = require('./config');
const path = require('path');

const sessionId = process.argv[2] || process.env.SESSION_ID || 'default';
// Папка sessions находится на уровень выше папки parser
const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);

console.log(`🔧 Запуск парсера с ID сессии: ${sessionId}`);
console.log(`📂 Директория сессии: ${sessionDir}`);

async function collectAllLinks() {
    const browser = await launchBrowser();
    const page = await newPage(browser);

    const queries = await fileManager.readSearchQueries(sessionDir);
    console.log(`📝 Всего запросов для обработки: ${queries.length}`);
    queries.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));

    let allResults = {};
    let allLinks = [];

    for (const query of queries) {
        const result = await collectLinksForQuery(page, query);

        if (result.status === 'no_results') {
            allResults[query] = {
                count: 0,
                links: [],
                collected_at: new Date().toISOString(),
                status: 'no_results'
            };
        } else if (result.status === 'no_place_links') {
            allResults[query] = {
                count: 0,
                links: [],
                collected_at: new Date().toISOString(),
                status: 'no_place_links'
            };
            allLinks.push({
                query,
                link: result.searchUrl,
                collected: new Date().toISOString(),
                status: 'no_place_links'
            });
        } else {
            const links = result.links;
            allResults[query] = {
                count: links.length,
                links: links,
                collected_at: new Date().toISOString(),
                status: 'success'
            };

            const newLinks = links.map(link => ({
                query,
                link,
                collected: new Date().toISOString()
            }));
            allLinks = [...allLinks, ...newLinks];
        }

        await fileManager.saveResults(sessionDir, allResults, 'results.json');
        await fileManager.saveResults(sessionDir, allLinks, 'all_links.json');
        console.log(`Результаты сохранены для запроса "${query}"`);

        await utils.sleep(config.WAIT_BETWEEN_REQUESTS);
    }

    await browser.close();
    return { allResults, allLinks };
}

async function checkPhones() {
    const linksData = await fileManager.loadLinks(sessionDir);
    if (!linksData) {
        console.log('❌ Нет файла со ссылками');
        return;
    }

    const uniqueLinks = [...new Set(linksData.map(l => l.link))];

    const browser = await launchBrowser();
    const page = await newPage(browser);

    let results = [];
    console.log(`\n📞 Начинаем сбор данных по ${uniqueLinks.length} ссылкам`);

    for (let i = 0; i < uniqueLinks.length; i++) {
        const link = uniqueLinks[i];
        console.log(`\n[${i + 1}/${uniqueLinks.length}] Проверяем: ${link.substring(0, 100)}...`);

        const details = await parseDetails(page, link);
        if (details) {
            const linkData = linksData.find(l => l.link === link) || { query: 'Неизвестно' };

            const newItem = {
                ...details,
                link: link,
                query: linkData.query,
                collected_at: new Date().toISOString()
            };

            results.push(newItem);
            console.log(`📝 Добавлено: ${details.title}`);
            if (details.address) console.log(`   📍 Адрес: ${details.address}`);
            if (details.phone && details.phone !== 'Не найден') console.log(`   📞 Телефон: ${details.phone}`);
            if (details.website && details.website !== 'Не найден') console.log(`   🌐 Сайт: ${details.website}`);

            await fileManager.saveResults(sessionDir, results, 'results_with_details.json');
        }

        await utils.sleep(config.WAIT_BETWEEN_REQUESTS);
    }

    await browser.close();
    console.log(`\n✅ Готово! Всего записей: ${results.length}`);
}

async function main() {
    try {
        console.log('=== СБОР ССЫЛОК С GOOGLE MAPS ===');
        await collectAllLinks();

        console.log('\n=== ПРОВЕРКА ТЕЛЕФОНОВ И САЙТОВ ===\n');
        await checkPhones();

        console.log('\n✅ Все готово!');
        console.log(`📁 Файлы сохранены в: ${sessionDir}`);
    } catch (error) {
        console.error('❌ Ошибка в main:', error);
    }
}

main().catch(console.error);