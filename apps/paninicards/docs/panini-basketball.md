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

## 📸 Gestion des images - Formats & Découpe

### Format des images

**Images unitaires** (Coachs + Bureau) :
- Format : Portrait **2:3** (ex: 400 × 600 px)
- Un fichier = une carte
- Exemple : `coach-jean-martin.png`

**Images d'équipes** :
- Format : **3:4** (ex: 600 × 800 px)
- Coupées **verticalement au milieu** → 2 cartes (gauche + droite)
- Chaque moitié devient une carte distincte (300 × 800 px)
- Exemple : `u15-garcons.png` → `u15-garcons-left.png` + `u15-garcons-right.png`

### Découpe des images d'équipes (processus)

**Option 1 : Avec ImageMagick (commande)**
```bash
# Couper verticalement au milieu
convert u15-garcons.png -crop 50%x100%+0+0 +repage u15-garcons-left.png
convert u15-garcons.png -crop 50%x100%+300+0 +repage u15-garcons-right.png

# Ou en boucle
for img in *.png; do
  convert "$img" -crop 50%x100%+0+0 +repage "${img%.png}-left.png"
  convert "$img" -crop 50%x100%+50%+0 +repage "${img%.png}-right.png"
done
```

**Option 2 : Script Python simple**
```python
from PIL import Image
import os

for filename in os.listdir('images'):
    if filename.endswith('.png'):
        img = Image.open(f'images/{filename}')
        width, height = img.size
        
        # Coupe gauche (0 à mid)
        left_img = img.crop((0, 0, width // 2, height))
        left_img.save(f'images/{filename[:-4]}-left.png')
        
        # Coupe droite (mid à end)
        right_img = img.crop((width // 2, 0, width, height))
        right_img.save(f'images/{filename[:-4]}-right.png')
```

**Option 3 : Tool online (EZGIF, Pixlr, etc.)**
- Upload l'image
- Crop à 50% width
- Télécharge les 2 parties

---

## 🎲 Système de rareté - Distribution des 51 cartes

### Répartition des 51 cartes

| Catégorie | Quantité | Rareté | Weight | Exemple |
|-----------|----------|--------|--------|---------|
| **Équipes** | 26 cartes | Commune | **50** | U15 Garçons (gauche/droite) |
| **Coachs** | 20 cartes | Rare | **10** | Coach Jean Martin |
| **Bureau** | 4 cartes | Très rare | **3** | Trésorier, Secrétaire, etc. |
| **Président** | 1 carte | Exceptionnelle | **1** | Président du club |

**Total** : 26 + 20 + 4 + 1 = **51 cartes**

### Explication du système de weight

Le `weight` est une **pondération relative** pour le tirage aléatoire.

```javascript
// Exemple avec 3 cartes
const cards = [
  { id: 'team-1', name: 'U15', weight: 50 },   // Commune
  { id: 'coach-1', name: 'Coach', weight: 10 }, // Rare
  { id: 'pres-1', name: 'Président', weight: 1 } // Exceptionnelle
];

// Somme des poids = 50 + 10 + 1 = 61
// Probabilités :
//   U15 : 50/61 ≈ 82%
//   Coach : 10/61 ≈ 16%
//   Président : 1/61 ≈ 1.6%
```

Avec **26 équipes (weight 50)**, la moyenne pondérée pour une équipe est :
- (26 × 50) / (26×50 + 20×10 + 4×3 + 1×1) = 1300 / 1413 ≈ **92%**

C'est parfait : beaucoup d'équipes, rarement les cartes spéciales.

---

## 🎴 Animation Flip avec délai - Nouvelle implémentation

### HTML du bouton flip

```html
<div id="drawn-cards" class="cards-container">
  <!-- Cartes générées dynamiquement -->
</div>
<button id="flip-btn" class="btn-flip" style="display: none;">
  🎲 Révéler les cartes
</button>
```

### CSS pour l'effet flip avec délai

```css
/* Conteneur de la carte */
.flip-card {
  background-color: transparent;
  width: 200px;
  height: 300px;
  perspective: 1000px;
  margin: 20px auto;
}

/* Carte elle-même */
.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transform-style: preserve-3d;
}

/* Classe pour déclencher le flip */
.flip-card.flipping .flip-card-inner {
  transform: rotateY(180deg);
}

/* Avant (verso de la carte) */
.flip-card-front {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  border: 3px solid #764ba2;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  font-size: 50px;
  font-weight: bold;
}

/* Après (recto avec la carte) */
.flip-card-back {
  background-color: white;
  color: black;
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  border-radius: 10px;
  border: 3px solid #333;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Image de la carte */
.flip-card-back img {
  width: 100%;
  height: 70%;
  object-fit: cover;
}

/* Titre */
.flip-card-back .card-title {
  padding: 10px;
  font-weight: bold;
  font-size: 14px;
  text-align: center;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.1));
}

/* Animation d'apparition */
@keyframes card-pop {
  0% {
    transform: scale(0) rotateY(0deg);
    opacity: 0;
  }
  100% {
    transform: scale(1) rotateY(0deg);
    opacity: 1;
  }
}

.flip-card.appearing {
  animation: card-pop 0.5s ease-out forwards;
}

/* Bouton de flip */
.btn-flip {
  padding: 15px 40px;
  font-size: 18px;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  margin-top: 20px;
}

.btn-flip:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.btn-flip:active {
  transform: translateY(0);
}
```

### JavaScript pour le flip avec délai

