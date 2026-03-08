const config = require('./config');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollPage(page) {
    await page.evaluate(() => {
        const scrollPanel = document.querySelector('div[role="feed"]') ||
            document.querySelector('div.m6QErb') ||
            document.documentElement;
        scrollPanel.scrollBy(0, 800);
    });
}

async function hasNoMoreResults(page) {
    return await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
            if (el.textContent && el.textContent.includes('Больше результатов нет')) {
                return true;
            }
        }
        return false;
    });
}

async function hasNoResults(page) {
    return await page.evaluate(() => {
        const noResultsElement = document.querySelector('div.Q2vNVc.fontHeadlineSmall');
        if (noResultsElement && noResultsElement.textContent.includes('На Google Картах ничего не найдено')) {
            return true;
        }

        const altSelectors = [
            'div[class*="Q2vNVc"]',
            'div.fontHeadlineSmall',
            'div.section-no-results',
            'div[role="main"] p:first-child'
        ];

        for (const selector of altSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                if (el.textContent && el.textContent.includes('ничего не найдено')) {
                    return true;
                }
            }
        }

        return false;
    });
}

async function getScrollHeight(page) {
    return await page.evaluate(() => {
        const scrollPanel = document.querySelector('div[role="feed"]') ||
            document.querySelector('div.m6QErb') ||
            document.documentElement;
        return scrollPanel.scrollHeight;
    });
}

module.exports = {
    sleep,
    scrollPage,
    hasNoMoreResults,
    hasNoResults,
    getScrollHeight
};