# 🚀 Guide de Déploiement sur Render

## ⚡ Pourquoi Playwright-core + @sparticuz/chromium ?

Ce système utilise **Playwright avec Chromium léger** pour :
- ✅ Charger le JavaScript complet de la page (comme un vrai navigateur)
- ✅ Détecter les nouvelles annonces **instantanément** dès leur apparition
- ✅ Fonctionner sur Render **sans Docker** (contrairement à Puppeteer)
- ✅ Être ultra-léger (60 MB vs 300 MB avec Puppeteer)
- ✅ Pas de problème d'installation de Chrome

## 📋 Étapes Rapides (5 minutes)

### 1. Créer un Web Service sur Render

1. Allez sur [render.com](https://render.com) et connectez-vous
2. Cliquez sur **"New +"** → **"Web Service"**
3. Connectez votre repository GitHub
4. Sélectionnez ce projet

### 2. Configuration du Service

Utilisez **exactement** ces paramètres :

- **Name**: `quintoandar-monitor` (ou votre choix)
- **Region**: Oregon (US West) ou votre préférence
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: **Free**

⚠️ **Important** : Pas besoin de build command complexe ! `npm install` suffit car @sparticuz/chromium inclut Chromium.

### 3. Variables d'Environnement

Ajoutez ces variables dans l'onglet **"Environment"** :

| Clé | Valeur | Exemple |
|-----|--------|---------|
| `TELEGRAM_TOKEN` | Votre token de bot | `123456789:ABCdef...` |
| `TELEGRAM_CHAT_ID` | Votre chat ID | `123456789` |
| `PORT` | Auto (Render le définit) | `10000` |

⚠️ **Ne partagez jamais ces tokens publiquement !**

### 4. Obtenir vos Identifiants Telegram

#### Token du Bot:
1. Parlez à [@BotFather](https://t.me/botfather) sur Telegram
2. Tapez `/newbot` et suivez les instructions
3. Choisissez un nom (ex: "QuintoAndar Alerts Bot")
4. Copiez le token fourni (format: `123456789:ABCdefGHI...`)

#### Chat ID:
1. Parlez à [@userinfobot](https://t.me/userinfobot) sur Telegram
2. Il vous donnera votre Chat ID immédiatement (ex: `123456789`)
3. Copiez ce numéro

### 5. Configurer le Cron Externe

⚠️ **IMPORTANT** : Le plan gratuit de Render met votre service en veille après 15 minutes d'inactivité. Pour le réveiller et vérifier toutes les minutes :

#### Option 1 : cron-job.org (Recommandé - Gratuit)

1. Allez sur [cron-job.org](https://cron-job.org)
2. Créez un compte gratuit (email + mot de passe)
3. Cliquez sur **"Create cronjob"**
4. Configurez :
   - **Title**: `QuintoAndar Monitor`
   - **URL**: `https://votre-service.onrender.com/run`
     (Remplacez par votre URL Render réelle)
   - **Schedule**:
     - Sélectionnez **"Every 1 minute"**
     - Ou utilisez le pattern: `* * * * *`
   - **Notifications**: Désactivez pour éviter le spam
   - Cliquez sur **"Create"**

✅ Votre cron est maintenant actif !

#### Option 2 : UptimeRobot (Alternative)

1. Allez sur [UptimeRobot](https://uptimerobot.com/)
2. Créez un compte gratuit
3. **"Add New Monitor"**
4. Configurez :
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: QuintoAndar Monitor
   - **URL**: `https://votre-service.onrender.com/run`
   - **Monitoring Interval**: 5 minutes (gratuit) ou 1 minute (payant)

### 6. Déployer

1. Cliquez sur **"Create Web Service"**
2. Render va automatiquement :
   - Cloner votre repository
   - Installer les dépendances (`npm install`)
   - Télécharger Chromium optimisé (@sparticuz/chromium)
   - Démarrer le serveur Express
   
3. Attendez 2-3 minutes (build initial)

4. Une fois déployé, vous recevrez :
   - Une notification Telegram "🚀 QuintoAndar Monitor - Démarrage"
   - L'URL de votre service (ex: `https://quintoandar-monitor.onrender.com`)

## ✅ Vérification que Tout Fonctionne

### Test 1 : Vérifier le statut
Visitez : `https://votre-service.onrender.com/`

Vous devriez voir :
```json
{
  "status": "running",
  "service": "QuintoAndar Monitor (Playwright)",
  "lastCheck": "2025-11-14T...",
  "totalChecks": 5,
  "isMonitoring": false,
  "uptime": 1234,
  "version": "2.0.0"
}
```

### Test 2 : Health Check
Visitez : `https://votre-service.onrender.com/health`

Vous devriez voir :
```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T..."
}
```

### Test 3 : Vérification Manuelle
Visitez : `https://votre-service.onrender.com/check-now`

Vous devriez recevoir un message Telegram avec les résultats !

## 📊 Comment ça Fonctionne

```
┌──────────────────┐
│  Cron externe    │  ← Appelle /run toutes les minutes
│  (cron-job.org)  │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Render (plan gratuit)                  │
│                                         │
│  1. Se réveille (si endormi)            │
│  2. Lance Playwright + Chromium         │
│  3. Charge QuintoAndar avec JavaScript  │
│  4. Attend CardRow elements             │
│  5. Compte les occurrences              │
│  6. Compare aux seuils                  │
│  7. Envoie alerte si dépassé            │
│  8. Se rendort après 15 min             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Telegram                               │
│                                         │
│  Alertes si :                           │
│  - Ilha dos Caiçaras : ≥1 annonce       │
│  - Leblon : ≥5 annonces                 │
└─────────────────────────────────────────┘
```

## ⚙️ Modifier les Seuils

Pour changer les seuils d'alerte :

1. Éditez `config.js` dans votre repository :

```javascript
urls: [
  {
    name: 'Ilha dos Caiçaras',
    threshold: 1  // ← CHANGER ICI (ex: 3 pour alerter à partir de 3 annonces)
  },
  {
    name: 'Leblon',
    threshold: 5  // ← CHANGER ICI (ex: 10 pour être plus sélectif)
  }
]
```

2. Commit et push les changements :
```bash
git add config.js
git commit -m "Mise à jour des seuils"
git push origin main
```

3. Render redéploiera automatiquement (2-3 minutes)

## 🔧 Dépannage

### Problème : Pas de notification de démarrage

**Solution** :
1. Vérifiez les logs Render :
   - Dashboard Render → Votre service → Onglet "Logs"
2. Cherchez les erreurs liées à `TELEGRAM_TOKEN` ou `TELEGRAM_CHAT_ID`
3. Vérifiez que le bot peut vous envoyer des messages :
   - Démarrez une conversation avec votre bot sur Telegram
   - Tapez `/start`

### Problème : Le service s'arrête après 15 minutes

**C'est normal** sur le plan gratuit ! Le cron externe le réveillera automatiquement à chaque minute.

**Vérification** :
- Consultez l'historique de votre cron (cron-job.org → History)
- Chaque appel devrait retourner `200 OK`

### Problème : "0 annonce détectée" alors qu'il y en a

**Causes possibles** :
1. QuintoAndar a changé la structure de la page
2. Le sélecteur CardRow n'existe plus

**Solution** :
1. Consultez les logs Render pour voir les détails
2. Le système fait 4 tentatives automatiques
3. Si le problème persiste, vérifiez le mot-clé dans `config.js`

### Problème : Trop d'alertes répétées

**Solution** :
1. Augmentez les seuils dans `config.js`
2. Exemple : `threshold: 999` pour ne jamais alerter

### Problème : Build échoue sur Render

**Erreur commune** : `Cannot find module '@sparticuz/chromium'`

**Solution** :
1. Vérifiez que `package.json` contient :
   ```json
   "dependencies": {
     "@sparticuz/chromium": "^119.0.0",
     "playwright-core": "^1.40.0"
   }
   ```
2. Build Command doit être : `npm install` (pas plus)

## 💡 Conseils

### Surveillance Optimale
- **Toutes les minutes** = Détection maximale (recommandé)
- **Toutes les 5 minutes** = Économie de ressources
- **Toutes les 10 minutes** = Surveillance légère

### Gestion des Notifications
- Le système envoie une alerte **uniquement** quand le seuil est dépassé
- Pas de spam : une seule notification par vérification
- Pour recevoir plus d'alertes : baissez les seuils

### Plan Gratuit Render
- 750 heures/mois gratuites
- Le service s'endort après 15 min (normal)
- Le cron le réveille automatiquement
- Pour éviter l'endormissement : upgrade vers plan payant

## 📞 Support

Pour toute question :
1. Consultez les logs détaillés dans le dashboard Render
2. Vérifiez l'historique du cron externe
3. Testez manuellement avec `/check-now`

## 🎉 Félicitations !

Votre système de monitoring QuintoAndar est maintenant :
- ✅ Déployé sur Render
- ✅ Surveillant 2 quartiers 24/7
- ✅ Alertant par Telegram en temps réel
- ✅ Fonctionnant gratuitement

**Astuce finale** : Ajoutez votre bot Telegram à un groupe pour partager les alertes avec d'autres personnes !