```javascript
class FlipCard {
  constructor(card, config) {
    this.card = card;
    this.config = config;
    this.element = null;
    this.isFlipped = false;
    this.delayMs = 0; // Délai avant le flip
  }

  create() {
    const div = document.createElement('div');
    div.className = 'flip-card appearing'; // Animation d'apparition
    div.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          🎴
        </div>
        <div class="flip-card-back">
          <img src="${this.card.images[0].url}" 
               alt="${this.card.displayName}"
               onerror="this.src='images/placeholder.png'">
          <div class="card-title">${this.card.displayName}</div>
        </div>
      </div>
    `;

    this.element = div;
    return div;
  }

  flip() {
    this.isFlipped = true;
    this.element.classList.add('flipping');
  }

  setFlipDelay(delayMs) {
    this.delayMs = delayMs;
  }

  flipWithDelay() {
    setTimeout(() => {
      this.flip();
    }, this.delayMs);
  }
}

// Fonction principale : affiche les cartes tirées
async function displayDrawnCards(cards) {
  const container = document.getElementById('drawn-cards');
  const flipBtn = document.getElementById('flip-btn');
  
  container.innerHTML = ''; // Reset
  flipBtn.style.display = 'block';
  
  // Crée les cartes
  const flipCards = [];
  cards.forEach((card, index) => {
    const flipCard = new FlipCard(card, config);
    
    // Animation d'apparition progressive
    const appearanceDelay = index * 100; // 100ms entre chaque
    const cardElement = flipCard.create();
    
    // Applique le délai d'apparition
    cardElement.style.animationDelay = `${appearanceDelay}ms`;
    container.appendChild(cardElement);
    
    // Mémorise pour le flip ultérieur
    flipCards.push({
      flipCard,
      delayBeforeFlip: 1000 + (index * 200) // 1s + décalage
    });
  });

  // Au click du bouton, flip toutes les cartes avec délai
  flipBtn.addEventListener('click', () => {
    flipBtn.disabled = true; // Empêche les clics multiples
    
    flipCards.forEach(({ flipCard, delayBeforeFlip }) => {
      flipCard.setFlipDelay(delayBeforeFlip);
      flipCard.flipWithDelay();
    });
    
    // Réactive le bouton après tous les flips
    const maxDelay = Math.max(...flipCards.map(f => f.delayBeforeFlip)) + 600; // +600ms pour l'animation
    setTimeout(() => {
      flipBtn.disabled = false;
    }, maxDelay);
  });
}
```

### Flux utilisateur avec le nouveau système

```
┌──────────────────────────────┐
│  🎲 Tirer une carte          │
│      (Bouton principal)      │
└──────────┬───────────────────┘
           ↓
┌──────────────────────────────┐
│  [🎴] [🎴]                   │ ← Cartes affichées
│                              │   (verso visible)
│  🎲 Révéler les cartes       │ ← Bouton de flip
│      (Bouton secondaire)     │
└──────────┬───────────────────┘
           ↓ Click sur "Révéler"
┌──────────────────────────────┐
│  ⏳ 1s d'attente...           │
│  [Flip animation 0.6s]       │
│  [Flip animation 0.8s]       │ ← Chaque carte flip
│  [Flip animation 1.0s]       │   avec délai progressif
│                              │
│  [Recto] [Recto]             │ ← Cartes révélées
└──────────────────────────────┘
```

### Améliorations apportées

✅ **Délai de 1 seconde** avant le premier flip (suspense)  
✅ **Délai progressif** entre chaque carte (200ms)  
✅ **Easing cubic-bezier** pour un flip plus "snappy"  
✅ **Bouton désactivé** pendant les flips  
✅ **Animation d'apparition** des cartes avant le flip  
✅ **Click = user contrôle** le moment du reveal (pas auto)  

---

## 📋 Exemple config.json complète avec 51 cartes

```json
{
  "game": {
    "title": "Collection ABP Basketball",
    "startDate": "2026-09-01",
    "endDate": "2026-11-30",
    "totalCards": 51
  },
  "mechanics": {
    "drawsPerDay": 1,
    "cardsPerDraw": 1
  },
  "drawsIncreasePhase": {
    "enabled": true,
    "startDate": "2026-11-01",
    "cardsPerDraw": 3
  },
  "cards": [
    {
      "id": "team-u15-boys-left-001",
      "name": "Équipe U15 Garçons",
      "category": "team",
      "section": "Équipes",
      "subsection": "U15 Garçons",
      "weight": 50,
      "displayName": "U15 Garçons - Partie Gauche",
      "images": [{ "side": "left", "url": "/images/u15-boys-left.png" }]
    },
    {
      "id": "team-u15-boys-right-002",
      "name": "Équipe U15 Garçons",
      "category": "team",
      "section": "Équipes",
      "subsection": "U15 Garçons",
      "weight": 50,
      "displayName": "U15 Garçons - Partie Droite",
      "images": [{ "side": "right", "url": "/images/u15-boys-right.png" }]
    },
    {
      "id": "team-u15-girls-left-003",
      "name": "Équipe U15 Filles",
      "category": "team",
      "section": "Équipes",
      "subsection": "U15 Filles",
      "weight": 50,
      "displayName": "U15 Filles - Partie Gauche",
      "images": [{ "side": "left", "url": "/images/u15-girls-left.png" }]
    },
    {
      "id": "team-u15-girls-right-004",
      "name": "Équipe U15 Filles",
      "category": "team",
      "section": "Équipes",
      "subsection": "U15 Filles",
      "weight": 50,
      "displayName": "U15 Filles - Partie Droite",
      "images": [{ "side": "right", "url": "/images/u15-girls-right.png" }]
    },
    
    // ... (22 autres cartes d'équipes, 24 au total pour 13 équipes)
    
    {
      "id": "coach-jean-martin-025",
      "name": "Coach",
      "category": "staff",
      "section": "Encadrement",
      "weight": 10,
      "displayName": "Jean Martin - Coach U15",
      "images": [{ "side": "full", "url": "/images/coach-jean-martin.png" }]
    },
    {
      "id": "coach-marie-dupont-026",
      "name": "Coach",
      "category": "staff",
      "section": "Encadrement",
      "weight": 10,
      "displayName": "Marie Dupont - Coach U18",
      "images": [{ "side": "full", "url": "/images/coach-marie-dupont.png" }]
    },
    
    // ... (18 autres coachs, 20 au total)
    
    {
      "id": "bureau-treasurer-045",
      "name": "Bureau",
      "category": "bureau",
      "section": "Bureau",
      "weight": 3,
      "displayName": "Trésorier - Pierre Leblanc",
      "images": [{ "side": "full", "url": "/images/bureau-treasurer.png" }]
    },
    {
      "id": "bureau-secretary-046",
      "name": "Bureau",
      "category": "bureau",
      "section": "Bureau",
      "weight": 3,
      "displayName": "Secrétaire - Sophie Bernard",
      "images": [{ "side": "full", "url": "/images/bureau-secretary.png" }]
    },
    {
      "id": "bureau-member1-047",
      "name": "Bureau",
      "category": "bureau",
      "section": "Bureau",
      "weight": 3,
      "displayName": "Membre du Bureau - Marc Petit",
      "images": [{ "side": "full", "url": "/images/bureau-member1.png" }]
    },
    {
      "id": "bureau-member2-048",
      "name": "Bureau",
      "category": "bureau",
      "section": "Bureau",
      "weight": 3,
      "displayName": "Membre du Bureau - Nathalie Garcia",
      "images": [{ "side": "full", "url": "/images/bureau-member2.png" }]
    },
    {
      "id": "bureau-president-049",
      "name": "Président",
      "category": "president",
      "section": "Bureau",
      "weight": 1,
      "displayName": "🌟 Président - Claude Dubois",
      "rarity": "legendary",
      "images": [{ "side": "full", "url": "/images/president.png" }]
    }
  ]
}
```

---

## 🔧 Génération des 51 UUIDs

**Commande rapide en Node.js** :

```javascript
// Générer 51 UUIDs
for (let i = 0; i < 51; i++) {
  console.log(crypto.randomUUID());
}
```

**Ou en Python** :
```python
import uuid

