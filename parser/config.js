module.exports = {
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080'
  ],
  IGNORE_HTTPS_ERRORS: true,
  NAVIGATION_TIMEOUT: 60000,
  WAIT_AFTER_NAVIGATION: 5000,
  WAIT_AFTER_SCROLL: 2000,
  WAIT_BETWEEN_REQUESTS: 2000,
  MAX_SCROLL_ATTEMPTS: 3,
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 5000
};