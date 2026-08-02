# 📋 Index complet - Prototype Panini ABP

## 📂 Structure des fichiers

```
panini-abp/
├── 📄 index.html              ← PAGE 1 : Tirage quotidien
├── 📄 gallery.html            ← PAGE 2 : Galerie complète
├── 📄 stats.html              ← PAGE 3 : Ma collection
│
├── 📁 css/
│   └── style.css              ← Tous les styles (1 seul fichier)
│
├── 📁 js/
│   ├── app.js                 ← Point d'entrée pour index.html
│   ├── gallery-page.js        ← Point d'entrée pour gallery.html
│   ├── stats-page.js          ← Point d'entrée pour stats.html
│   ├── utils.js               ← Fonctions pures (hash, seed, rareté)
│   ├── storage.js             ← localStorage wrapper
│   ├── game.js                ← Logique du jeu (tirage, stats)
│   ├── flip-card.js           ← Classe FlipCard
│   ├── ui.js                  ← Affichage (modal, consentement)
│   └── gallery.js             ← Galerie (nouvelle structure)
│
├── 📄 config.json             ← Configuration + 9 cartes de test
├── 📄 README.md               ← Instructions d'utilisation
├── 📄 CHANGES.md              ← Détail des modifications
├── 📄 INSTALLATION.md         ← Guide complet d'installation
└── 📄 .gitignore              ← Fichiers à ignorer pour Git
```

---

## 📚 Documentation

### Pour démarrer
👉 **INSTALLATION.md** - Guide complet (à lire en premier !)

### Pour comprendre les changements
👉 **CHANGES.md** - Détail de toutes les modifications

### Pour utiliser
👉 **README.md** - Instructions d'utilisation du prototype

### Pour développer
👉 **panini-basketball.md** - Documentation technique complète (fournie séparément)

---

## 🎯 Les 3 pages

### 1️⃣ **index.html** - Tirage du jour
- Point d'entrée : `js/app.js`
- Fonctionnalités :
  - Tirage quotidien aléatoire
  - Flip animation avec suspense
  - Banneau consentement localStorage
  - Actions : export/import/reset
  - Stats rapides

### 2️⃣ **gallery.html** - Galerie
- Point d'entrée : `js/gallery-page.js`
- Fonctionnalités :
  - Toutes les cartes organisées par sections
  - Filtres : Toutes, Équipes, Coachs, Bureau, Président
  - Modal détails au click
  - Indicateur de possession (✓ vert)

### 3️⃣ **stats.html** - Ma collection
- Point d'entrée : `js/stats-page.js`
- Fonctionnalités :
  - Statistiques complètes
  - Barre de progression
  - Cartes obtenues avec doublons
  - Actions : export/import/reset

---

## ⚡ Quick start

```bash
# 1. Télécharger tous les fichiers de outputs/

# 2. Créer la structure exacte (ou utiliser les fichiers comme-is)

# 3. Tester localement
python -m http.server 8000

# 4. Ouvrir
http://localhost:8000/           # Tirage
http://localhost:8000/gallery.html   # Galerie
http://localhost:8000/stats.html     # Stats
```

---

## 🔄 Flux de données

```
                    ┌─────────────────┐
                    │  config.json    │
                    │   9 cartes      │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │ index.html  │  │gallery.html  │  │ stats.html   │
    │   (Tirage)  │  │  (Galerie)   │  │   (Stats)    │
    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
           │                │                 │
           │   app.js       │ gallery-page.js │ stats-page.js
           │                │                 │
           └────────────────┼─────────────────┘
                            │
                    ┌───────▼────────┐
                    │  localStorage  │
                    │  paniniGame    │
                    │  - collection  │
                    │  - lastDraw    │
                    └────────────────┘
```

---

## 🛠️ Modules JavaScript

### Séparation des responsabilités

