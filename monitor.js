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

  // 🔹 Lancement Chromium
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

  // 🔹 Contexte
  async ensureContext() {
    if (this.context) return this.context;
    const browser = await this.ensureBrowser();
    this.context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    });
    // Bloque images, fonts, vidéos pour aller plus vite
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,webp}', r => r.abort());
    await this.context.route('**/*.{woff,woff2,ttf,otf}', r => r.abort());
    await this.context.route('**/*.{mp4,webm}', r => r.abort());
    this.log('✅ Contexte prêt');
    return this.context;
  }

  // 🔹 Exécution d'une page avec timeout global
  async withPage(fn, pageTimeout = 30000) {
    const context = await this.ensureContext();
    const page = await context.newPage();

    try {
      return await Promise.race([
        fn(page),
        new Promise(resolve => setTimeout(() => {
          this.log('⏱️ Page timeout dépassé, on continue', 'warn');
          resolve({ value: 0, occurrences: 0 });
        }, pageTimeout))
      ]);
    } catch (err) {
      this.log(`⚠️ Page skipped: ${err.message}`, 'warn');
      return { value: 0, occurrences: 0 };
    } finally {
      await page.close().catch(() => {});
    }
  }

  // 🔹 Chargement rapide + polling
  async loadPage(page, url) {
    this.log(`➡️ Chargement ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Polling rapide pour React
      const start = Date.now();
      let container = null;
      while (Date.now() - start < 10000) { // max 10s
        container = await page.$('div[data-testid="CONTEXTUAL_SEARCH_TITLE"]');
        if (container) {
          const text = await container.textContent();
          if (text && text.trim().length > 0) break;
        }
        await page.waitForTimeout(200); // retry rapide
      }

      await page.waitForTimeout(300); // petite pause pour stabilité
    } catch (err) {
      this.log(`⚠️ Skip ${url} après timeout ou erreur: ${err.message}`, 'warn');
    }
  }

  // 🔹 Extraction réactive
  async extractSupply(page) {
    try {
      return await page.evaluate(() => {
        const container = document.querySelector('div[data-testid="CONTEXTUAL_SEARCH_TITLE"]');
        if (!container) return { value: 0, occurrences: 0 };

        const text = container.textContent || '';

        // 0 annonces
        if (text.includes('= $0') && text.includes('Imóveis')) return { value: 0, occurrences: 1 };

        // ≥1 annonces
        const span = container.querySelector('span');
        const number = span ? parseInt(span.textContent.trim(), 10) : 0;
        return isNaN(number) ? { value: 0, occurrences: 0 } : { value: number, occurrences: 1 };
      });
    } catch {
      return { value: 0, occurrences: 0 };
    }
  }

  // 🔹 Vérification URL
  async checkUrl(urlConfig) {
    const { name, url, threshold = 1 } = urlConfig;
    this.log(`\n🔍 ${name}`);
    const result = await this.withPage(async page => {
      await this.loadPage(page, url);
      return await this.extractSupply(page);
    }, 30000); // 30s max par page

    this.log(`📊 Annonces détectées : ${result.value} (seuil ≥${threshold})`);
    if (result.value >= threshold) {
      await this.sendTelegram(
        `🚨 <b>Alerte logement</b>\n\n📍 <b>${name}</b>\n📊 Annonces : <b>${result.value}</b>\n⚠️ Seuil : ≥${threshold}\n\n🔗 <a href="${url}">Voir</a>`
      );
    }
  }

  // 🔹 Envoi Telegram
  async sendTelegram(text) {
    try {
      await axios.post(this.telegramApi, { chat_id: this.telegramChatId, text, parse_mode: 'HTML' });
      this.log('✉️ Telegram envoyé');
    } catch (err) {
      this.log(`❌ Erreur Telegram: ${err.message}`, 'error');
    }
  }

  // 🔹 Startup message
  async sendStartup() {
    const zones = config.urls
      .map((u, i) => `${i + 1}. ${u.name} (≥${u.threshold ?? 1})`)
      .join('\n');

    try {
      await axios.post(this.telegramApi, {
        chat_id: this.telegramChatId,
        parse_mode: 'HTML',
        text: `🚀 <b>Monitor démarré</b>\n\n🧠 Détection JS réelle (Playwright)\n\n` +
              `📍 Zones surveillées:\n${zones}`
      });
      this.log('✉️ Telegram startup envoyé');
    } catch (err) {
      this.log(`❌ Erreur Telegram startup: ${err.message}`, 'error');
    }
  }

  // 🔹 Boucle monitoring
  async runMonitoring() {
    this.log('█'.repeat(50));
    this.log('🏠 MONITORING QUINTOANDAR');
    this.log('█'.repeat(50));

    for (const u of config.urls) {
      await this.checkUrl(u); // séquentiel pour éviter blocage
    }

    this.log('✅ Fin monitoring');
  }

  // 🔹 Fermeture
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