for i in range(51):
    print(f'"id": "{uuid.uuid4()}",')
```

**Ou online** : https://www.uuidgenerator.net/ (générer par batch)

Une fois générés, tu les copies dans `config.json` à la place des `"id"` fictifs.

---

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

## 🎨 Affichage HTML - Page du tirage quotidien

### Structure HTML principale

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collection Panini - ABP Basketball</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>🏀 Collection ABP Basketball</h1>
      <nav>
        <a href="#" class="nav-btn active" data-view="daily">Tirage du jour</a>
        <a href="#" class="nav-btn" data-view="gallery">Galerie complète</a>
        <a href="#" class="nav-btn" data-view="stats">Ma collection</a>
      </nav>
    </header>

    <!-- Vue : Tirage du jour -->
    <section id="daily-view" class="view active">
      <div class="daily-container">
        <!-- Message consentement -->
        <div id="consent-banner" class="consent-banner">
          <p>⚠️ Ce jeu stocke votre collection localement. Ne supprimez pas vos données navigateur ou vous perdrez tout !</p>
          <button id="consent-btn" class="btn-primary">J'ai compris</button>
        </div>

        <!-- Tirage -->
        <div id="draw-section" class="draw-section hidden">
          <div id="draw-status" class="draw-status"></div>
          <button id="draw-btn" class="btn-large">🎲 Tirer une carte</button>
          
          <!-- Cartes tirées -->
          <div id="drawn-cards" class="cards-container">
            <!-- Cartes avec flip générées dynamiquement -->
          </div>
        </div>

        <!-- Progression -->
        <div id="progress-section" class="progress-section">
          <h2>Votre progression</h2>
          <div class="progress-bar">
            <div id="progress-fill" class="progress-fill"></div>
          </div>
          <p id="progress-text">0/50 cartes</p>
          
          <div id="missing-cards" class="missing-cards-preview">
            <h3>Il vous manque :</h3>
            <ul id="missing-list"></ul>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button id="export-btn" class="btn-secondary">📥 Télécharger ma collection</button>
          <button id="import-btn" class="btn-secondary">📤 Importer une collection</button>
          <input type="file" id="import-file" accept=".json" style="display: none;">
        </div>
      </div>
    </section>

    <!-- Vue : Galerie complète -->
    <section id="gallery-view" class="view">
      <div class="gallery-container">
        <h2>Toutes les cartes</h2>
        <div id="gallery-filters" class="gallery-filters">
          <button class="filter-btn active" data-filter="all">Toutes</button>
          <button class="filter-btn" data-filter="staff">Staff</button>
          <button class="filter-btn" data-filter="bureau">Bureau</button>
          <button class="filter-btn" data-filter="team">Équipes</button>
        </div>
        
        <div id="gallery" class="gallery">
          <!-- Cartes générées dynamiquement -->
        </div>
      </div>
    </section>

    <!-- Vue : Ma collection -->
    <section id="stats-view" class="view">
      <div class="stats-container">
        <h2>Ma collection</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value" id="stat-total">0</span>
            <span class="stat-label">Cartes obtenues</span>
          </div>
          <div class="stat-card">
            <span class="stat-value" id="stat-unique">0</span>
            <span class="stat-label">Cartes uniques</span>
          </div>
          <div class="stat-card">
            <span class="stat-value" id="stat-duplicates">0</span>
            <span class="stat-label">Doublons</span>
          </div>
          <div class="stat-card">
            <span class="stat-value" id="stat-percentage">0%</span>
            <span class="stat-label">Collection</span>
          </div>
        </div>

        <div id="my-collection" class="collection-display">
          <!-- Cartes possédées affichées en grille -->
        </div>
      </div>
    </section>
  </div>

  <script src="js/utils.js"></script>
  <script src="js/game.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

---

## 💫 Effet de Flip - CSS & JavaScript

### CSS pour l'effet de flip

```css
/* Conteneur de la carte */
.flip-card {
  background-color: transparent;
  width: 200px;
  height: 300px;
  perspective: 1000px;
  cursor: pointer;
  margin: 20px auto;
}

