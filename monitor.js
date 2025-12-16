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
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,webp}', r => r.abort());
    await this.context.route('**/*.{woff,woff2,ttf,otf}', r => r.abort());
    await this.context.route('**/*.{mp4,webm}', r => r.abort());
    this.log('✅ Contexte prêt');
    return this.context;
  }

  async withPage(fn) {
    const context = await this.ensureContext();
    const page = await context.newPage();
    try {
      return await fn(page);
    } catch (err) {
      this.log(`⚠️ Page skipped: ${err.message}`, 'warn');
      return { value: 0, occurrences: 0 };
    } finally {
      await page.close().catch(() => {});
    }
  }

  async loadPage(page, url) {
    this.log(`➡️ Chargement ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      // Attendre que le wrapper soit attaché au DOM
      await page.waitForSelector('div.HouseType_wrapper_74jms', { timeout: 30000, state: 'attached' });
      // Petite pause pour laisser React injecter le <span>
      await page.waitForTimeout(2000);
    } catch (err) {
      this.log(`⚠️ Skip ${url} après timeout ou erreur: ${err.message}`, 'warn');
    }
  }

  async extractSupply(page) {
    try {
      return await page.evaluate(() => {
        const wrapper = document.querySelector('div.HouseType_wrapper_74jms');
        if (!wrapper) return { value: 0, occurrences: 0 };

        // Cherche un <p><span> numérique
        const pSpan = wrapper.querySelector('p span');
        if (pSpan) {
          const number = parseInt(pSpan.textContent.trim(), 10);
          if (!isNaN(number)) {
            return { value: number, occurrences: 1 };
          }
        }

        // Sinon, cas <h1><span>Imóveis</span> → aucune annonce
        return { value: 0, occurrences: 0 };
      });
    } catch {
      return { value: 0, occurrences: 0 };
    }
  }

  async checkUrl(urlConfig) {
    const { name, url, threshold = 1 } = urlConfig;
    this.log(`\n🔍 ${name}`);
    const result = await this.withPage(async page => {
      await this.loadPage(page, url);
      return await this.extractSupply(page);
    });
    this.log(`📊 Annonces détectées : ${result.value} (seuil ≥${threshold})`);
    if (result.value >= threshold) {
      await this.sendTelegram(
        `🚨 <b>Alerte logement</b>\n\n📍 <b>${name}</b>\n📊 Annonces : <b>${result.value}</b>\n⚠️ Seuil : ≥${threshold}\n\n🔗 <a href="${url}">Voir</a>`
      );
    }
  }

  async sendTelegram(text) {
    try {
      await axios.post(this.telegramApi, { chat_id: this.telegramChatId, text, parse_mode: 'HTML' });
      this.log('✉️ Telegram envoyé');
    } catch (err) {
      this.log(`❌ Erreur Telegram: ${err.message}`, 'error');
    }
  }

  async sendStartup() {
    const zones = config.urls
      .map((u, i) => `${i + 1}. ${u.name} (≥${u.threshold ?? 1})`)
      .join('\n');

    await axios.post(this.telegramApi, {
      chat_id: this.telegramChatId,
      parse_mode: 'HTML',
      text: `🚀 <b>Monitor démarré</b>\n\n🧠 Détection JS réelle (Playwright)\n\n` +
            `📍 Zones surveillées:\n${zones}`
    });

    this.log('✉️ Telegram startup envoyé');
  }

  async runMonitoring() {
    this.log('█'.repeat(50));
    this.log('🏠 MONITORING QUINTOANDAR');
    this.log('█'.repeat(50));

    await Promise.all(config.urls.map(u => this.checkUrl(u)));

    this.log('✅ Fin monitoring');
  }

  async shutdown() {
    try {
      if (this.context) { await this.context.close(); this.context = null; this.log('🛑 Contexte fermé'); }
      if (this.browser) { await this.browser.close(); this.browser = null; this.log('🛑 Navigateur fermé'); }
    } catch (err) {
      this.log(`❌ Erreur fermeture: ${err.message}`, 'error');
    }
  }
}

module.exports = Monitor;
