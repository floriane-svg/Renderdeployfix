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

  async ensureBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    try {
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
    } catch (error) {
      this.log(`❌ Erreur navigateur: ${error.message}`, 'error');
      this.browser = null;
      throw error;
    }
  }

  async ensureContext() {
    if (this.context) {
      try {
        const browserConnected = this.context.browser()?.isConnected();
        if (browserConnected) {
          return this.context;
        }
        this.log('⚠️ Context stale, réinitialisation...', 'warn');
        this.context = null;
      } catch (e) {
        this.context = null;
      }
    }

    try {
      const browser = await this.ensureBrowser();
      
      this.context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      });

      this.context.on('close', () => {
        this.log('⚠️ Context fermé', 'warn');
        this.context = null;
      });

      this.log('✅ Context OK');
      return this.context;
    } catch (error) {
      this.log(`❌ Erreur context: ${error.message}`, 'error');
      this.context = null;
      throw error;
    }
  }

  async withPage(callback) {
    let page = null;
    
    try {
      const context = await this.ensureContext();
      page = await context.newPage();
      const result = await callback(page);
      await page.close();
      return result;
    } catch (error) {
      if (page) {
        await page.close().catch(() => {});
      }
      throw error;
    }
  }

  async fetchPage(url, attempt = 1) {
    const maxAttempts = 3;
    
    for (let i = attempt; i <= maxAttempts; i++) {
      try {
        this.log(`Tentative ${i}/${maxAttempts} - ${url}`);
        
        const html = await this.withPage(async (page) => {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 25000
          });

          await page.waitForTimeout(2000);

          const html = await page.content();
          
          if (html.length < 5000) {
            throw new Error('HTML incomplet');
          }

          this.log(`✅ Page OK (${(html.length / 1024).toFixed(1)} KB)`);
          return html;
        });

        return html;

      } catch (error) {
        this.log(`❌ Erreur tentative ${i}: ${error.message}`, 'error');
        
        if (i >= maxAttempts) {
          throw new Error(`Échec après ${maxAttempts} tentatives`);
        }

        if (error.message.includes('closed') || error.message.includes('disconnected')) {
          this.log('⚠️ Redémarrage navigateur...', 'warn');
          await this.restart();
        }

        await this.sleep(2000);
      }
    }
  }

  countKeyword(html) {
    const lowerHtml = html.toLowerCase();
    const keyword = config.keyword.toLowerCase();
    const count = lowerHtml.split(keyword).length - 1;
    return count;
  }

  async checkUrl(urlConfig) {
    const { name, url, threshold } = urlConfig;
    
    this.log(`\n${'='.repeat(50)}`);
    this.log(`🔍 ${name}`);
    this.log(`${'='.repeat(50)}`);

    try {
      const html = await this.fetchPage(url);
      const count = this.countKeyword(html);
      
      this.log(`📊 Résultat: ${count} occurrence(s)`);
      
      if (count >= threshold) {
        const message = `🏠 <b>ALERTE ${name}</b>\n\n` +
          `📊 <b>${count}</b> annonce(s)\n` +
          `⚠️ Seuil: ≥${threshold}\n\n` +
          `🔗 <a href="${url}">Voir</a>`;
        
        await this.sendTelegram(message);
      } else {
        this.log(`ℹ️ Pas d'alerte (${count} < ${threshold})`);
      }
      
      return count;
      
    } catch (error) {
      this.log(`❌ Erreur ${name}: ${error.message}`, 'error');
      return 0;
    }
  }

  async sendTelegram(text) {
    try {
      await axios.post(this.telegramApi, {
        chat_id: this.telegramChatId,
        text: text,
        parse_mode: 'HTML'
      });
      this.log('✉️ Telegram OK');
      return true;
    } catch (error) {
      this.log(`❌ Telegram: ${error.message}`, 'error');
      return false;
    }
  }

  async sendStartup() {
    const message = `🚀 <b>Monitor Démarré</b>\n\n` +
      `✅ Playwright actif\n` +
      `⏱ Cron externe (1 min)\n\n` +
      `📍 <b>Surveillance:</b>\n` +
      config.urls.map((u, i) => 
        `${i + 1}. ${u.name} (≥${u.threshold})`
      ).join('\n');
    
    await this.sendTelegram(message);
  }

  async runMonitoring() {
    this.log('\n' + '█'.repeat(50));
    this.log('🏠 MONITORING QUINTOANDAR');
    this.log('█'.repeat(50));

    await this.ensureBrowser();
    await this.ensureContext();

    for (const urlConfig of config.urls) {
      try {
        await this.checkUrl(urlConfig);
        await this.sleep(1000);
      } catch (error) {
        this.log(`❌ Erreur ${urlConfig.name}: ${error.message}`, 'error');
      }
    }

    this.log('█'.repeat(50));
    this.log('✅ TERMINÉ');
    this.log('█'.repeat(50) + '\n');
  }

  async restart() {
    this.log('🔄 Redémarrage complet...');
    
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    
    await this.ensureBrowser();
    await this.ensureContext();
  }

  async shutdown() {
    this.log('🔒 Fermeture...');
    
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    
    this.log('✅ Fermé');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Monitor;