/* Carte elle-même */
.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

/* Effet flip au hover ou avec classe .flipped */
.flip-card.flipped .flip-card-inner {
  transform: rotateY(180deg);
}

/* Avant (verso de la carte) */
.flip-card-front {
  background-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  border: 3px solid #764ba2;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  font-size: 40px;
}

/* Après (recto avec la carte) */
.flip-card-back {
  background-color: white;
  color: black;
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  border-radius: 10px;
  border: 3px solid #333;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Image de la carte */
.flip-card-back img {
  width: 100%;
  height: 70%;
  object-fit: cover;
}

/* Texte de la carte */
.flip-card-back .card-title {
  padding: 10px;
  font-weight: bold;
  font-size: 14px;
  text-align: center;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Animation de tirage */
@keyframes draw-pop {
  0% {
    transform: scale(0) rotateY(0deg);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    scale: 1;
    opacity: 1;
  }
}

.flip-card.draw-animation {
  animation: draw-pop 0.8s ease-out;
}
```

### JavaScript pour le flip

```javascript
class FlipCard {
  constructor(card, config) {
    this.card = card;
    this.config = config;
    this.element = null;
    this.flipped = false;
  }

  create() {
    const div = document.createElement('div');
    div.className = 'flip-card draw-animation';
    div.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          🎴
        </div>
        <div class="flip-card-back">
          <img src="${this.card.images[0].url}" 
               alt="${this.card.displayName}"
               onerror="this.src='images/placeholder.png'">
          <div class="card-title">${this.card.displayName}</div>
        </div>
      </div>
    `;

    // Click pour flip manuel
    div.addEventListener('click', () => this.toggle());
    
    this.element = div;
    return div;
  }

  toggle() {
    this.flipped = !this.flipped;
    this.element.classList.toggle('flipped');
  }

  flipAuto(delay = 0) {
    setTimeout(() => {
      this.toggle();
    }, delay);
  }
}

// Utilisation lors du tirage
async function displayDrawnCards(cards) {
  const container = document.getElementById('drawn-cards');
  container.innerHTML = ''; // Reset
  
  cards.forEach((card, index) => {
    const flipCard = new FlipCard(card, config);
    container.appendChild(flipCard.create());
    
    // Auto-flip après 1.5s avec délai entre chaque
    flipCard.flipAuto(1500 + (index * 200));
  });
}
```

---

## 🗂️ Galerie des cartes - Organisation par catégories

### Structure config.json enrichie avec catégories

```json
{
  "cards": [
    {
      "id": "uuid-coach-1",
      "name": "Coach Principal",
      "category": "staff",
      "section": "Encadrement",
      "weight": 15,
      "displayName": "Coach Principal - Jean Martin",
      "images": [{ "side": "full", "url": "/images/coach-1.png" }]
    },
    {
      "id": "uuid-bureau-1",
      "name": "Président",
      "category": "bureau",
      "section": "Bureau",
      "weight": 12,
      "displayName": "Président - Marie Dupont",
      "images": [{ "side": "full", "url": "/images/bureau-1.png" }]
    },
    {
      "id": "uuid-team-u15-left",
      "name": "Équipe U15",
      "category": "team",
      "section": "Équipes",
      "subsection": "U15 Garçons",
      "weight": 10,
      "displayName": "Équipe U15 Garçons - Partie Gauche",
      "images": [{ "side": "left", "url": "/images/u15-left.png" }]
    },
    {
      "id": "uuid-team-u15-right",
      "name": "Équipe U15",
      "category": "team",
      "section": "Équipes",
      "subsection": "U15 Garçons",
      "weight": 10,
      "displayName": "Équipe U15 Garçons - Partie Droite",
      "images": [{ "side": "right", "url": "/images/u15-right.png" }]
    }
  ]
}
```

### HTML pour la galerie organisée

```html
<div id="gallery" class="gallery-organized">
  <!-- Généré dynamiquement par JS -->
</div>

<style>
.gallery-organized {
  max-width: 1200px;
  margin: 0 auto;
}

.gallery-section {
  margin-bottom: 60px;
}

.gallery-section h2 {
  font-size: 32px;
  margin-bottom: 10px;
  border-bottom: 3px solid #667eea;
  padding-bottom: 10px;
}

.gallery-subsection {
  margin-top: 30px;
  margin-bottom: 40px;
}

.gallery-subsection h3 {
  font-size: 20px;
  color: #666;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  align-items: start;
}

.gallery-card {
  position: relative;
  aspect-ratio: 2/3;
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
}

.gallery-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

/* Indicateur de possession */
.gallery-card.owned {
  border-color: #22c55e;
}

.gallery-card.owned::after {
  content: '✓';
  position: absolute;
  top: 5px;
  right: 5px;
  background: #22c55e;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  z-index: 10;
}

.gallery-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-card-title {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  padding: 10px;
  font-size: 12px;
  font-weight: bold;
}

.gallery-card.owned .gallery-card-title {
  background: linear-gradient(transparent, rgba(34, 197, 94, 0.7));
}
</style>
```

### JavaScript pour générer la galerie organisée

```javascript
function buildGalleryBySection(config, collection) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  
  // Grouper par section
  const sections = {};
  
  config.cards.forEach(card => {
    const section = card.section || 'Autres';
    const subsection = card.subsection || null;
    
    if (!sections[section]) {
      sections[section] = {};
    }
    
    if (subsection) {
      if (!sections[section][subsection]) {
        sections[section][subsection] = [];
      }
      sections[section][subsection].push(card);
    } else {
      if (!sections[section]['default']) {
        sections[section]['default'] = [];
      }
      sections[section]['default'].push(card);
    }
  });
  
  // Afficher chaque section
  Object.entries(sections).forEach(([sectionName, subsections]) => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'gallery-section';
    
    const sectionTitle = document.createElement('h2');
    sectionTitle.textContent = sectionName;
    sectionDiv.appendChild(sectionTitle);
    
    // Afficher chaque sous-section
    Object.entries(subsections).forEach(([subsectionName, cards]) => {
      const subsectionDiv = document.createElement('div');
      subsectionDiv.className = 'gallery-subsection';
      
      if (subsectionName !== 'default') {
        const subsectionTitle = document.createElement('h3');
        subsectionTitle.textContent = subsectionName;
        subsectionDiv.appendChild(subsectionTitle);
      }
      
      const grid = document.createElement('div');
      grid.className = 'cards-grid';
      
      cards.forEach(card => {
        const cardEl = createGalleryCard(card, collection);
        grid.appendChild(cardEl);
      });
      
      subsectionDiv.appendChild(grid);
      sectionDiv.appendChild(subsectionDiv);
    });
    
    gallery.appendChild(sectionDiv);
  });
}

function createGalleryCard(card, collection) {
  const div = document.createElement('div');
  div.className = 'gallery-card';
  
  const isOwned = collection.includes(card.id);
  if (isOwned) {
    div.classList.add('owned');
  }
  
  div.innerHTML = `
    <img src="${card.images[0].url}" 
         alt="${card.displayName}"
         onerror="this.src='images/placeholder.png'">
    <div class="gallery-card-title">${card.displayName}</div>
  `;
  
  // Click pour afficher plus d'infos
  div.addEventListener('click', () => {
    showCardDetail(card, isOwned);
  });
  
  return div;
}

// Modal pour plus de détails
function showCardDetail(card, isOwned) {
  const modal = document.createElement('div');
  modal.className = 'card-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close">&times;</button>
      <img src="${card.images[0].url}" alt="${card.displayName}">
      <h2>${card.displayName}</h2>
      <p><strong>Catégorie :</strong> ${card.category}</p>
      <p><strong>Possession :</strong> ${isOwned ? '✅ Obtenue' : '❌ Manquante'}</p>
      <p><strong>Rareté :</strong> ${getRarityLabel(card.weight)}</p>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function getRarityLabel(weight) {
  if (weight >= 15) return 'Commune ⭐';
  if (weight >= 10) return 'Peu commune ⭐⭐';
  if (weight >= 5) return 'Rare ⭐⭐⭐';
  return 'Très rare ⭐⭐⭐⭐';
}
```

---

## 🎯 Flux utilisateur complet

### 1️⃣ Première visite

```
┌─────────────────────────────┐
│  Page de tirage du jour     │
│                             │
│  ⚠️ Banneau consentement    │ ← Doit accepter
│     localStorage            │
│                             │
│  🎲 Tirer une carte         │ ← Bouton principal
│                             │
│  Progression : 0/50         │
└─────────────────────────────┘
        ↓ Clique
┌─────────────────────────────┐
│  Effet flip de la carte     │
│                             │
│    [Verso]   →  [Recto]    │ ← Animation 0.6s
│                             │
│  Nom de la carte affichée   │
└─────────────────────────────┘
```

### 2️⃣ Navigation vers la galerie

```
┌─────────────────────────────┐
│  Galerie complète           │
│                             │
│  Filtres : Tous|Staff|Équipes│
│                             │
│  📋 Encadrement             │
│  ┌──┐ ┌──┐ ┌──┐            │
│  │✓ │ │ │ │  │            │ ← ✓ = possédée
│  └──┘ └──┘ └──┘            │
│                             │
│  📋 Bureau                  │
│  ┌──┐ ┌──┐ ┌──┐            │
│  │ │ │✓ │ │  │            │
│  └──┘ └──┘ └──┘            │
│                             │
│  🏀 Équipes                 │
│    U15 Garçons             │
│  ┌──┐ ┌──┐                 │
│  │✓ │ │✓ │                │
│  └──┘ └──┘                 │
└─────────────────────────────┘
```

### 3️⃣ Section "Ma collection"

```
┌──────────────────────────────┐
│  Ma collection               │
│                              │
│  ┌────┐ ┌────┐ ┌────┐      │
│  │ 25 │ │ 20 │ │ 5  │      │
│  │ Total│Uniques│Doublons   │
│  └────┘ └────┘ └────┘      │
│                              │
│  Ma collection : 50% ████░░  │
│                              │
│  Cartes obtenues :           │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │✓ │ │✓ │ │✓ │ │  │       │
│  └──┘ └──┘ └──┘ └──┘       │
└──────────────────────────────┘
```

---

## 📁 Structuration CSS recommandée

```css
/* css/style.css */

/* Variables globales */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #22c55e;
  --text-dark: #1f2937;
  --text-light: #9ca3af;
  --border-radius: 10px;
  --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Layout général */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: var(--text-dark);
  margin: 0;
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Navigation */
header {
  background: white;
  border-radius: var(--border-radius);
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: var(--box-shadow);
}

header h1 {
  margin: 0 0 20px 0;
  text-align: center;
  color: var(--primary-color);
}

nav {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.nav-btn {
  padding: 10px 20px;
  border: 2px solid var(--primary-color);
  background: white;
  color: var(--primary-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.3s;
  font-weight: bold;
}

.nav-btn.active {
  background: var(--primary-color);
  color: white;
}

/* Sections */
.view {
  display: none;
}

.view.active {
  display: block;
}

/* Boutons */
.btn-primary, .btn-large, .btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.3s;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-large {
  background: var(--primary-color);
  color: white;
  font-size: 20px;
  padding: 20px 40px;
  width: 100%;
  max-width: 300px;
}

.btn-secondary {
  background: white;
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
}

/* Autres... */
```

---

## 📁 Architecture des fichiers - Séparation des responsabilités

### ⚠️ Principe fondamental

**Tous les fichiers DOIVENT être séparés et modulaires** :
- ❌ Pas de `<style>` inline dans l'HTML
- ❌ Pas de `<script>` inline dans l'HTML
- ✅ Un seul appel à chaque fichier CSS et JS

### Structure du projet

```
panini-abp/
├── index.html                 # HTML pur (structure uniquement)
├── css/
│   └── style.css             # Tous les styles (variables, animations, layout)
├── js/
│   ├── utils.js              # Fonctions utilitaires (hash, UUID validation)
│   ├── storage.js            # localStorage wrapper (get, set, delete)
│   ├── game.js               # Logique du jeu (tirage, seed, checksum)
│   ├── flip-card.js          # Classe FlipCard (gestion animation flip)
│   ├── ui.js                 # Affichage & DOM manipulation
│   ├── gallery.js            # Galerie des cartes
│   └── app.js                # Point d'entrée & coordination
├── config.json               # Configuration du jeu
├── images/
│   ├── coach-*.png
│   ├── u15-*.png
│   └── ...
└── .gitignore
```

---

## 📄 Détail des fichiers JavaScript

### `js/utils.js` - Fonctions utilitaires

**Responsabilité** : Toutes les fonctions pures, indépendantes du DOM

```javascript
/**
 * utils.js - Fonctions utilitaires et helpers
 */

// Hashing simple pour checksum
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}

// Génère une seed basée sur la date du jour
export function getDailySeed(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]; // "2026-08-01"
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647; // 0-1
}

// Tirage aléatoire pondéré
export function weightedRandomCard(cards, seed) {
  const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
  let random = seed * totalWeight;
  
  for (const card of cards) {
    random -= card.weight;
    if (random <= 0) return card;
  }
  
  return cards[cards.length - 1];
}

// Validation des IDs de cartes
export function validateCardId(cardId, validIds) {
  return validIds.has(cardId);
}

// Formatage de la date
export function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// Rareté basée sur le weight
export function getRarityLabel(weight) {
  if (weight >= 40) return 'Commune ⭐';
  if (weight >= 15) return 'Peu commune ⭐⭐';
  if (weight >= 5) return 'Rare ⭐⭐⭐';
  if (weight >= 2) return 'Très rare ⭐⭐⭐⭐';
  return 'Exceptionnelle 🌟';
}
```

---

### `js/storage.js` - Gestion du localStorage

**Responsabilité** : Abstraire la manipulation du localStorage

```javascript
/**
 * storage.js - Wrapper pour localStorage
 */

const STORAGE_KEY = 'paniniGame';

export function getCollection() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      collection: [],
      lastDrawDate: null,
      checksum: null,
      version: "1.0"
    };
  } catch (e) {
    console.error('Erreur lecture localStorage', e);
    return { collection: [], lastDrawDate: null };
  }
}

export function saveCollection(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('localStorage plein');
      alert('Espace de stockage plein ! Veuillez libérer de l\'espace navigateur.');
    }
    return false;
  }
}

export function deleteCollection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Erreur suppression', e);
    return false;
  }
}

export function exportCollection() {
  const data = getCollection();
  return JSON.stringify(data, null, 2);
}

export function importCollection(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.collection || !Array.isArray(data.collection)) {
      throw new Error('Format invalide');
    }
    saveCollection(data);
    return true;
  } catch (e) {
    console.error('Import invalide', e);
    return false;
  }
}
```

---

### `js/game.js` - Logique du jeu

**Responsabilité** : Tirage, validation, gestion d'état du jeu

```javascript
/**
 * game.js - Logique du jeu (tirage, seed, validation)
 */

import { getDailySeed, weightedRandomCard, simpleHash, formatDate } from './utils.js';
import { getCollection, saveCollection, validateCardId } from './storage.js';

let config = null;

export async function initGame() {
  try {
    const response = await fetch('config.json');
    config = await response.json();
    return config;
  } catch (e) {
    console.error('Impossible charger config.json', e);
    throw e;
  }
}

export function isInIncreasePhase() {
  if (!config || !config.drawsIncreasePhase?.enabled) return false;
  const today = formatDate();
  return today >= config.drawsIncreasePhase.startDate;
}

export function getCardsPerDraw() {
  if (isInIncreasePhase()) {
    return config.drawsIncreasePhase.cardsPerDraw;
  }
  return config.mechanics.cardsPerDraw;
}

export function canDrawToday() {
  const stored = getCollection();
  const today = formatDate();
  return stored.lastDrawDate !== today;
}

export function drawCardsForToday() {
  if (!config) throw new Error('Game not initialized');
  
  const stored = getCollection();
  const today = formatDate();
  
  if (!canDrawToday()) {
    return {
      status: 'already_drawn',
      cards: [],
      message: 'Vous avez déjà tiré aujourd\'hui !'
    };
  }
  
  const cardsPerDraw = getCardsPerDraw();
  const drawnCards = [];
  const seed = getDailySeed();
  
  // Tirage des cartes
  for (let i = 0; i < cardsPerDraw; i++) {
    const card = weightedRandomCard(config.cards, seed + i / 1000);
    drawnCards.push(card);
  }
  
  // Validation et sauvegarde
  const validIds = new Set(config.cards.map(c => c.id));
  const collection = stored.collection || [];
  const newIds = drawnCards.map(c => c.id).filter(id => validateCardId(id, validIds));
  
  collection.push(...newIds);
  
  const checksum = simpleHash(JSON.stringify(collection.sort()));
  
  const newData = {
    collection,
    lastDrawDate: today,
    checksum,
    version: "1.0"
  };
  
  saveCollection(newData);
  
  return {
    status: 'success',
    cards: drawnCards,
    message: `Vous avez tiré ${drawnCards.length} carte(s) !`
  };
}

export function getPlayerStats() {
  if (!config) throw new Error('Game not initialized');
  
  const stored = getCollection();
  const collection = stored.collection || [];
  
  const unique = new Set(collection);
  const duplicates = collection.length - unique.size;
  const percentage = Math.round((unique.size / config.cards.length) * 100);
  
  return {
    total: collection.length,
    unique: unique.size,
    duplicates,
    percentage,
    missing: config.cards.filter(c => !unique.has(c.id))
  };
}
```

---

### `js/flip-card.js` - Composant FlipCard

**Responsabilité** : Gestion de l'animation flip (classe réutilisable)

```javascript
/**
 * flip-card.js - Classe FlipCard avec animation
 */

export class FlipCard {
  constructor(card) {
    this.card = card;
    this.element = null;
    this.isFlipped = false;
    this.delayMs = 0;
  }

  create() {
    const div = document.createElement('div');
    div.className = 'flip-card appearing';
    div.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          🎴
        </div>
        <div class="flip-card-back">
          <img src="${this.card.images[0].url}" 
               alt="${this.card.displayName}"
               onerror="this.src='images/placeholder.png'">
          <div class="card-title">${this.card.displayName}</div>
        </div>
      </div>
    `;

    this.element = div;
    return div;
  }

  flip() {
    this.isFlipped = true;
    this.element?.classList.add('flipping');
  }

  setAppearanceDelay(ms) {
    if (this.element) {
      this.element.style.animationDelay = `${ms}ms`;
    }
  }

  flipWithDelay(delayMs) {
    this.delayMs = delayMs;
    setTimeout(() => this.flip(), delayMs);
  }
}
```

---

### `js/ui.js` - Gestion du DOM

**Responsabilité** : Affichage, navigation, événements utilisateur

```javascript
/**
 * ui.js - Manipulation du DOM et affichage
 */

import { FlipCard } from './flip-card.js';
import { getRarityLabel } from './utils.js';

export function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class
      navBtns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      
      // Add active class
      const viewName = btn.dataset.view;
      btn.classList.add('active');
      document.getElementById(`${viewName}-view`).classList.add('active');
    });
  });
}

