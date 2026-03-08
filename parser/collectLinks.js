const utils = require('./utils');
const config = require('./config');

async function collectLinksForQuery(page, query) {
  console.log(`\n🔍 Поиск: ${query}`);

  await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}/`, {
    waitUntil: 'networkidle2',
    timeout: config.NAVIGATION_TIMEOUT
  });
  await utils.sleep(config.WAIT_AFTER_NAVIGATION);

  const noResults = await utils.hasNoResults(page);
  if (noResults) {
    console.log(`⚠️ По запросу "${query}" ничего не найдено, пропускаем...`);
    return { status: 'no_results', links: [] };
  }

  console.log('Начинаем прокрутку...');
  let previousHeight = 0;
  let attempts = 0;
  let noNewResults = false;

  while (attempts < config.MAX_SCROLL_ATTEMPTS && !noNewResults) {
    const hasEndText = await utils.hasNoMoreResults(page);
    if (hasEndText) {
      console.log('Найден текст "Больше результатов нет"');
      noNewResults = true;
      break;
    }

    await utils.scrollPage(page);
    await utils.sleep(config.WAIT_AFTER_SCROLL);

    const currentHeight = await utils.getScrollHeight(page);
    if (currentHeight === previousHeight) {
      attempts++;
      console.log(`Попытка ${attempts}: новые результаты не загружаются`);
    } else {
      attempts = 0;
      previousHeight = currentHeight;
      console.log('Загружены новые результаты, продолжаем прокрутку...');
    }
  }

  console.log('Прокрутка завершена, собираем ссылки');
  await utils.sleep(3000);

  const links = await page.evaluate(() => {
    const placeLinks = new Set();

    const selectors = [
      'a[href*="/maps/place/"]',
      'a[href*="/maps/search/"]',
      'a[jsaction*="placeCard"]'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(a => {
        if (a.href && a.href.includes('/maps/')) {
          placeLinks.add(a.href);
        }
      });
    });

    return Array.from(placeLinks);
  });

  if (links.length === 0) {
    console.log(`⚠️ Внимание: По запросу "${query}" страница загрузилась, но не найдено ссылок на места`);
    const currentUrl = page.url();
    return { status: 'no_place_links', links: [], searchUrl: currentUrl };
  }

  console.log(`✅ Найдено: ${links.length} ссылок`);
  return { status: 'success', links };
}

module.exports = { collectLinksForQuery };