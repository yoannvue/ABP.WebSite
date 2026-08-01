# Collection Panini Basketball - Architecture & Documentation

## 🎯 Vue d'ensemble du projet

**Objectif** : Mini-application web ludique pour une collection de cartes Panini du club ABP Basketball  
**Durée** : 2-3 mois  
**Plateforme** : GitHub Pages (HTML/CSS/JS client-only, zéro serveur)  
**Cartes** : ~50 cartes (coachs, bureau, équipes)  
**Mécanique** : 1 tirage par jour (configurable, augmentable en fin de période)

---

## 📦 Stockage des données

### localStorage vs Alternatives

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| **localStorage** ✅ | ~5-10MB, persistant, simple, pas de consentement RGPD* | Suppression facile par l'utilisateur |
| Cookies | Classique | Limité ~4KB, nécessite consentement RGPD |
| IndexedDB | Peut supporter 50MB+ | Overkill pour 50 cartes |
| Hybrid | localStorage + export JSON manuel | Plus de complexité |

**Choix** : **localStorage**  
*Contexte* : localStorage n'est pas soumis au consentement cookies en France/EU si tu ne le lies pas à du tracking publicitaire.

### Structure localStorage

```javascript
// localStorage.getItem('paniniGame')
{
  "collection": [
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "8a1c5cad-4b7a-46a3-a6c2-1e8c0b2e3d4f",
    "f47ac10b-58cc-4372-a567-0e02b2c3d479" // doublon possible
  ],
  "lastDrawDate": "2026-08-01",
  "checksum": "a7f3e2d1b9c4",
  "version": "1.0"
}
```

**Explications** :
- `collection` : Array d'UUIDs des cartes obtenues (avec doublons)
- `lastDrawDate` : Date du dernier tirage au format YYYY-MM-DD (bloque 1 tirage/jour)
- `checksum` : Hash de sécurité pour détecter les altérations naïves
- `version` : Pour éventuelles migrations futures

---

## 🎴 Structure des cartes (config.json)

À la racine du repo GitHub Pages.

```json
{
  "game": {
    "title": "Collection ABP Basketball",
    "startDate": "2026-09-01",
    "endDate": "2026-11-30",
    "description": "Collectionnez tous les joueurs, coachs et équipes du club ABP !"
  },
  "mechanics": {
    "drawsPerDay": 1,
    "cardsPerDraw": 1
  },
  "drawsIncreasePhase": {
    "enabled": true,
    "startDate": "2026-11-01",
    "cardsPerDraw": 3,
    "reason": "Phase finale : complétez votre collection !"
  },
  "cards": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Coach Principal",
      "category": "staff",
      "weight": 15,
      "displayName": "Coach Principal",
      "images": [
        {
          "side": "full",
          "url": "/images/coach-1-full.png",
          "alt": "Photo du coach principal"
        }
      ]
    },
    {
      "id": "8a1c5cad-4b7a-46a3-a6c2-1e8c0b2e3d4f",
      "name": "Équipe U15",
      "category": "team",
      "weight": 10,
      "displayName": "Équipe U15 - Gauche",
      "images": [
        {
          "side": "left",
          "url": "/images/u15-left.png",
          "alt": "Équipe U15 partie gauche"
        }
      ]
    },
    {
      "id": "c3e7a2b1-9f6d-11eb-9c0c-b42e99db6e8a",
      "name": "Équipe U15",
      "category": "team",
      "weight": 10,
      "displayName": "Équipe U15 - Droite",
      "images": [
        {
          "side": "right",
          "url": "/images/u15-right.png",
          "alt": "Équipe U15 partie droite"
        }
      ]
    }
  ]
}
```

**Notes** :
- `weight` : Pondération du tirage (10 = rare, 50 = très fréquent). Total n'importe, c'est relatif.
- `id` : UUID v4 unique, impossible à deviner (voir section Sécurité)
- `images[].side` : Optionnel, utile si tu veux gérer gauche/droite/full
- Facile à éditer sans toucher au code JS

---

## 🎲 Logique du tirage quotidien

### Problème : Empêcher la triche

**Risque** : Utilisateur change la date système, redemande un tirage.  
**Solution** : Seed basée sur la date UTC (tout le monde a le même tirage le même jour).