export function displayDrawnCards(cards) {
  const container = document.getElementById('drawn-cards');
  const flipBtn = document.getElementById('flip-btn');
  
  container.innerHTML = '';
  flipBtn.style.display = 'block';
  flipBtn.disabled = false;
  
  const flipCards = [];
  
  cards.forEach((card, index) => {
    const flipCard = new FlipCard(card);
    const cardEl = flipCard.create();
    
    cardEl.style.animationDelay = `${index * 100}ms`;
    container.appendChild(cardEl);
    
    flipCards.push({
      flipCard,
      delayBeforeFlip: 1000 + (index * 200)
    });
  });

  // Event listener du bouton flip
  flipBtn.addEventListener('click', () => {
    flipBtn.disabled = true;
    
    flipCards.forEach(({ flipCard, delayBeforeFlip }) => {
      flipCard.flipWithDelay(delayBeforeFlip);
    });
    
    const maxDelay = Math.max(...flipCards.map(f => f.delayBeforeFlip)) + 600;
    setTimeout(() => {
      flipBtn.disabled = false;
    }, maxDelay);
  }, { once: true }); // Une seule exécution
}

export function updateProgress(stats) {
  document.getElementById('progress-text').textContent = 
    `${stats.unique}/${stats.total} cartes`;
  
  const percentage = Math.min(100, (stats.unique / 51) * 100);
  document.getElementById('progress-fill').style.width = `${percentage}%`;
}

