# 🔄 Synchronisation GitHub

Guide pour utiliser GitHub comme base de données centralisée pour vos questions.

---

## 🎯 Concept

Au lieu de stocker vos questions uniquement dans le navigateur (localStorage), elles sont **centralisées dans GitHub**.

**Avantages :**
- ✅ **Versionné** : Historique complet avec Git
- ✅ **Synchronisé** : Mêmes questions en local et sur GitHub Pages
- ✅ **Backup automatique** : GitHub = sauvegarde gratuite
- ✅ **Collaboration** : Plusieurs personnes peuvent ajouter des questions
- ✅ **Multi-fichiers** : Organisation claire par thème/boîte

---

## 📁 Structure des fichiers

```
public/data/
├── index.json          ← Liste des fichiers à charger
├── geographie.json     ← Questions de géographie
├── histoire.json       ← Questions d'histoire
├── cinema.json         ← Questions de cinéma
└── sports.json         ← Questions de sports
```

### index.json (obligatoire)

Liste tous les fichiers de questions à charger :

```json
{
  "version": "2.0",
  "lastUpdate": "2025-12-30T12:00:00.000Z",
  "files": [
    "geographie.json",
    "histoire.json",
    "cinema.json",
    "sports.json"
  ]
}
```

### geographie.json (exemple)

Contient les questions d'une boîte :

```json
{
  "boxName": "Géographie",
  "description": "Questions de géographie mondiale",
  "questions": [
    {
      "id": "geo_1_1",
      "category": 0,
      "question": "Quelle est la capitale de la France ?",
      "answer": "Paris",
      "boxName": "Géographie",
      "cardNumber": 1,
      "difficulty": "easy"
    }
  ]
}
```

---

## 🚀 Installation

Le système est **déjà configuré** dans l'application ! Il charge automatiquement les questions depuis `public/data/`.

### Vérification

Au démarrage de l'app, la console affiche :

```
🔄 Chargement depuis GitHub...
📋 Index chargé : 4 fichiers trouvés
  ✅ geographie.json : 6 questions
  ✅ histoire.json : 6 questions
  ✅ cinema.json : 6 questions
  ✅ sports.json : 6 questions
✅ Total : 24 questions chargées depuis 4 fichiers
```

---

## ➕ Ajouter un nouveau thème

### Méthode 1 : Via l'interface (recommandé)

```
1. Créez vos questions dans l'interface de gestion
   ↓
2. Exportez le JSON
   ↓
3. Copiez les questions dans un nouveau fichier (ex: sciences.json)
   ↓
4. Ajoutez "sciences.json" dans index.json
   ↓
5. Commit + Push
   ↓
6. npm run deploy
```

### Méthode 2 : Directement dans les fichiers

**1. Créer le fichier sciences.json :**

```json
{
  "boxName": "Sciences",
  "description": "Questions de sciences",
  "questions": [
    {
      "id": "sci_1_1",
      "category": 4,
      "question": "Quelle est la formule chimique de l'eau ?",
      "answer": "H2O",
      "boxName": "Sciences",
      "cardNumber": 1,
      "difficulty": "easy"
    }
  ]
}
```

**2. Ajouter dans index.json :**

```json
{
  "version": "2.0",
  "lastUpdate": "2025-12-30T12:00:00.000Z",
  "files": [
    "geographie.json",
    "histoire.json",
    "cinema.json",
    "sports.json",
    "sciences.json"  ← AJOUTER ICI
  ]
}
```

**3. Déployer :**

```bash
git add public/data/
git commit -m "Add sciences questions"
git push origin main
npm run deploy
```

**C'est tout ! Les nouvelles questions seront chargées automatiquement ! 🎉**

---

## 🔄 Workflow de mise à jour

### Option A : Interface → GitHub

```
1. Ajoutez des questions dans l'interface locale
   ↓
2. Exportez le JSON (bouton "Exporter JSON")
   ↓
3. Séparez les questions par thème
   ↓
4. Copiez dans les fichiers correspondants dans public/data/
   ↓
5. git add public/data/
6. git commit -m "Update questions"
7. git push && npm run deploy
```

### Option B : GitHub → Interface

```
1. Modifiez directement les fichiers dans public/data/
   ↓
2. git commit -m "Update questions"
3. git push && npm run deploy
   ↓
4. L'app charge automatiquement les nouvelles questions
   ↓
5. (Optionnel) Cliquez "Sync GitHub" dans l'interface
```

### Option C : OCR → GitHub

