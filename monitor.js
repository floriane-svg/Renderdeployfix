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

  // 🔹 Assure que le navigateur est lancé
  async ensureBrowser(retries = 3) {
    if (this.browser && this.browser.isConnected()) return this.browser;

    this.log('🌐 Lancement Chromium...');
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.browser = await chromium.launch({
          args: chromiumPkg.args,
          executablePath: await chromiumPkg.executablePath(),
          headless: true
        });
        this.log('✅ Chromium prêt');
        return this.browser;
      } catch (err) {
        if (err.message.includes('ETXTBSY') && attempt < retries) {
          this.log(`⚠️ ETXTBSY détecté, réessai ${attempt}/${retries}...`, 'warn');
          await new Promise(r => setTimeout(r, 1000));
        } else {
          throw err;
        }
      }
    }
  }

  // 🔹 Assure que le contexte est prêt
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

  // 🔹 Exécution d'une page avec timeout global pour éviter blocage
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

  // 🔹 Chargement rapide de la page avec timeout court
  async loadPage(page, url) {
    this.log(`➡️ Chargement ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('div[data-testid="CONTEXTUAL_SEARCH_TITLE"]', { timeout: 15000, state: 'attached' });
      await page.waitForTimeout(1000); // courte pause pour React
    } catch (err) {
      this.log(`⚠️ Skip ${url} après timeout ou erreur: ${err.message}`, 'warn');
    }
  }

  // 🔹 Extraction du chiffre dans le <span>
  async extractSupply(page) {
    try {
      return await page.evaluate(() => {
        const container = document.querySelector('div[data-testid="CONTEXTUAL_SEARCH_TITLE"]');
        if (!container) return { value: 0, occurrences: 0 };
        const span = container.querySelector('span');
        if (!span) return { value: 0, occurrences: 0 };
        const number = parseInt(span.textContent.trim(), 10);
        if (isNaN(number)) return { value: 0, occurrences: 0 };
        return { value: number, occurrences: 1 };
      });
    } catch {
      return { value: 0, occurrences: 0 };
    }
  }

  // 🔹 Vérification d'une URL
  async checkUrl(urlConfig) {
    const { name, url, threshold = 1 } = urlConfig;
    this.log(`\n🔍 ${name}`);
    const result = await this.withPage(async page => {
      await this.loadPage(page, url);
      return await this.extractSupply(page);
    }, 30000);

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

  // 🔹 Message de démarrage
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
      await this.checkUrl(u);
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
