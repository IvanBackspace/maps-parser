const puppeteer = require('puppeteer');
const config = require('./config');

async function launchBrowser() {
    return await puppeteer.launch({
        headless: 'new',
        args: config.BROWSER_ARGS,
        ignoreHTTPSErrors: config.IGNORE_HTTPS_ERRORS
    });
}

async function newPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent(config.USER_AGENT);
    return page;
}

module.exports = { launchBrowser, newPage };