### Implémentation du tirage

```javascript
// Génère une seed "aléatoire" mais déterministe basée sur la date
function getDailySeed(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]; // "2026-08-01"
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash) / 2147483647; // Retourne 0-1
}

// Tirage pondéré
function weightedRandomCard(cards, seed) {
  // Calcule la somme des poids
  const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
  
  // Normalise la seed au total des poids
  let random = seed * totalWeight;
  
  for (const card of cards) {
    random -= card.weight;
    if (random <= 0) return card;
  }
  
  return cards[cards.length - 1]; // Fallback
}

// Vérifier et effectuer un tirage
async function drawCardsForToday() {
  const config = await fetch('config.json').then(r => r.json());
  const today = new Date().toISOString().split('T')[0];
  const stored = JSON.parse(localStorage.getItem('paniniGame') || '{}');
  
  // Bloque si tirage déjà fait aujourd'hui
  if (stored.lastDrawDate === today) {
    return {
      status: "already_drawn",
      cards: [],
      message: "Vous avez déjà tiré aujourd'hui ! Revenez demain."
    };
  }
  
  // Vérifie si on est en phase d'augmentation du nombre de cartes
  const cardsPerDraw = isInIncreasePhase(config) 
    ? config.drawsIncreasePhase.cardsPerDraw 
    : config.mechanics.cardsPerDraw;
  
  // Effectue les tirages
  const drawnCards = [];
  const seed = getDailySeed();
  
  for (let i = 0; i < cardsPerDraw; i++) {
    const card = weightedRandomCard(config.cards, seed + i / 1000);
    drawnCards.push(card);
  }
  
  // Sauvegarde
  const collection = stored.collection || [];
  const newIds = drawnCards.map(c => c.id);
  collection.push(...newIds);
  
  saveCollection(collection, config);
  
  return {
    status: "success",
    cards: drawnCards,
    message: `Vous avez tiré ${cardsPerDraw} carte(s) !`
  };
}

function isInIncreasePhase(config) {
  if (!config.drawsIncreasePhase.enabled) return false;
  
  const today = new Date().toISOString().split('T')[0];
  const startDate = config.drawsIncreasePhase.startDate;
  
  return today >= startDate;
}
```

### Avantage du système

✅ Tout le monde a le même tirage le même jour  
✅ Pas d'avantage à changer la date système  
✅ On peut hardcoder les seeds futures (reproductibilité)

---

## 🔒 Sécurité anti-triche

### Niveau 1 : UUIDs pour les IDs des cartes

**Impossible** de deviner/compléter manuellement.

```javascript
// Génération (une seule fois, à faire en console)
console.log(crypto.randomUUID());
// Résultat : "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

**Ou** avec une lib simple :
```javascript
function simpleUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

**Intégration** :
- Génère 50 UUIDs
- Place-les dans `config.json`
- Voilà, les IDs sont impossible à deviner

### Niveau 2 : Validation des cartes

Détecte si quelqu'un essaie d'ajouter une carte inexistante.

```javascript
function validateCollection(collection, config) {
  const validIds = new Set(config.cards.map(c => c.id));
  
  return collection.filter(id => {
    if (!validIds.has(id)) {
      console.warn(`Carte inexistante détectée : ${id}`);
      return false;
    }
    return true;
  });
}

function saveCollection(collection, config) {
  // Valide avant de sauvegarder
  const validated = validateCollection(collection, config);
  
  const data = {
    collection: validated,
    lastDrawDate: new Date().toISOString().split('T')[0],
    checksum: generateChecksum(validated),
    version: "1.0"
  };
  
  localStorage.setItem('paniniGame', JSON.stringify(data));
}

function generateChecksum(collection, seed = getDailySeed()) {
  const collectionStr = JSON.stringify(collection.sort());
  // Simple hash basé sur la somme des codes
  let hash = 0;
  for (let i = 0; i < collectionStr.length; i++) {
    hash = ((hash << 5) - hash) + collectionStr.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}

function verifyChecksum(data, config) {
  const expectedChecksum = generateChecksum(data.collection);
  if (data.checksum !== expectedChecksum) {
    console.warn("Checksum invalide - collection possiblement altérée");
    // Optionnel : afficher un message, reset, ou logger
    return false;
  }
  return true;
}
```