export function displayMissing(missing) {
  const list = document.getElementById('missing-list');
  list.innerHTML = '';
  
  missing.slice(0, 5).forEach(card => {
    const li = document.createElement('li');
    li.textContent = card.displayName;
    list.appendChild(li);
  });
  
  if (missing.length > 5) {
    const li = document.createElement('li');
    li.textContent = `... et ${missing.length - 5} autres`;
    li.style.fontStyle = 'italic';
    list.appendChild(li);
  }
}

export function setupConsentBanner() {
  const banner = document.getElementById('consent-banner');
  const btn = document.getElementById('consent-btn');
  
  if (!localStorage.getItem('paniniConsent')) {
    btn.addEventListener('click', () => {
      localStorage.setItem('paniniConsent', 'true');
      banner.style.display = 'none';
      document.getElementById('draw-section').classList.remove('hidden');
    });
  } else {
    banner.style.display = 'none';
    document.getElementById('draw-section').classList.remove('hidden');
  }
}
```

---

### `js/gallery.js` - Galerie des cartes

**Responsabilité** : Génération et affichage de la galerie

```javascript
/**
 * gallery.js - Galerie des cartes
 */

import { getCollection } from './storage.js';
import { getRarityLabel } from './utils.js';

export function buildGalleryBySection(config) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  
  const stored = getCollection();
  const ownedIds = new Set(stored.collection || []);
  
  // Grouper par section
  const sections = {};
  config.cards.forEach(card => {
    const section = card.section || 'Autres';
    const subsection = card.subsection || 'default';
    
    if (!sections[section]) sections[section] = {};
    if (!sections[section][subsection]) sections[section][subsection] = [];
    
    sections[section][subsection].push(card);
  });
  
  // Afficher
  Object.entries(sections).forEach(([sectionName, subsections]) => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'gallery-section';
    
    const title = document.createElement('h2');
    title.textContent = sectionName;
    sectionDiv.appendChild(title);
    
    Object.entries(subsections).forEach(([subsectionName, cards]) => {
      const subsectionDiv = document.createElement('div');
      subsectionDiv.className = 'gallery-subsection';
      
      if (subsectionName !== 'default') {
        const subtitle = document.createElement('h3');
        subtitle.textContent = subsectionName;
        subsectionDiv.appendChild(subtitle);
      }
      
      const grid = document.createElement('div');
      grid.className = 'cards-grid';
      
      cards.forEach(card => {
        const cardEl = createGalleryCard(card, ownedIds);
        grid.appendChild(cardEl);
      });
      
      subsectionDiv.appendChild(grid);
      sectionDiv.appendChild(subsectionDiv);
    });
    
    gallery.appendChild(sectionDiv);
  });
}

