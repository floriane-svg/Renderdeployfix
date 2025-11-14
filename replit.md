# QuintoAndar Monitor

## Vue d'ensemble
Système de monitoring en temps réel pour surveiller les annonces QuintoAndar. Déclenché par un cron externe toutes les minutes. Envoie des alertes Telegram instantanées lorsque le nombre d'annonces dépasse les seuils configurés.

## Architecture
- **Backend**: Node.js + Express
- **Browser**: Playwright-core + @sparticuz/chromium (léger, serverless)
- **Lifecycle**: 1 navigateur + 1 context réutilisés (initialisés au démarrage)
- **Scheduling**: Cron externe (appelle `/run` toutes les minutes)
- **HTTP Client**: axios (Telegram uniquement)
- **Alertes**: Telegram Bot API

## Fichiers Principaux
- `index.js`: Serveur Express avec endpoints /run, /health, /check-now
- `monitor.js`: Logique de monitoring avec Playwright pour détection JavaScript
- `config.js`: Configuration des URLs et seuils (👈 MODIFIER ICI)
- `render.yaml`: Configuration pour déploiement Render (sans Docker)
- `README.md`: Documentation complète

## URLs Surveillées
1. **Ilha dos Caiçaras** - Seuil: ≥1 annonce
2. **Leblon** - Seuil: ≥5 annonces

## Mot-clé Recherché
`Cozy__CardRow-Container` (insensible à la casse)

## Déploiement
- **Platform**: Render (plan gratuit, sans Docker)
- **Réveillé par**: Cron externe toutes les minutes
- **Services recommandés**: cron-job.org, UptimeRobot, Easycron
- **URL exemple**: https://votre-service.onrender.com/run

## Endpoints
- `GET /` - Statut du service (uptime, checks, etc.)
- `GET /health` - Health check pour Render
- `GET /run` - Déclenche la vérification (appelé par cron externe)
- `GET /check-now` - Vérification manuelle

## Stack Technique

### Pourquoi Playwright-core + @sparticuz/chromium ?
1. **Détection instantanée**: Charge le JavaScript comme un vrai navigateur
2. **Léger**: 60 MB au lieu de 300 MB (Puppeteer)
3. **Sans Docker**: Fonctionne directement sur Render
4. **Optimisé serverless**: Conçu pour les environnements contraints
5. **Pas d'installation Chrome**: Chromium inclus dans @sparticuz/chromium

### Vs Puppeteer (ancienne version)
- ❌ Puppeteer échouait sur Render (installation Chrome impossible)
- ❌ Nécessitait Docker ou build command complexe
- ✅ Playwright-core + @sparticuz/chromium fonctionne out-of-the-box

### Vs Axios/Cheerio
- ❌ Axios/Cheerio ne chargent pas le JavaScript
- ❌ Voient l'ancien HTML (avant le chargement dynamique)
- ❌ Détection retardée de 30-60 secondes (ou jamais)
- ✅ Playwright voit exactement ce qu'un utilisateur réel verrait

## Configuration des Seuils

Modifier `config.js` :

```javascript
urls: [
  {
    name: 'Ilha dos Caiçaras',
    threshold: 1  // ← Changer ici
  },
  {
    name: 'Leblon',
    threshold: 5  // ← Changer ici
  }
]
```

Après modification : commit + push → Render redéploie automatiquement

## Dernières Modifications
- **2025-11-14**: Refactoring complet architecture navigateur
  - **STABLE**: 1 navigateur + 1 context réutilisés (initialisés au démarrage)
  - Réutilisation entre tous les appels /run (cron chaque minute)
  - Event listeners 'disconnected'/'close' pour détection proactive des crashes
  - Vérification `context.browser()?.isConnected()` avant réutilisation
  - Auto-recovery automatique en cas de crash navigateur
  - Shutdown gracieux (SIGTERM/SIGINT) avec fermeture propre
  - Simplification maximale: retries itératifs, logs concis
  - Dépendances système Nix: nss, libgbm, x11, alsa-lib, etc.
  - **Fini les erreurs** "Target page, context or browser has been closed"
  - Production-ready pour Render free tier validé par architecte

## Préférences Utilisateur
- ⏰ Vérifications toutes les minutes (cron externe)
- 📊 Détection instantanée requise (pas de délai acceptable)
- 🚀 Déploiement sur Render (plan gratuit)
- 🔔 Alertes Telegram dès que seuils dépassés
- 🇫🇷 Documentation en français

## Notes Techniques
- **Playwright** exécute le JavaScript complet de QuintoAndar
- Attend que les éléments `[class*="CardRow"]` soient chargés
- Timeout de 30 secondes par page
- Attente supplémentaire de 3 secondes après chargement
- Compatible avec Render sans configuration système spéciale