```
1. Utilisez gemini-ocr-trivial.html pour scanner une carte
   ↓
2. Téléchargez le JSON généré
   ↓
3. Copiez les questions dans le bon fichier (ex: cinema.json)
   ↓
4. git commit -m "Add scanned questions"
5. git push && npm run deploy
```

---

## 📊 Synchronisation automatique

L'app vérifie GitHub **toutes les 24 heures**.

Si de nouvelles questions sont disponibles, elles sont **automatiquement chargées** et fusionnées avec les questions locales.

### Synchronisation manuelle

Cliquez sur le bouton **"Sync GitHub"** dans l'interface de gestion des questions.

---

## 🔍 Gestion des conflits

**Si une question existe en local ET sur GitHub (même ID) :**
→ La version **locale** est prioritaire

**Si vous voulez écraser avec GitHub :**
1. Supprimez localStorage : `localStorage.removeItem('quiz_questions_storage_v2')`
2. Rechargez la page
3. Les questions GitHub seront rechargées

---

## 📋 Organisation recommandée

### Par boîte physique

```
public/data/
├── index.json
├── boite-classique.json     ← Boîte Trivial Pursuit classique
├── boite-genius.json         ← Boîte Genius
├── boite-famille.json        ← Boîte Famille
└── boite-custom.json         ← Vos propres questions
```

### Par thème

```
public/data/
├── index.json
├── geographie.json
├── histoire.json
├── sciences.json
├── cinema.json
├── musique.json
├── sports.json
└── culture-generale.json
```

### Par difficulté

```
public/data/
├── index.json
├── facile.json
├── moyen.json
└── difficile.json
```

**Choisissez l'organisation qui vous convient le mieux !**

---

## 🎨 Format des fichiers

### Structure minimale

```json
{
  "boxName": "NomDeLaBoite",
  "questions": [
    {
      "id": "unique_id",
      "category": 0,
      "question": "Votre question ?",
      "answer": "La réponse",
      "boxName": "NomDeLaBoite",
      "cardNumber": 1
    }
  ]
}
```

### Champs optionnels

```json
{
  "boxName": "NomDeLaBoite",
  "description": "Description de la boîte",
  "questions": [
    {
      "id": "unique_id",
      "category": 0,
      "question": "Votre question ?",
      "answer": "La réponse",
      "alternativeAnswers": ["autre réponse"],  ← Optionnel
      "difficulty": "easy",                      ← Optionnel
      "boxName": "NomDeLaBoite",
      "cardNumber": 1
    }
  ]
}
```

---

## 🐛 Dépannage

### Les questions ne se chargent pas

**Vérifications :**

1. **Fichiers présents ?**
   ```bash
   ls public/data/
   # Vous devriez voir index.json et vos fichiers
   ```

2. **index.json valide ?**
   - Allez sur https://jsonlint.com/
   - Copiez/collez votre index.json
   - Vérifiez qu'il n'y a pas d'erreurs

3. **Console navigateur (F12) :**
   ```
   🔄 Chargement depuis GitHub...
   ❌ Erreur lors du chargement de l'index
   ```

4. **Fichiers déployés ?**
   - Vérifiez que vous avez bien fait `npm run deploy`
   - Vérifiez sur GitHub que les fichiers sont dans la branche `gh-pages`

### Erreur "Aucun fichier dans l'index"

**Cause :** `index.json` manquant ou mal formaté

**Solution :**
```bash
# Vérifier que index.json existe
ls public/data/index.json

# Vérifier le contenu
cat public/data/index.json
```

### Erreur "❌ Erreur geographie.json"

**Cause :** Fichier JSON invalide (virgule manquante, etc.)

**Solution :**
1. Copiez le contenu du fichier
2. Allez sur https://jsonlint.com/
3. Validez le JSON
4. Corrigez les erreurs

---

## 🎯 Commandes Git utiles

```bash
# Ajouter tous les fichiers de data/
git add public/data/

# Commit
git commit -m "Update questions: Add cinema theme"

# Push + Deploy
git push origin main && npm run deploy

# Voir l'historique
git log --oneline public/data/

# Revenir à une version précédente
git checkout <commit-hash> public/data/geographie.json
```

---

## 🎉 C'est configuré !

Vos questions sont maintenant centralisées sur GitHub ! 🔄

**Pour ajouter des questions :**
1. Modifiez les fichiers dans `public/data/`
2. `git commit && git push && npm run deploy`
3. Les questions sont automatiquement chargées !
