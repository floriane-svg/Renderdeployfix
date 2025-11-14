# QuintoAndar Monitor

Système de surveillance automatique pour les annonces QuintoAndar avec alertes Telegram en temps réel.

## 🎯 Fonctionnalités

- ✅ **Playwright + Chromium léger** : Détection instantanée sans installation de Chrome
- ✅ **@sparticuz/chromium** : Optimisé pour Render (sans Docker nécessaire)
- ✅ **Détection en temps réel** : Voit les nouvelles annonces dès leur apparition
- ✅ **Endpoint /run** : Déclenché par cron externe toutes les minutes
- ✅ **Retry intelligent** : Jusqu'à 4 tentatives avec rotation de User-Agents
- ✅ **Seuils configurables** : Alertes personnalisées par quartier
- ✅ **Plan gratuit Render** : Fonctionne sans problème sur le tier gratuit

## 🚀 Déploiement sur Render (5 minutes)

### 1. Créer un Web Service sur Render

1. Allez sur [render.com](https://render.com) et connectez-vous
2. Cliquez sur **"New +"** → **"Web Service"**
3. Connectez votre repository GitHub
4. Sélectionnez ce projet

### 2. Configuration du Service

Utilisez ces paramètres :

- **Name**: `quintoandar-monitor`
- **Region**: Oregon (US West)
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: **Free**

### 3. Variables d'Environnement

Ajoutez ces variables dans l'onglet **"Environment"** :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `TELEGRAM_TOKEN` | `123456789:ABCdef...` | Token de votre bot Telegram |
| `TELEGRAM_CHAT_ID` | `123456789` | Votre Chat ID Telegram |
| `PORT` | `10000` | Port (auto-défini par Render) |

⚠️ **Important** : Ne partagez jamais ces tokens publiquement !

### 4. Obtenir vos identifiants Telegram

#### Token du Bot:
1. Parlez à [@BotFather](https://t.me/botfather) sur Telegram
2. Tapez `/newbot` et suivez les instructions
3. Copiez le token fourni (format: `123456789:ABCdefGHIjkl...`)

#### Chat ID:
1. Parlez à [@userinfobot](https://t.me/userinfobot) sur Telegram
2. Il vous donnera votre Chat ID (ex: `123456789`)

### 5. Configurer le Cron Externe

Le plan gratuit de Render met votre service en veille après 15 minutes. Utilisez un cron externe pour le réveiller toutes les minutes :

#### Option 1 : cron-job.org (Recommandé)

1. Allez sur [cron-job.org](https://cron-job.org)
2. Créez un compte gratuit
3. Cliquez sur **"Create cronjob"**
4. Configurez :
   - **Title**: QuintoAndar Monitor
   - **URL**: `https://votre-service.onrender.com/run`
   - **Schedule**: Every **1** minute
   - Cliquez sur **"Create"**

#### Option 2 : UptimeRobot

1. Allez sur [UptimeRobot](https://uptimerobot.com/)
2. Créez un compte gratuit
3. **"Add New Monitor"** → HTTP(s)
4. URL: `https://votre-service.onrender.com/run`
5. Interval: 5 minutes (gratuit)

### 6. Déployer

Cliquez sur **"Create Web Service"**. Render va :
1. Installer les dépendances Node.js
2. Télécharger Chromium optimisé (@sparticuz/chromium)
3. Démarrer votre serveur Express
4. Vous envoyer une notification Telegram de démarrage

## ⚙️ Configuration des Seuils

Pour modifier les seuils d'alerte, éditez `config.js` :

```javascript
urls: [
  {
    name: 'Ilha dos Caiçaras',
    threshold: 1  // ← Alerter dès 1 annonce
  },
  {
    name: 'Leblon',
    threshold: 5  // ← Alerter à partir de 5 annonces
  }
]
```

Après modification :
1. Commit et push sur GitHub
2. Render redéploiera automatiquement

## 🔍 Endpoints Disponibles

- `GET /` - Statut du service (uptime, dernière vérification, etc.)
- `GET /health` - Health check pour Render
- `GET /run` - Déclenche la vérification (appelé par cron externe)
- `GET /check-now` - Vérification manuelle

## 📊 Fonctionnement

```
┌────────────────┐
│ Cron externe   │  Appelle /run toutes les minutes
│ (cron-job.org) │
└────────┬───────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Render (plan gratuit)              │
│  1. Réveille le service             │
│  2. Playwright charge les 2 URLs    │
│  3. Compte les occurrences (retry)  │
│  4. Alerte Telegram si seuil ≥      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Telegram                           │
│  - Ilha dos Caiçaras : ≥1 annonce   │
│  - Leblon : ≥5 annonces             │
└─────────────────────────────────────┘
```

## 🛠️ Développement Local

```bash
# Installer les dépendances
npm install

# Installer Chromium pour le développement local
npx playwright install chromium

# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env avec vos tokens
nano .env

# Démarrer
npm start
```

## 📝 Pourquoi Playwright + @sparticuz/chromium ?

QuintoAndar charge les annonces dynamiquement via JavaScript. Les solutions comme `axios` ou `cheerio` ne voient que le HTML initial (vide). 

**Playwright** :
- Lance un vrai navigateur Chromium
- Exécute le JavaScript de la page
- Attend que les annonces soient chargées
- Détecte les nouvelles annonces **instantanément**

**@sparticuz/chromium** :
- Version compressée de Chromium (60 MB au lieu de 300 MB)
- Optimisée pour les environnements serverless
- Fonctionne sur Render sans Docker
- Pas besoin d'installer Chrome manuellement

## 🔧 Dépannage

**Le service ne démarre pas ?**
- Vérifiez les logs Render pour voir les erreurs
- Assurez-vous que `TELEGRAM_TOKEN` et `TELEGRAM_CHAT_ID` sont définis

**Pas de notifications ?**
- Vérifiez que le bot peut vous envoyer des messages (démarrez une conversation avec lui)
- Consultez les logs pour voir si les seuils sont atteints

**Le service s'arrête ?**
- Normal sur le plan gratuit (après 15 min d'inactivité)
- Le cron externe le réveillera automatiquement

**Erreur "0 annonce détectée" alors qu'il y en a ?**
- Le système fait 4 tentatives automatiques
- Consultez les logs pour voir les détails de chaque tentative
- Si le problème persiste, le mot-clé a peut-être changé sur QuintoAndar

## 💡 Avantages vs Puppeteer

| Critère | Puppeteer | Playwright + @sparticuz/chromium |
|---------|-----------|----------------------------------|
| Installation Chrome | ❌ Échoue sur Render | ✅ Automatique |
| Taille | ~300 MB | ~60 MB |
| Docker requis | ✅ Oui | ❌ Non |
| Vitesse | Rapide | Rapide |
| Détection JS | ✅ Oui | ✅ Oui |

## 📄 Licence

ISC
