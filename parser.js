const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Получаем ID сессии из аргументов командной строки или переменной окружения
const sessionId = process.argv[2] || process.env.SESSION_ID || 'default';
const sessionDir = path.join(__dirname, 'sessions', sessionId);

console.log(`🔧 Запуск парсера с ID сессии: ${sessionId}`);
console.log(`📂 Директория сессии: ${sessionDir}`);

// Создаем директорию сессии если её нет
if (!fsSync.existsSync(sessionDir)) {
    fsSync.mkdirSync(sessionDir, { recursive: true });
}

const searchQueries = [];

// Читаем запросы из файла сессии
try {
    const queryFile = path.join(sessionDir, 'search_query.txt');
    if (fsSync.existsSync(queryFile)) {
        const fileContent = fsSync.readFileSync(queryFile, 'utf8').trim();
        
        // Проверяем, содержит ли файл разделитель |||
        if (fileContent.includes('|||')) {
            // Разделяем по разделителю
            const queries = fileContent.split('|||')
                .map(q => q.trim())
                .filter(q => q.length > 0);
            
            if (queries.length > 0) {
                searchQueries.push(...queries);
                console.log(`📋 Загружено ${queries.length} запросов из файла (с разделителем |||)`);
            }
        } 
        // Проверяем, может это несколько запросов через запятую или перенос строки
        else if (fileContent.includes(',') || fileContent.includes('\n')) {
            // Разделяем по запятым или переносам строк
            const queries = fileContent.split(/[,\n]/)
                .map(q => q.trim())
                .filter(q => q.length > 0);
            
            if (queries.length > 0) {
                searchQueries.push(...queries);
                console.log(`📋 Загружено ${queries.length} запросов из файла`);
            }
        } else {
            // Один запрос
            searchQueries.push(fileContent);
            console.log(`📋 Загружен один запрос: ${fileContent}`);
        }
    }
} catch (error) {
    console.log('Используем стандартные запросы');
}

// Если нет кастомного запроса, используем стандартный
if (searchQueries.length === 0) {
    searchQueries.push('Вывод из запоя в москве');
}

console.log(`📝 Всего запросов для обработки: ${searchQueries.length}`);
searchQueries.forEach((q, i) => {
    console.log(`   ${i+1}. ${q}`);
});

// Функция для запуска браузера с правильными настройками для Docker
async function launchBrowser() {
    return await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080'
        ],
        ignoreHTTPSErrors: true
    });
}