| Module | Responsabilité | Utilisé par |
|--------|---|---|
| **utils.js** | Fonctions pures (hash, seed, validation) | game.js, ui.js, gallery.js |
| **storage.js** | Accès à localStorage | game.js, app.js, stats-page.js |
| **game.js** | Logique du jeu (tirage, stats) | app.js |
| **flip-card.js** | Classe FlipCard (animation) | ui.js |
| **ui.js** | Affichage (modal, consentement) | app.js, gallery-page.js, stats-page.js |
| **gallery.js** | Construction galerie | gallery-page.js |

---

## 📊 Configuration (config.json)

### Structure
```json
{
  "game": { ... },           // Infos du jeu
  "mechanics": { ... },      // Nombre de cartes par tirage
  "drawsIncreasePhase": { }, // Phase d'augmentation
  "cards": [ ... ],          // 9 cartes de test
  "gallery": {               // NEW : Organisation galerie
    "sections": [ ... ]
  }
}
```

### 9 Cartes de test
- 4 équipes (U9 Filles, U18 Filles)
- 3 coachs (Annaelle, Yoann, Sebastien)
- 2 bureau (Christian, Pascal Président)

**Poids** : Équipes (10), Coachs (10), Bureau (3), Président (1)

---

## ✅ Qu'est-ce qui a changé

### ✨ Avant (prototype initial)
- Une seule page HTML avec 3 vues (SPA)
- Navigation avec anchors et dataset
- gallery.js utilisait la structure des cartes

### ✨ Après (version mise à jour)
- 3 pages HTML indépendantes (multi-pages)
- Navigation avec href vers pages
- config.json restructuré avec section galerie
- gallery.js utilise la nouvelle structure
- Bug validateCardId corrigé

### 🎁 Avantages
- Pages plus légères
- URLs directes (shareable)
- Meilleure séparation
- Chargement au besoin
- Plus maintenable

---

## 🚀 Passage en production

### Étapes
1. **Ajouter les 51 cartes** dans config.json
2. **Remplacer les images** par les vraies photos
3. **Valider le JSON** (`python -m json.tool config.json`)
4. **Tester localement** (les 3 pages)
5. **Déployer sur GitHub** Pages

### Checkpoints
- [ ] Toutes les cartes ajoutées
- [ ] Images compressées et en place
- [ ] JSON validé
- [ ] Testé sur mobile
- [ ] GitHub Pages activé
- [ ] URL communiquée

---

## 💡 Points clés

🎲 **Tirage** : Seed quotidien déterministe (même pour tout le monde)  
🎴 **Flip** : Animation 0.6s + suspense 1s + délai 200ms  
🗂️ **Galerie** : Organisée par sections/subsections avec filtres  
💾 **Persistence** : localStorage partagé entre les 3 pages  
🔒 **Sécurité** : UUIDs, checksum, validation des cartes  

---

## 📞 Support

- **Questions** ? Voir panini-basketball.md (doc technique complète)
- **Bugs** ? Vérifier config.json avec `python -m json.tool`
- **Tests** ? Ouvrir Console (F12) et utiliser localStorage directement

---

## 📦 Fichiers à télécharger

✅ Tous les fichiers sont dans **outputs/**

```
Index.md              ← Tu es ici
INSTALLATION.md       ← À lire en premier
CHANGES.md            ← Si tu veux les détails
config.json           ← Configuration (mise à jour)
index.html            ← Page 1
gallery.html          ← Page 2
stats.html            ← Page 3
css/style.css         ← Styles
js/                   ← 9 fichiers JavaScript
README.md             ← Instructions
.gitignore            ← Pour Git
```

---

## 🎉 Tu es prêt !

Le prototype est **100% fonctionnel** et **100% modulaire**.

Prochains pas :
1. Lire **INSTALLATION.md**
2. Télécharger les fichiers
3. Tester localement
4. Ajouter tes 51 cartes
5. Déployer sur GitHub Pages

Bonne luck ! 🏀
