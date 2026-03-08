let currentSessionId = null;
const MAX_SESSIONS = 5;

function parseQueries(input) {
    // Разделяем по запятым или переносам строк
    let queries = input.split(/[,\n]/)
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .slice(0, 30);
    console.log(queries.length);
    return queries;
}

async function checkActiveSessions() {
    try {
        const response = await fetch('/sessions');
        const sessions = await response.json();
        const activeCount = sessions.filter(s => s.status === 'running').length;

        document.getElementById('activeCount').textContent = activeCount;

        const runButton = document.getElementById('runButton');
        const buttonText = document.querySelector('.parser__button-text');

        if (activeCount >= MAX_SESSIONS) {
            runButton.disabled = true;
            buttonText.textContent = 'Достигнут лимит сессий (5)';
        } else {
            runButton.disabled = false;
            buttonText.textContent = 'Запустить парсер';
        }

        return activeCount;
    } catch (error) {
        console.error('Ошибка проверки сессий:', error);
        return 0;
    }
}

async function runParser() {
    // Проверяем количество активных сессий перед запуском
    const activeCount = await checkActiveSessions();

    if (activeCount >= MAX_SESSIONS) {
        alert(`Достигнут лимит одновременных сессий (${MAX_SESSIONS}). Дождитесь завершения текущих.`);
        return;
    }

    const queryInput = document.getElementById('query').value;
    const queries = parseQueries(queryInput);

    if (queries.length === 0) {
        alert('Введите хотя бы один запрос');
        return;
    }

    const status = document.getElementById('status');

    // Объединяем все запросы в одну строку с разделителем
    const combinedQuery = queries.join('|||');

    // status.innerHTML = `Запуск парсера с ${queries.length} запросами...`;

    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: combinedQuery })
        });

        const result = await response.json();

        if (result.success) {
            currentSessionId = result.sessionId;
            // status.innerHTML = `✅ Парсер запущен! ID сессии: ${result.sessionId}<br>Запросы: ${queries.join(', ')}`;
            // Обновляем список сессий
            loadSessions();
            // Обновляем счетчик активных сессий
            await checkActiveSessions();
        } else {
            status.innerHTML = 'Ошибка: ' + result.message;
        }

        console.log(result);
    } catch (error) {
        status.innerHTML = 'Ошибка: ' + error.message;
    }
}

async function loadSessions() {
    try {
        const response = await fetch('/sessions');
        const sessions = await response.json();

        let html = '<ul>';
        sessions.forEach(session => {
            const statusClass = session.status === 'completed' ? '<svg class="parser__svg-running" enable-background="new 0 0 24 24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m18 24h-12c-3.3 0-6-2.7-6-6v-12c0-3.3 2.7-6 6-6h12c3.3 0 6 2.7 6 6v12c0 3.3-2.7 6-6 6z" fill="#00adff" style="fill: rgb(22, 198, 12);"></path><path d="m9.9 15.2 9.2-9.2 1.4 1.4-10.6 10.6-6.4-6.4 1.4-1.4z" fill="#fff"></path></svg>' : '';
            // Показываем первый запрос или сокращенную версию
            const displayQuery = session.query.length > 30
                ? session.query.substring(0, 30) + '...'
                : session.query;

            html += `<li>
                        ${statusClass} Запрос: ${displayQuery} ${session.status == 'running' ? '<svg  width="60" height="60" viewBox="0 0 38 38"><g transform="translate(19 19)"><g transform="rotate(0)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.125"><animate attributeName="opacity" from="0.125" to="0.125" dur="1.2s" begin="0s" repeatCount="indefinite" keyTimes="0;1" values="1;0.125"></animate></circle></g><g transform="rotate(45)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.25"><animate attributeName="opacity" from="0.25" to="0.25" dur="1.2s" begin="0.15s" repeatCount="indefinite" keyTimes="0;1" values="1;0.25"></animate></circle></g><g transform="rotate(90)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.375"><animate attributeName="opacity" from="0.375" to="0.375" dur="1.2s" begin="0.3s" repeatCount="indefinite" keyTimes="0;1" values="1;0.375"></animate></circle></g><g transform="rotate(135)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.5"><animate attributeName="opacity" from="0.5" to="0.5" dur="1.2s" begin="0.44999999999999996s" repeatCount="indefinite" keyTimes="0;1" values="1;0.5"></animate></circle></g><g transform="rotate(180)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.625"><animate attributeName="opacity" from="0.625" to="0.625" dur="1.2s" begin="0.6s" repeatCount="indefinite" keyTimes="0;1" values="1;0.625"></animate></circle></g><g transform="rotate(225)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.75"><animate attributeName="opacity" from="0.75" to="0.75" dur="1.2s" begin="0.75s" repeatCount="indefinite" keyTimes="0;1" values="1;0.75"></animate></circle></g><g transform="rotate(270)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="0.875"><animate attributeName="opacity" from="0.875" to="0.875" dur="1.2s" begin="0.8999999999999999s" repeatCount="indefinite" keyTimes="0;1" values="1;0.875"></animate></circle></g><g transform="rotate(315)"><circle cx="0" cy="12" r="3" fill="#60A5FA" opacity="1"><animate attributeName="opacity" from="1" to="1" dur="1.2s" begin="1.05s" repeatCount="indefinite" keyTimes="0;1" values="1;1"></animate></circle></g></g></svg>' : ''}
                        ${session.status === 'completed' ? `<button class="parser__button-save" onclick="downloadSession('${session.id}')">Скачать CSV <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
</svg></button>` : ''}
                    </li>`;
        });
        html += '</ul>';

        document.getElementById('sessions').innerHTML = html;

        // Обновляем счетчик активных сессий
        await checkActiveSessions();
    } catch (error) {
        console.error('Ошибка загрузки сессий:', error);
    }
}

function downloadSession(sessionId) {
    window.location.href = `/download-csv/${sessionId}`;
}

// Обновляем список сессий каждые 5 секунд
setInterval(loadSessions, 5000);

// Загружаем при старте
loadSessions();