require('dotenv').config();
const express = require('express');
const Monitor = require('./monitor');

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ ERREUR: TELEGRAM_TOKEN et TELEGRAM_CHAT_ID doivent être définis');
  process.exit(1);
}

const app = express();
const monitor = new Monitor(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID);

let isMonitoring = false;
let lastCheckTime = null;
let checksCount = 0;

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'QuintoAndar Monitor (Playwright)',
    lastCheck: lastCheckTime,
    totalChecks: checksCount,
    isMonitoring: isMonitoring,
    uptime: process.uptime(),
    version: '3.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/run', async (req, res) => {
  if (isMonitoring) {
    return res.status(429).json({ 
      error: 'Vérification en cours',
      lastCheck: lastCheckTime
    });
  }

  res.json({ 
    message: 'Vérification démarrée',
    timestamp: new Date().toISOString()
  });

  runMonitoringTask();
});

app.get('/check-now', async (req, res) => {
  if (isMonitoring) {
    return res.status(429).json({ 
      error: 'Vérification en cours',
      lastCheck: lastCheckTime
    });
  }

  res.json({ 
    message: 'Vérification manuelle',
    timestamp: new Date().toISOString()
  });

  runMonitoringTask();
});

async function runMonitoringTask() {
  if (isMonitoring) {
    monitor.log('⏭️ Ignoré - déjà en cours', 'warn');
    return;
  }

  isMonitoring = true;
  
  try {
    await monitor.runMonitoring();
    lastCheckTime = new Date().toISOString();
    checksCount++;
  } catch (error) {
    monitor.log(`❌ Erreur monitoring: ${error.message}`, 'error');
  } finally {
    isMonitoring = false;
  }
}

async function shutdown() {
  monitor.log('📴 Arrêt du service...');
  
  await monitor.shutdown();
  
  server.close(() => {
    monitor.log('✅ Service arrêté');
    process.exit(0);
  });
}

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n' + '█'.repeat(50));
  console.log('🚀 QUINTOANDAR MONITOR');
  console.log('█'.repeat(50));
  console.log(`✅ Serveur port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🔄 Cron: /run (toutes les minutes)`);
  console.log('█'.repeat(50) + '\n');

  try {
    await monitor.ensureBrowser();
    await monitor.ensureContext();
    console.log('✅ Navigateur initialisé\n');
    
    await monitor.sendStartup();
  } catch (error) {
    console.error('❌ Erreur initialisation:', error.message);
  }
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
