const axios = require('axios');
const { chromium } = require('playwright-core');
const chromiumPkg = require('@sparticuz/chromium');
const config = require('./config');

class Monitor {
  constructor(telegramToken, telegramChatId) {
    this.telegramToken = telegramToken;
    this.telegramChatId = telegramChatId;
    this.telegramApi = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    this.browser = null;
    this.context = null;
  }

  log(msg, level = 'info') {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
  }

  /* ===========================
     BROWSER
  =========================== */
  async ensureBrowser() {
    if (this.browser && this.browser.isConnected()) return this.browser;

    this.log('🌐 Lancement Chromium...');
    this.browser = await chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true
    });

    this.log('✅ Chromium prêt');
    return this.browser;
  }

  async ensureContext() {
    if (this.context) return this.context;

    const browser = await this.ensureBrowser();
    this.context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    });

    this.log('✅ Context prêt');
    return this.context;
  }

  async withPage(fn) {
    const context = await this.ensureContext();
    const page = await context.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close().catch(() => {});
    }
  }

  /* ===========================
     PAGE LOAD (ANTI TIMEOUT + RETRY)
  =========================== */
  async loadPage(page, url, retries = 2) {
    this.log(`➡️ Chargement ${url}`);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(5000);
        return;
      } catch (err) {
        if (attempt < retries) {
          this.log(`⚠️ Retry ${attempt + 1} après erreur : ${err.message}`);
          await this.sleep(5000 + Math.random() * 5000);
        } else throw err;
      }
    }
  }

  /* ===========================
     SUPPLY EXTRACTION (JS RÉEL)
  =========================== */
  async extractSupply(page) {
    return await page.evaluate(() => {
      const container = document.querySelector(
        'div[data-testid="CONTEXTUAL_SEARCH_TITLE"]'
      );
      if (!container) return { value: 0, occurrences: 0 };

      const spans = [...container.querySelectorAll('span')];
      const numbers = spans
        .map(s => s.textContent.trim())
        .filter(t => /^\d+$/.test(t))
        .map(Number);

      if (!numbers.length) return { value: 0, occurrences: 0 };

      return {
        value: Math.max(...numbers),
        occurrences: numbers.length
      };
    });
  }

  /* ===========================
     CHECK URL
  =========================== */
  async checkUrl(urlConfig) {
    const { name, url, threshold = 1 } = urlConfig;
    this.log(`\n🔍 ${name}`);

    try {
      const result = await this.withPage(async page => {
        await this.loadPage(page, url);
        return await this.extractSupply(page);
      });

      this.log(`📊 Annonces détectées : ${result.value} (seuil ≥${threshold})`);

      if (result.value >= threshold) {
        await this.sendTelegram(
          `🚨 <b>Alerte logement</b>\n\n` +
          `📍 <b>${name}</b>\n` +
          `📊 Annonces : <b>${result.value}</b>\n` +
          `⚠️ Seuil : ≥${threshold}\n\n` +
          `🔗 <a href="${url}">Voir</a>`
        );
      } else {
        this.log('ℹ️ Seuil non atteint');
      }

    } catch (err) {
      this.log(`❌ Erreur ${name}: ${err.message}`, 'error');
    }
  }

  /* ===========================
     TELEGRAM
  =========================== */
  async sendTelegram(text) {
    await axios.post(this.telegramApi, {
      chat_id: this.telegramChatId,
      text,
      parse_mode: 'HTML'
    });
    this.log('✉️ Telegram envoyé');
  }

  async sendStartup() {
    await this.sendTelegram(
      `🚀 <b>Monitor démarré</b>\n\n` +
      `🧠 Détection JS réelle (Playwright)\n\n` +
      `📍 Zones surveillées:\n` +
      config.urls
        .map((u, i) => `${i + 1}. ${u.name} (≥${u.threshold ?? 1})`)
        .join('\n')
    );
  }

  /* ===========================
     MAIN
  =========================== */
  async runMonitoring() {
    this.log('█'.repeat(50));
    this.log('🏠 MONITORING QUINTOANDAR');
    this.log('█'.repeat(50));

    for (const u of config.urls) {
      await this.checkUrl(u);
      await this.sleep(5000 + Math.random() * 5000); // pause aléatoire entre URL
    }

    this.log('✅ Fin monitoring');
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = Monitor;
