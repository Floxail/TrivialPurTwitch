# 📦 Utiliser GitHub comme Base de Données

Ce projet utilise GitHub comme système de stockage pour les questions du quiz. Cela permet de :
- Centraliser les questions dans un repository
- Synchroniser automatiquement les nouvelles questions
- Partager facilement les questions entre différents utilisateurs
- Versionner les modifications des questions

## 🔧 Configuration

### 1. Structure des fichiers

Les questions sont stockées dans le fichier :
```
public/questions/questions.json
```

### 2. Format du fichier JSON

Le fichier `questions.json` doit respecter le format suivant :

```json
{
  "version": "2.0",
  "exportDate": "2025-12-30T12:00:00.000Z",
  "boxes": [
    {
      "name": "Cinéma 91",
      "cardNumbers": [1, 2, 3],
      "totalQuestions": 18
    }
  ],
  "questions": [
    {
      "id": "unique-id-123",
      "category": 0,
      "question": "Quelle est la capitale de la France ?",
      "answer": "Paris",
      "alternativeAnswers": ["paris"],
      "boxName": "Cinéma 91",
      "cardNumber": 1,
      "difficulty": "easy"
    }
  ]
}
```

### 3. Catégories disponibles

Les catégories correspondent au Trivial Pursuit standard :
- `0` : Géographie (Bleu)
- `1` : Divertissement (Rose)
- `2` : Histoire (Jaune)
- `3` : Arts (Marron)
- `4` : Science (Vert)
- `5` : Sports (Orange)

## 📥 Utilisation

### Synchroniser depuis GitHub

1. Ouvrez le **Gestionnaire de Questions** dans l'application
2. Cliquez sur le bouton **"Sync GitHub"** dans la barre d'actions
3. L'application va :
   - Charger le fichier `questions.json` depuis le repository
   - Fusionner les questions avec celles déjà présentes en local
   - Éviter les doublons (basé sur l'ID de la question)
   - Afficher un message de succès ou d'erreur

### Comportement de la synchronisation

- **Fusion intelligente** : Les questions GitHub sont fusionnées avec les questions locales
- **Pas de doublons** : Si une question existe déjà (même ID), elle n'est pas ajoutée
- **Conservation des données locales** : Vos questions locales ne sont jamais écrasées
- **Mise à jour automatique** : Un paramètre `?t=timestamp` évite le cache du navigateur

## 🚀 Workflow recommandé

### Pour les administrateurs

1. **Créer/Modifier des questions** dans le gestionnaire
2. **Exporter en JSON** via le bouton "Exporter JSON"
3. **Remplacer** le contenu de `public/questions/questions.json`
4. **Commit & Push** sur GitHub
5. Les utilisateurs peuvent maintenant **synchroniser** pour récupérer les nouvelles questions

### Pour les utilisateurs

1. **Ouvrir** l'application
2. **Cliquer** sur "Sync GitHub" régulièrement
3. Les nouvelles questions sont automatiquement ajoutées

## 🔄 Déploiement avec GitHub Pages

Lorsque vous déployez l'application sur GitHub Pages :

1. Le fichier `questions.json` est accessible à l'URL :
   ```
   https://votre-username.github.io/votre-repo/questions/questions.json
   ```

2. L'application charge automatiquement depuis cette URL

3. Chaque fois que vous modifiez `questions.json` et que vous pushez :
   - GitHub Pages se met à jour automatiquement
   - Les utilisateurs peuvent synchroniser pour récupérer les changements

## 🛠️ Dépannage

### La synchronisation échoue

**Vérifiez que :**
- Le fichier `public/questions/questions.json` existe
- Le JSON est valide (utilisez un validateur JSON)
- Le serveur web est démarré correctement
- Pas de problème CORS (Cross-Origin Resource Sharing)

### Questions en doublon

Utilisez le bouton **"Vérifier doublons"** pour détecter et supprimer les questions dupliquées.

### Format incompatible

Si vous avez des questions au format v1.0 (ancien format avec `trivialBox`), elles seront automatiquement converties au format v2.0 lors de l'import.

## 💡 Conseils

- **Sauvegardez régulièrement** : Utilisez "Exporter JSON" pour créer des backups
- **Testez localement** : Avant de pousser sur GitHub, testez la synchronisation en local
- **Versionnez** : Gardez un historique des modifications dans Git
- **Documentez** : Ajoutez des commentaires dans vos exports pour tracer les changements

## 📝 API Reference

### `loadQuestionsFromGitHub()`

Charge les questions depuis le fichier hébergé.

**Retourne :** `Promise<any>` - Les données JSON ou `null` en cas d'erreur

### `mergeQuestionsFromGitHub(githubData, localQuestions)`

Fusionne les questions GitHub avec les questions locales.

**Paramètres :**
- `githubData` : Données chargées depuis GitHub
- `localQuestions` : Questions déjà présentes en localStorage

**Retourne :** `Question[]` - Liste fusionnée sans doublons
