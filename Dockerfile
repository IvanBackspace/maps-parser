# Используем Node.js
FROM node:18-slim

# Устанавливаем Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Рабочая папка в контейнере
WORKDIR /app

# Копируем файлы в контейнер
COPY package*.json ./
RUN npm install
COPY . .

# Папка для результатов
RUN mkdir -p /app/sessions

EXPOSE 3000

CMD ["node", "server.js"]