### Niveau 3 : Détection de tampering

```javascript
function detectTamper() {
  const stored = localStorage.getItem('paniniGame');
  const sessionState = sessionStorage.getItem('lastKnownState');
  
  if (stored !== sessionState && sessionState !== null) {
    console.warn("⚠️ Collection altérée détectée !");
    // Optionnel : afficher une notification subtile
  }
  
  sessionStorage.setItem('lastKnownState', stored);
}

// À appeler au chargement de la page
window.addEventListener('load', detectTamper);
```

### Réalité honnête

Avec du **client-only**, quelqu'un avec les DevTools peut toujours tout modifier. Ce qu'on peut faire :

- ✅ Rendre les triches **naïves** très chiant (UUIDs)
- ✅ Détecter les modifications évidentes (validation + checksum)
- ✅ Créer une friction psychologique (message d'avertissement)

**Le vrai contrôle** nécessiterait un backend. Mais pour un jeu ludique de 2-3 mois dans un club, ça suffit. L'intention c'est s'amuser, pas protéger Fort Knox.

---

## 🎨 UI/UX proposée

### Messages utilisateur

**Premier visite** :
```
⚠️ Ce jeu stocke votre collection dans votre navigateur.
Ne supprimez pas vos données ou vous perdrez tout !
☑️ J'ai compris
```

**Écran principal** :
```
🏀 Collection ABP Basketball
━━━━━━━━━━━━━━━━━━━━━━━━━━

Votre progression : 12/50 cartes (24%)
[████░░░░░░░░░░░░░░░░░░░░░]

🎲 Tirage quotidien
   ✅ Vous avez déjà tiré aujourd'hui
   → Carte obtenue : Coach Principal
   ⏱️  Revenez demain pour votre prochain tirage
```

**Cas : Fin de collection proche** :
```
🎊 Presque fini !
Vous avez 48/50 cartes.
Il vous manque : Équipe U18 - Gauche, Bureau - Secrétaire

À partir du 1er novembre, les tirages quotidiens passeront à 3 cartes ! 🚀
```

### Éléments de gamification

- **Barre de progression** : Visuelle, % de complétude
- **Liste des manquantes** : Quelles cartes il manque
- **Doublons comptés** : "Vous avez 5 doublons"
- **Bouton "Télécharger ma collection"** : Export JSON pour backup
- **Partage simple** : "J'ai 12/50 cartes ! 🏀"

---

## 📁 Structure du repo GitHub Pages

```
repo-abp-panini/
├── index.html              # Page principale
├── config.json             # Configuration du jeu
├── css/
│   └── style.css          # Styles
├── js/
│   ├── app.js             # Logique principale
│   ├── game.js            # Tirage & collection
│   ├── ui.js              # Affichage
│   └── utils.js           # Utilitaires
├── images/
│   ├── coach-1-full.png
│   ├── u15-left.png
│   ├── u15-right.png
│   └── ... (50 images)
├── .gitignore
└── README.md
```

### .gitignore

```
node_modules/
.DS_Store
*.log
dist/
```

### Avant de pusher sur GitHub

1. **Compresser les images** (ImageOptim, TinyPNG, ou ImageMagick)
   ```bash
   # Exemple avec ImageMagick
   mogrify -resize 800x600 -quality 85 images/*.png
   ```

2. **Vérifier que config.json est valide**
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('config.json')))"
   ```

3. **Tester localement** avant de pusher
   ```bash
   # Python
   python -m http.server 8000
   # ou Node
   npx http-server
   ```

---

## ⚡ Prochaines étapes (quand tu vas coder)

### Phase 1 : Préparation des assets
- [ ] Sélectionner & découper les 50 photos (coachs, bureau, équipes)
- [ ] Créer les versions gauche/droite pour les équipes
- [ ] Compresser toutes les images
- [ ] Générer 50 UUIDs v4 uniques

### Phase 2 : Structuration
- [ ] Créer la structure du repo
- [ ] Écrire `config.json` avec tous les UUIDs
- [ ] Configurer les poids de rareté
- [ ] Tester le chargement du JSON

### Phase 3 : Logique du jeu
- [ ] Implémenter `getDailySeed()` et `weightedRandomCard()`
- [ ] Logique du tirage quotidien (`drawCardsForToday()`)
- [ ] Validation & checksum des cartes
- [ ] Tests des cas limites (changement de date, altération, etc.)

### Phase 4 : UI
- [ ] Banneau consentement localStorage
- [ ] Affichage du tirage du jour
- [ ] Barre de progression (collection %)
- [ ] Liste des cartes obtenues/manquantes

### Phase 5 : Fonctionnalités bonus
- [ ] Bouton export JSON
- [ ] Partage (texte copié)
- [ ] Animation du tirage (flip, scratch, etc.)
- [ ] Notification de fin de collection

### Phase 6 : Déploiement
- [ ] Pousher sur GitHub
- [ ] Activer GitHub Pages
- [ ] Tester en production
- [ ] Partager le lien avec le club

---

## 🔧 Détails techniques

### Compatibilité navigateurs

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Téléphones modernes

localStorage & crypto.randomUUID() supportés partout.

### Taille estimée

- HTML + CSS + JS : ~50-100 KB
- Images (50 @ 800x600, compressées) : ~2-3 MB
- **Total** : ~3-4 MB (acceptable pour GitHub Pages)

### Gestion des erreurs courantes

**localStorage plein** (rarissime avec 50 cartes) :
```javascript
function saveCollection(collection, config) {
  try {
    const data = JSON.stringify({ collection, lastDrawDate, checksum });
    localStorage.setItem('paniniGame', data);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Espace de stockage plein ! Veuillez libérer de l\'espace navigateur.');
    }
  }
}
```

**config.json inaccessible** :
```javascript
async function loadConfig() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (e) {
    console.error('Impossible de charger la configuration', e);
    alert('Erreur : configuration inaccessible. Rafraîchissez la page.');
  }
}
```

**localStorage vide à la première visite** :
```javascript
function getCollection() {
  const stored = localStorage.getItem('paniniGame');
  return stored ? JSON.parse(stored) : { collection: [], lastDrawDate: null };
}
```

---

## 📊 Métriques & suivi (optionnel)

Si tu veux du suivi **sans tracker tiers** :

```javascript
function logGameEvent(eventName, data) {
  const event = {
    timestamp: new Date().toISOString(),
    event: eventName,
    data
  };
  
  // Optionnel : envoyer à un endpoint sans traçage utilisateur
  // ou juste logger en console pour debug
  console.log('[GAME]', event);
}

