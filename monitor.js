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

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  /* ===========================
     BROWSER / CONTEXT
  =========================== */

  async ensureBrowser() {
    if (this.browser && this.browser.isConnected()) return this.browser;

    this.log('🌐 Initialisation navigateur...');
    this.browser = await chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true
    });

    this.browser.on('disconnected', () => {
      this.log('⚠️ Navigateur déconnecté', 'warn');
      this.browser = null;
      this.context = null;
    });

    this.log('✅ Navigateur OK');
    return this.browser;
  }

  async ensureContext() {
    if (this.context) {
      try {
        if (this.context.browser()?.isConnected()) return this.context;
      } catch (_) {}
      this.context = null;
    }

    const browser = await this.ensureBrowser();
    this.context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo'
    });

    this.log('✅ Context OK');
    return this.context;
  }

  async withPage(callback) {
    const context = await this.ensureContext();
    const page = await context.newPage();
    try {
      return await callback(page);
    } finally {
      await page.close().catch(() => {});
    }
  }

  /* ===========================
     PAGE FETCH
  =========================== */

  async openPage(page, url) {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Laisse le JS hydrater
    await page.waitForTimeout(3000);

    // Attend le bloc du compteur
    await page.waitForSelector(
      'div[data-testid="CONTEXTUAL_SEARCH_TITLE"]',
      { timeout: 15000 }
    );
  }

  /* ===========================
     SUPPLY EXTRACTION (KEY)
  =========================== */

  async extractSupply(page) {
    return await page.evaluate(() => {
      const container = document.querySelector(
        'div[data-testid="CONTEXTUAL_SEARCH_TITLE"]'
      );
      if (!container) return { value: 0, occurrences: 0 };

      const spans = container.querySelectorAll('span');
      let occurrences = 0;

      for (const span of spans) {
        const txt = span.textContent.trim();
        if (/^\d+$/.test(txt)) {
          occurrences++;
          return {
            value: parseInt(txt, 10),
            occurrences
          };
        }
      }

      return { value: 0, occurrences };
    });
  }

  /* ===========================
     URL CHECK
  =========================== */

  async checkUrl(urlConfig) {
    const { name, url } = urlConfig;

    this.log('\n' + '='.repeat(50));
    this.log(`🔍 ${name}`);
    this.log('='.repeat(50));

    try {
      const result = await this.withPage(async (page) => {
        await this.openPage(page, url);
        return await this.extractSupply(page);
      });

      this.log(`📊 Compteur détecté : ${result.value}`);
      this.log(`🔎 Occurrences numériques : ${result.occurrences}`);

      if (result.value >= 1) {
        const message =
          `🚨 <b>Alerte logement</b>\n\n` +
          `📍 <b>${name}</b>\n` +
          `📊 Annonces : <b>${result.value}</b>\n\n` +
          `🔗 <a href="${url}">Voir les annonces</a>`;

        await this.sendTelegram(message);
      } else {
        this.log('ℹ️ Aucune annonce (0)');
      }

    } catch (error) {
      this.log(`❌ Erreur ${name}: ${error.message}`, 'error');
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
    const message =
      `🚀 <b>Monitor démarré</b>\n\n` +
      `✅ Playwright actif\n` +
      `🎯 Alerte dès <b>1 annonce</b>\n\n` +
      `📍 <b>Zones surveillées :</b>\n` +
      config.urls.map((u, i) => `${i + 1}. ${u.name}`).join('\n');

    await this.sendTelegram(message);
  }

  /* ===========================
     MAIN LOOP
  =========================== */

  async runMonitoring() {
    this.log('█'.repeat(50));
    this.log('🏠 MONITORING QUINTOANDAR');
    this.log('█'.repeat(50));

    await this.ensureBrowser();
    await this.ensureContext();

    for (const urlConfig of config.urls) {
      await this.checkUrl(urlConfig);
      await this.sleep(1000);
    }

    this.log('█'.repeat(50));
    this.log('✅ TERMINÉ');
    this.log('█'.repeat(50) + '\n');
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = Monitor;
