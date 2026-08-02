# 🎉 Prototype Panini ABP - Mise à jour complète

## ✨ Modifications principales

?gift=c3RlZXZlLWNvYWNoLTAwNA

### 1. **Configuration restructurée** ✅
Ton `config.json` a été intégré avec une nouvelle structure :
- Section `gallery` séparée avec `sections` et `subsections`
- Les cartes référencées par ID dans la galerie
- Structure plus flexible et maintenable

### 2. **Architecture multi-pages** ✅
Le prototype est maintenant composé de **3 pages HTML indépendantes** :

| Page | Fichier | Fonction |
|------|---------|----------|
| **Tirage du jour** | `index.html` | Tirage quotidien + flip card |
| **Galerie** | `gallery.html` | Toutes les cartes organisées |
| **Ma collection** | `stats.html` | Statistiques + export/import |

### 3. **Point d'entrée JavaScript dédié** ✅
Chaque page a son propre fichier d'orchestration :
- `app.js` → index.html (tirage)
- `gallery-page.js` → gallery.html (galerie)
- `stats-page.js` → stats.html (stats)

### 4. **Bug corrigé** ✅
Import de `validateCardId` : `utils.js` au lieu de `storage.js`

---

## 📁 Fichiers du prototype (17 fichiers)

### Pages HTML (3)
```
index.html           Tirage quotidien
gallery.html         Galerie complète
stats.html           Ma collection + actions
```

### Styles (1)
```
css/style.css        Tous les styles (CSS pur, responsive)
```

### JavaScript (10)
```
js/app.js            Point d'entrée index.html
js/gallery-page.js   Point d'entrée gallery.html
js/stats-page.js     Point d'entrée stats.html
js/utils.js          Fonctions pures (hash, seed, rareté)
js/storage.js        localStorage wrapper
js/game.js           Logique du jeu (tirage, stats)
js/flip-card.js      Classe FlipCard
js/ui.js             Affichage (modal, consentement)
js/gallery.js        Construction galerie
```

### Configuration (1)
```
config.json          Configuration + 9 cartes
```

### Documentation (3)
```
README.md            Instructions d'utilisation
CHANGES.md           Détail des modifications
.gitignore           Fichiers à ignorer Git
```

---

## 🚀 Comment utiliser

### Installation rapide

```bash
# Télécharger les fichiers (tu as tous les fichiers dans outputs/)
# Créer un dossier panini-abp/ avec la structure :

panini-abp/
├── index.html
├── gallery.html
├── stats.html
├── config.json
├── css/style.css
├── js/
│   ├── app.js
│   ├── gallery-page.js
│   ├── stats-page.js
│   ├── utils.js
│   ├── storage.js
│   ├── game.js
│   ├── flip-card.js
│   ├── ui.js
│   └── gallery.js
└── README.md
```

### Tester localement

**Option 1 : Python**
```bash
cd panini-abp
python -m http.server 8000
# Ouvrir http://localhost:8000
```

**Option 2 : Node.js**
```bash
npx http-server panini-abp
# Ouvrir http://localhost:8080
```

---

## 🎮 Fonctionnalités par page

### **index.html** - Tirage du jour
- ✅ Tirage quotidien (1 carte/jour)
- ✅ Même tirage pour tout le monde (seed quotidien)
- ✅ Flip animation avec délai 1s
- ✅ Banneau consentement localStorage
- ✅ Progression visible
- ✅ Export/Import collection
- ✅ Réinitialiser (test)

### **gallery.html** - Galerie
- ✅ Toutes les cartes organisées par section
- ✅ Sous-sections (U9 Filles, U18 Filles, Coachs, Bureau)
- ✅ Filtres : Toutes, Équipes, Coachs, Bureau, Président
- ✅ Indicateur ✓ vert pour cartes possédées
- ✅ Modal au click pour détails

### **stats.html** - Ma collection
- ✅ Statistiques : total, uniques, doublons, %
- ✅ Barre de progression
- ✅ Cartes obtenues avec nombre de doublons
- ✅ Export JSON (backup)
- ✅ Import JSON (restore)
- ✅ Réinitialiser (test)

---

## 📊 Nouvelles cartes configurées

