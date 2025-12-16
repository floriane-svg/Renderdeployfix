const axios = require('axios');
const { chromium } = require('playwright-core');
const chromiumPkg = require('@sparticuz/chromium');
const config = require('./config');

const HARD_TIMEOUT = 45000;

class Monitor {
  constructor(token, chatId) {
    this.telegramApi = `https://api.telegram.org/bot${token}/sendMessage`;
    this.chatId = chatId;
    this.browser = null;
    this.context = null;
  }

  log(msg, level = 'info') {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
  }

  async ensureBrowser() {
    if (this.browser?.isConnected()) return;
    this.browser = await chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true
    });
  }

  async ensureContext() {
    if (this.context) return;
    await this.ensureBrowser();
    this.context = await this.browser.newContext({
      userAgent: this.randomUA(),
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo'
    });

    await this.context.route('**/*.{png,jpg,jpeg,svg,woff,woff2,ttf,mp4}', r => r.abort());
  }

  randomUA() {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36'
    ];
    return uas[Math.floor(Math.random() * uas.length)];
  }

  async hardTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('HARD TIMEOUT')), HARD_TIMEOUT)
      )
    ]);
  }

  async checkUrl({ name, url, threshold }) {
    this.log(`🔍 ${name}`);
    await this.ensureContext();
    const page = await this.context.newPage();

    try {
      await this.hardTimeout(page.goto(url, { waitUntil: 'domcontentloaded' }));
      await page.waitForTimeout(2000);

      const value = await page.evaluate(() => {
        const c = document.querySelector('div[data-testid="CONTEXTUAL_SEARCH_TITLE"]');
        if (!c) return null;
        const nums = [...c.querySelectorAll('span')]
          .map(s => parseInt(s.textContent))
          .filter(n => !isNaN(n));
        return nums.length ? Math.max(...nums) : null;
      });

      if (value === null) {
        this.log(`⚠️ ${name} → valeur inconnue`);
        return;
      }

      this.log(`📊 ${name} : ${value}`);

      if (value >= threshold) {
        await axios.post(this.telegramApi, {
          chat_id: this.chatId,
          parse_mode: 'HTML',
          text: `🚨 <b>${name}</b>\n📊 ${value}\n<a href="${url}">Voir</a>`
        });
      }
    } catch (e) {
      this.log(`⚠️ SKIP ${name} (${e.message})`, 'warn');
    } finally {
      await page.close().catch(() => {});
    }
  }

  async runMonitoring() {
    this.log('🏠 MONITORING START');
    for (const u of config.urls) {
      await this.checkUrl(u);
      await new Promise(r => setTimeout(r, 3000));
    }
    this.log('✅ MONITORING DONE');
  }

  async shutdown() {
    await this.context?.close();
    await this.browser?.close();
  }
}

module.exports = Monitor;