// Utilisation
logGameEvent('card_drawn', { cardId: 'f47ac10b...', totalCards: 12 });
logGameEvent('collection_export', { cardCount: 12 });
```

---

## 🚀 Lancement & communication

### Annonce au club

```
🎲 Nouvelle collection Panini ABP !

Collectionnez les coachs, le bureau et les équipes du club.
Un tirage par jour, jusqu'au 30 novembre.

👉 [Lien du jeu]

💡 Astuce : Une fois par jour, venez tirer une carte.
Ne supprimez pas vos données navigateur !
```

### Durant la campagne

- **Fin octobre** : Annonce phase finale (3 cartes/jour à partir du 1er novembre)
- **Fin novembre** : "X% du club a complété leur collection !"

---

## 📝 Notes de développement

- **Pas de dépendances externes** : Vanilla JS, c'est plus facile à maintenir sur GitHub Pages
- **localStorage au lieu de cookies** : Meilleur UX, pas de consentement RGPD obligatoire
- **UUIDs + validation** : Anti-triche basique mais efficace pour 90% des cas
- **Seed quotidien** : Empêche les triches naïves avec changement de date
- **Exportable** : Bouton de backup pour que les users ne perdent rien

---

## 📞 Questions à clarifier avant de coder

- [ ] Liste définitive des 50 cartes (noms, catégories, poids)
- [ ] Photos : format, taille, déjà découpées (gauche/droite) ?
- [ ] Animations souhaitées au tirage (flip, scratch, etc.) ?
- [ ] Notification push si nouvelle carte dupliquée ? (trop complexe ?)
- [ ] Intégration au site ABP : embedded iframe ou page séparée ?
- [ ] Date de lancement (septembre ?)

