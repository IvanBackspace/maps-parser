function generateCsv(data) {
    if (!data || data.length === 0) return '';

    const headers = ['Название', 'Адрес', 'Телефон', 'Сайт', 'Ссылка', 'Поисковый запрос', 'Дата сбора'];
    const escapeCsvField = (field) => `"${(field || '').replace(/"/g, '""')}"`;

    const rows = data.map(item => [
        escapeCsvField(item.title),
        escapeCsvField(item.address),
        escapeCsvField(item.phone),
        escapeCsvField(item.website),
        escapeCsvField(item.link),
        escapeCsvField(item.query),
        escapeCsvField(item.collected_at)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
}

module.exports = { generateCsv };