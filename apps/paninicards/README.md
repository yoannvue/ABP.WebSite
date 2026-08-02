# 🏀 Collection Panini ABP Basketball - Prototype

Un jeu de collection de cartes en temps réel pour le club ABP Basketball, construit en **HTML/CSS/JavaScript pur** et déployable sur **GitHub Pages**.

## 📋 Vue d'ensemble

**Prototype fonctionnel** avec :
- ✅ 10 cartes de test (4 équipes, 4 coachs, 2 bureau)
- ✅ Tirage quotidien aléatoire
- ✅ Animations flip 3D avec délai
- ✅ Galerie complète organisée par catégories
- ✅ Stats de collection
- ✅ localStorage persistant
- ✅ Export/Import JSON
- ✅ Entièrement modulaire (HTML/CSS/JS séparés)

## 🚀 Démarrage rapide

### 1. **Tester localement**

```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (http-server)
npx http-server

# Puis ouvrir : http://localhost:8000
```

### 2. **Déployer sur GitHub Pages**

```bash
# Créer un repo GitHub (ex: panini-abp)
# Cloner le projet
git clone https://github.com/TON_USER/panini-abp.git
cd panini-abp

# Copier les fichiers du prototype
# Commit & Push
git add .
git commit -m "Prototype Panini ABP"
git push origin main

# Activer GitHub Pages :
# GitHub → Settings → Pages → Source: main branch → Save
# Accès : https://TON_USER.github.io/panini-abp
```

## 📁 Structure du projet

```
prototype-panini/
├── index.html           # HTML pur
├── css/
│   └── style.css       # Tous les styles
├── js/
│   ├── app.js          # Point d'entrée
│   ├── utils.js        # Fonctions pures
│   ├── storage.js      # localStorage wrapper
│   ├── game.js         # Logique du jeu
│   ├── flip-card.js    # Classe FlipCard
│   ├── ui.js           # Affichage
│   └── gallery.js      # Galerie
├── config.json         # Configuration + cartes
└── .gitignore
```

## 🎮 Utilisation

### Tirage quotidien
1. Accepter le consentement localStorage
2. Cliquer sur **"🎲 Tirer une carte"**
3. Les cartes apparaissent (verso visible)
4. Cliquer sur **"🎲 Révéler les cartes"** pour flip
5. Attendre 1 seconde (suspense !)
6. Les cartes se dévoilent une par une

### Galerie
- Voir toutes les cartes
- Filtrer par catégorie
- Cliquer sur une carte pour plus de détails
- ✓ vert = carte possédée

### Ma collection
- Stats : total, uniques, doublons, %
- Cartes obtenues avec nombre de doublons
- Progression visuelle

### Actions
- 📥 **Télécharger** : Sauvegarder votre collection en JSON
- 📤 **Importer** : Charger une collection depuis un fichier JSON
- 🔄 **Réinitialiser** : Effacer tout (pour tester)

## ⚙️ Configuration

Modifier `config.json` pour :
- Ajouter/modifier des cartes
- Changer les poids de rareté
- Ajuster la phase d'augmentation

### Format d'une carte

```json
{
  "id": "unique-uuid",
  "name": "Nom court",
  "category": "team|staff|bureau|president",
  "section": "Équipes|Encadrement|Bureau",
  "subsection": "U15 Garçons",
  "weight": 50,
  "displayName": "Nom d'affichage complet",
  "images": [
    { "side": "left|right|full", "url": "lien-image" }
  ]
}
```

## 🔒 Sécurité

- **UUIDs** : IDs impossibles à deviner
- **Checksum** : Détecte les altérations naïves
- **Validation** : Vérifie que les cartes existent
- **localStorage** : Aucun consentement RGPD obligatoire*

*Si tu n'utilises pas de tracking publicitaire.

## 🎴 Système de tirage

- **Seed quotidien** : Tout le monde tire la même carte le même jour
- **Pondération** : Équipes communes (50), Coachs rares (10), Bureau très rare (3), Président exceptionnel (1)
- **Pas de triche** : Changer la date système ne change rien

## 🎨 Personnalisation

### Couleurs
Modifier `:root` dans `css/style.css` :
```css
--primary-color: #667eea;
--secondary-color: #764ba2;
--success-color: #22c55e;
```

### Animations
- Flip : `transition: 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)`
- Délai : 1000ms avant flip + 200ms entre cartes

## 📊 Statistiques disponibles

- Total cartes obtenues
- Cartes uniques
- Doublons
- % de collection
- Liste des cartes manquantes

## 🐛 Débogage

Ouvrir la Console (F12) pour :
```javascript
// Afficher la config
JSON.parse(localStorage.getItem('paniniGame'))

// Effacer tout
localStorage.clear()

// Voir les logs
console.log('Messages de l\'app')
```

## 📱 Responsive

- ✅ Desktop (1200px+)
- ✅ Tablette (768px+)
- ✅ Mobile (< 480px)

## 🚢 Passage en production

1. **Remplacer les images placeholder** par les vraies photos
2. **Générer 51 UUIDs** (ou le nombre final de cartes)
3. **Remplir config.json** avec toutes les cartes
4. **Tester** la galerie et les stats
5. **Déployer** sur GitHub Pages

## ✅ Checklist avant lancement

- [ ] 51 cartes configurées dans `config.json`
- [ ] 51 images en place (ou URLs externes)
- [ ] UUIDs générés et validés
- [ ] Poids de rareté ajustés
- [ ] Dates de début/fin mises à jour
- [ ] Testé sur mobile
- [ ] GitHub Pages activé
- [ ] URL partageée avec le club

## 🎯 Fonctionnalités futures

- Animations supplémentaires (scratch, particle effects)
- Classement des joueurs (sans tracking)
- Événements spéciaux (double tirage, cartes bonus)
- Partage sur réseaux sociaux
- Dark mode

## 📝 Notes de développement

- **Pas de dépendances externes** : JS pur, CSS pur
- **Modules ES6** : Import/Export natifs
- **localStorage uniquement** : Pas de serveur requis
- **GitHub Pages compatible** : Fichiers statiques seulement

## 🤝 Support

Pour des questions sur le code ou des améliorations, voir la doc complète : `panini-basketball.md`

---

**Prototype créé le 2026-08-02** | **ABP Basketball** 🏀
