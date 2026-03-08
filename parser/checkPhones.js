const utils = require('./utils');
const config = require('./config');

async function parseDetails(page, link) {
    console.log(`Проверяем: ${link.substring(0, 100)}...`);

    let retries = config.RETRY_ATTEMPTS;
    let success = false;

    while (retries > 0 && !success) {
        try {
            await page.goto(link, {
                waitUntil: 'domcontentloaded',
                timeout: config.NAVIGATION_TIMEOUT
            });
            await utils.sleep(3000);
            success = true;
        } catch (error) {
            retries--;
            console.log(`⚠️ Ошибка загрузки (осталось попыток: ${retries}): ${error.message}`);
            if (retries > 0) {
                console.log(`Повторная попытка через ${config.RETRY_DELAY / 1000} секунд...`);
                await utils.sleep(config.RETRY_DELAY);
            } else {
                console.log(`❌ Пропускаем ссылку после всех попыток: ${link}`);
                return null;
            }
        }
    }

    if (!success) return null;

    const title = await page.evaluate(() => {
        const el = document.querySelector('h1');
        return el ? el.textContent : 'Без названия';
    });

    const address = await page.evaluate(() => {
        const addressSelectors = [
            'button[data-item-id="address"] .Io6YTe',
            '[data-item-id="address"] .Io6YTe',
            'button[aria-label*="Адрес"] .Io6YTe'
        ];

        for (const sel of addressSelectors) {
            const el = document.querySelector(sel);
            if (el) return el.textContent.trim();
        }
        return '';
    });

    const phone = await page.evaluate(() => {
        const phoneSelectors = [
            'button[data-item-id*="phone"] .Io6YTe',
            'a[href^="tel:"]',
            'button[aria-label*="Телефон"] .Io6YTe'
        ];

        for (const sel of phoneSelectors) {
            const el = document.querySelector(sel);
            if (el) return el.textContent.trim();
        }

        const bodyText = document.body.innerText;
        const phoneMatch = bodyText.match(/(\+7|8)[\s\(\)\-]?\d{3}[\s\(\)\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
        return phoneMatch ? phoneMatch[0] : '';
    });

    const website = await page.evaluate(() => {
        const websiteSelectors = [
            'a[data-item-id="authority"]',
            'a[aria-label*="Сайт"]',
            'a[href^="http"]:not([href*="google"])'
        ];

        for (const sel of websiteSelectors) {
            const el = document.querySelector(sel);
            if (el && el.href && !el.href.includes('google.com/maps')) {
                return el.href;
            }
        }
        return '';
    });

    return {
        title,
        address,
        phone: phone || 'Не найден',
        website: website || 'Не найден'
    };
}

module.exports = { parseDetails };