**9 cartes de test** avec tes vraies données :
1. U9 Filles - Gauche (weight 10)
2. U9 Filles - Droite (weight 10)
3. U18 Filles - Gauche (weight 10)
4. U18 Filles - Droite (weight 10)
5. Annaelle - Coach U9M (weight 10)
6. Yoann - Coach U11F (weight 10)
7. Sebastien - Coach U11F (weight 10)
8. Christian - Vice Président (weight 3)
9. Pascal - Président (weight 1)

**Images** : Pointent vers `/ressources/Equipes/...` et `/ressources/Coachs/...`

---

## 🔄 Passage en production

### Étape 1 : Remplacer les images
```
/ressources/
├── Equipes/2025-2026/
│   ├── U9F1 - 01.jpg
│   └── U18F.jpg
└── Coachs/
    ├── anaelle.jpg
    ├── Yoann.jpg
    ├── Sebastien.jpg
    ├── Christian.jpg
    └── Pascal Dorchy.jpg
```

### Étape 2 : Compléter config.json
Ajouter toutes les 51 cartes (ou le nombre final) avec :
- ID UUID unique
- Nom, catégorie, weight
- Images avec bons chemins
- Organisation dans `gallery.sections`

### Étape 3 : Déployer sur GitHub Pages
```bash
git init
git add .
git commit -m "Prototype Panini ABP complet"
git remote add origin https://github.com/TON_USER/panini-abp.git
git push -u origin main

# Activer Pages : Settings → Pages → Source: main
```

---

## 🎯 Navigation entre pages

```
index.html
  ├─ Lien vers gallery.html
  └─ Lien vers stats.html

gallery.html
  ├─ Lien vers index.html
  └─ Lien vers stats.html

stats.html
  ├─ Lien vers index.html
  └─ Lien vers gallery.html
```

Chaque page a la même barre de navigation avec lien `active`.

---

## 💾 Données persistantes

Toutes les pages accèdent au même **localStorage.paniniGame** :

```javascript
{
  collection: ["id1", "id2", "id1"],  // Cartes obtenues
  lastDrawDate: "2026-08-02",         // Dernier tirage
  checksum: "abc123",                 // Validation
  version: "1.0"
}
```

**Avantage** : Collection synchronisée entre les 3 pages

---

## ✅ Checklist avant lancement

- [ ] Images compressées et dans le bon répertoire
- [ ] config.json validé (51 cartes ou nombre final)
- [ ] Tous les IDs sont UUID uniques
- [ ] Sections/subsections structurées dans `gallery`
- [ ] Testé sur Chrome, Firefox, Safari
- [ ] Testé sur mobile
- [ ] GitHub repo créé
- [ ] GitHub Pages activé
- [ ] URL communiquée au club

---

## 🐛 Debugging

Ouvrir Console (F12) :

```javascript
// Voir la collection
JSON.parse(localStorage.paniniGame)

// Voir la config
fetch('config.json').then(r => r.json()).then(c => console.log(c))

// Effacer tout
localStorage.clear()

// Logs
console.log('Message de l\'app')
```

---

## 📞 Points clés à retenir

🎲 **Tirage** :
- Graine quotidienne déterministe
- Même tirage pour tout le monde
- Impossible de tricher avec la date

🎴 **Flip** :
- 1 seconde de suspense
- Animation 0.6s cubic-bezier
- Délai 200ms entre cartes

🗂️ **Galerie** :
- Organisation par sections/subsections
- Filtrable par catégorie
- Modal au click

💾 **Persistance** :
- localStorage partagé
- Export/import JSON
- Consentement obligatoire

---

## 🚀 Tu es prêt !

Le prototype est **100% fonctionnel** avec :
- ✅ 3 pages HTML séparées
- ✅ 9 cartes de test avec tes données
- ✅ localStorage persistant
- ✅ Navigation fluide
- ✅ Responsive design
- ✅ Animations flip
- ✅ Galerie organisée
- ✅ Export/Import

**Prochaines étapes** :
1. Télécharger tous les fichiers depuis outputs/
2. Remplacer les images
3. Compléter config.json
4. Tester localement
5. Déployer sur GitHub Pages

Bonne chance ! 🏀