async function collectAllLinks() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  
  // Устанавливаем User-Agent чтобы не блокировали
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Всегда начинаем с пустых результатов
  let allResults = {};
  let allLinks = [];
  console.log('Начинаем новый сбор данных');

  for (const query of searchQueries) {
    console.log(`\n🔍 Поиск: ${query}`);

    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}/`, {
        waitUntil: 'networkidle2',
        timeout: 60000
    });
    await new Promise(r => setTimeout(r, 5000));

    // Проверяем наличие сообщения "На Google Картах ничего не найдено"
    const noResultsFound = await page.evaluate(() => {
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

    if (noResultsFound) {
      console.log(`⚠️ По запросу "${query}" ничего не найдено, пропускаем...`);

      allResults[query] = {
        count: 0,
        links: [],
        collected_at: new Date().toISOString(),
        status: 'no_results'
      };

      await fs.writeFile(path.join(sessionDir, 'results.json'), JSON.stringify(allResults, null, 2));
      console.log(`Запрос "${query}" помечен как не имеющий результатов`);

      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // Прокрутка вниз
    console.log('Начинаем прокрутку...');

    let previousHeight = 0;
    let attempts = 0;
    const maxAttempts = 3;
    let noNewResults = false;

    while (attempts < maxAttempts && !noNewResults) {
      const hasEndText = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('Больше результатов нет')) {
            return true;
          }
        }
        return false;
      });

      if (hasEndText) {
        console.log('Найден текст "Больше результатов нет"');
        noNewResults = true;
        break;
      }

      await page.evaluate(() => {
        const scrollPanel = document.querySelector('div[role="feed"]') ||
          document.querySelector('div.m6QErb') ||
          document.documentElement;
        scrollPanel.scrollBy(0, 800);
      });

      await new Promise(r => setTimeout(r, 2000));

      const currentHeight = await page.evaluate(() => {
        const scrollPanel = document.querySelector('div[role="feed"]') ||
          document.querySelector('div.m6QErb') ||
          document.documentElement;
        return scrollPanel.scrollHeight;
      });

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

    await new Promise(r => setTimeout(r, 3000));

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

    if (links.length === 0) {
      console.log(`⚠️ Внимание: По запросу "${query}" страница загрузилась, но не найдено ссылок на места`);

      const currentSearchLink = page.url();
      const emptyResultLink = {
        query,
        link: currentSearchLink,
        collected: new Date().toISOString(),
        status: 'no_place_links'
      };

      allLinks = [...allLinks, emptyResultLink];
    }

    allLinks = [...allLinks, ...newLinks];

    console.log(`✅ Найдено: ${links.length} ссылок`);
    console.log(`📊 Всего собрано: ${allLinks.length} ссылок`);

    await fs.writeFile(path.join(sessionDir, 'results.json'), JSON.stringify(allResults, null, 2));
    await fs.writeFile(path.join(sessionDir, 'all_links.json'), JSON.stringify(allLinks, null, 2));
    console.log(`Результаты сохранены для запроса "${query}"`);

    await new Promise(r => setTimeout(r, 2000));
  }

  await fs.writeFile(path.join(sessionDir, 'results.json'), JSON.stringify(allResults, null, 2));
  await fs.writeFile(path.join(sessionDir, 'all_links.json'), JSON.stringify(allLinks, null, 2));

  console.log('\n✅ Готово! Все результаты сохранены');
  console.log(`📊 Всего собрано ссылок: ${allLinks.length}`);

  await browser.close();
}

async function checkPhones() {
    // Загружаем ссылки
    const linksPath = path.join(sessionDir, 'all_links.json');
    if (!fsSync.existsSync(linksPath)) {
        console.log('❌ Нет файла со ссылками');
        return;
    }

    const links = JSON.parse(await fs.readFile(linksPath, 'utf8'));
    const uniqueLinks = [...new Set(links.map(l => l.link || l.url))];
    
    const browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Устанавливаем User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    let results = [];
    
    console.log(`\n📞 Начинаем сбор данных по ${uniqueLinks.length} ссылкам`);
    
    for (let i = 0; i < uniqueLinks.length; i++) {
        const link = uniqueLinks[i];
        console.log(`\n[${i+1}/${uniqueLinks.length}] Проверяем: ${link.substring(0, 100)}...`);
        
        try {
            await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));
            
            // Получаем название
            const title = await page.evaluate(() => {
                const el = document.querySelector('h1');
                return el ? el.textContent : 'Без названия';
            });
            
            // Получаем адрес
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
            
            // Ищем телефон
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
                
                // Ищем в тексте
                const bodyText = document.body.innerText;
                const phoneMatch = bodyText.match(/(\+7|8)[\s\(\)\-]?\d{3}[\s\(\)\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
                return phoneMatch ? phoneMatch[0] : '';
            });
            
            // Ищем сайт
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
            
            // Получаем поисковый запрос из all_links
            const linkData = links.find(l => (l.link || l.url) === link);
            
            const newItem = {
                title: title,
                address: address,
                phone: phone || 'Не найден',
                website: website || 'Не найден',
                link: link,
                query: linkData ? linkData.query : 'Неизвестно',
                collected_at: new Date().toISOString()
            };
            
            results.push(newItem);
            console.log(`📝 Добавлено: ${title}`);
            if (address) console.log(`   📍 Адрес: ${address}`);
            if (phone) console.log(`   📞 Телефон: ${phone}`);
            if (website) console.log(`   🌐 Сайт: ${website}`);
            
            // Сохраняем в JSON
            await fs.writeFile(path.join(sessionDir, 'results_with_details.json'), JSON.stringify(results, null, 2));
            
        } catch (error) {
            console.log(`❌ Ошибка при обработке ${link}: ${error.message}`);
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }
    
    // Финальное сохранение в JSON
    await fs.writeFile(path.join(sessionDir, 'results_with_details.json'), JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Готово! Всего записей: ${results.length}`);
    
    await browser.close();
}

// Главная функция
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

// Запускаем
main().catch(console.error);