function createGalleryCard(card, ownedIds) {
  const div = document.createElement('div');
  div.className = 'gallery-card';
  
  const isOwned = ownedIds.has(card.id);
  if (isOwned) div.classList.add('owned');
  
  div.innerHTML = `
    <img src="${card.images[0].url}" 
         alt="${card.displayName}"
         onerror="this.src='images/placeholder.png'">
    <div class="gallery-card-title">${card.displayName}</div>
  `;
  
  div.addEventListener('click', () => showCardDetail(card, isOwned));
  
  return div;
}

function showCardDetail(card, isOwned) {
  const modal = document.createElement('div');
  modal.className = 'card-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close">&times;</button>
      <img src="${card.images[0].url}" alt="${card.displayName}">
      <h2>${card.displayName}</h2>
      <p><strong>Catégorie :</strong> ${card.category}</p>
      <p><strong>Possession :</strong> ${isOwned ? '✅ Obtenue' : '❌ Manquante'}</p>
      <p><strong>Rareté :</strong> ${getRarityLabel(card.weight)}</p>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

export function setupFilterButtons(config) {
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      filterCards(config, filter);
    });
  });
}

function filterCards(config, filter) {
  const cards = filter === 'all' 
    ? config.cards 
    : config.cards.filter(c => c.category === filter);
  
  // Reconstruire la galerie filtrée
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  // Implémenter le filtrage...
}
```

---

### `js/app.js` - Point d'entrée principal

**Responsabilité** : Coordination générale et orchestration

```javascript
/**
 * app.js - Point d'entrée principal
 */

import { initGame, drawCardsForToday, getPlayerStats } from './game.js';
import { setupNavigation, displayDrawnCards, updateProgress, displayMissing, setupConsentBanner } from './ui.js';
import { buildGalleryBySection, setupFilterButtons } from './gallery.js';

let config = null;

async function init() {
  try {
    // 1. Charger la config
    config = await initGame();
    console.log('Config chargée :', config);
    
    // 2. Setup UI général
    setupConsentBanner();
    setupNavigation();
    
    // 3. Setup galerie
    buildGalleryBySection(config);
    setupFilterButtons(config);
    
    // 4. Setup tirage quotidien
    setupDailyDraw();
    
    // 5. Afficher stats
    updateStats();
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation', error);
    alert('Erreur lors du chargement du jeu. Rafraîchissez la page.');
  }
}

function setupDailyDraw() {
  const drawBtn = document.getElementById('draw-btn');
  
  drawBtn?.addEventListener('click', () => {
    try {
      const result = drawCardsForToday();
      
      if (result.status === 'success') {
        displayDrawnCards(result.cards);
        updateStats();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Erreur tirage', error);
      alert('Erreur lors du tirage. Rafraîchissez la page.');
    }
  });
}

function updateStats() {
  const stats = getPlayerStats();
  updateProgress(stats);
  displayMissing(stats.missing);
  
  // Mise à jour "Ma collection"
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-unique').textContent = stats.unique;
  document.getElementById('stat-duplicates').textContent = stats.duplicates;
  document.getElementById('stat-percentage').textContent = `${stats.percentage}%`;
}

// Lancer l'app
window.addEventListener('DOMContentLoaded', init);
```

---

## 🎯 Résumé des responsabilités

| Fichier | Responsabilité | Exemple |
|---------|-----------------|---------|
| `utils.js` | Fonctions pures | hash, seed, validation |
| `storage.js` | localStorage abstrait | get, set, import, export |
| `game.js` | Logique du jeu | tirage, stats, seed |
| `flip-card.js` | Classe animation | FlipCard (create, flip) |
| `ui.js` | DOM & événements | display, navigation, progress |
| `gallery.js` | Galerie & détails | build, filter, modal |
| `app.js` | Orchestration | init, setup, coordination |

---

## 🔗 Ordre de chargement dans index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collection Panini ABP</title>
  
  <!-- CSS seul -->
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- HTML seul (pas de script ni style) -->
  <div class="container">
    <!-- ... -->
  </div>

  <!-- Scripts modulaires -->
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

**Important** : `app.js` importe tous les autres modules (ES6 modules). Un seul point d'entrée !

---

## ✅ Avantages de cette architecture

✅ **Maintenabilité** : Chaque fichier a une responsabilité claire  
✅ **Testabilité** : Fonctions pures peuvent être testées isolément  
✅ **Réutilisabilité** : FlipCard peut être utilisé ailleurs  
✅ **Scalabilité** : Facile d'ajouter de nouvelles fonctionnalités  
✅ **Performance** : CSS/JS compactes et optimisées  
✅ **Collaboration** : Plusieurs devs peuvent travailler en parallèle  

---

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