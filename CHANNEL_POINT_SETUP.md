# 🎁 Configuration des Récompenses de Points de Chaîne

Guide pour configurer les récompenses de points de chaîne Twitch pour TrivialQuiz.

---

## 📋 Récompenses à créer

Vous devez créer **deux récompenses personnalisées** sur votre dashboard Twitch.

### 1. Quiz Carte (1000 points)

- **Nom :** `Quiz Carte` *(exactement comme ça)*
- **Coût :** 1000 points *(ou à votre choix)*
- **Description :** "Lance un quiz de 6 questions (1 par catégorie) depuis une boîte. Entrez le nom de la boîte (ex: Géographie)"
- **Demander au spectateur de saisir du texte :** ✅ **OUI**
- **Image :** 🎲 *(optionnel)*

### 2. Quiz Personnalisé (1500 points)

- **Nom :** `Quiz Personnalisé` *(exactement comme ça)*
- **Coût :** 1500 points *(ou à votre choix)*
- **Description :** "Lance un quiz avec le nombre de questions de votre choix (5-20). Entrez un nombre (ex: 10)"
- **Demander au spectateur de saisir du texte :** ✅ **OUI**
- **Image :** 🎯 *(optionnel)*

---

## 🔧 Étapes de configuration

### 1. Accéder au dashboard Twitch

1. Allez sur https://dashboard.twitch.tv/
2. Cliquez sur **Préférences de chaîne** (dans le menu de gauche)
3. Cliquez sur **Récompenses de points de chaîne**

### 2. Créer la première récompense

1. Cliquez sur **Ajouter une nouvelle récompense personnalisée**
2. Remplissez les champs comme ci-dessus ("Quiz Carte")
3. **IMPORTANT :** Cochez "Demander au spectateur de saisir du texte"
4. Cliquez sur **Enregistrer**

### 3. Créer la deuxième récompense

1. Cliquez à nouveau sur **Ajouter une nouvelle récompense personnalisée**
2. Remplissez les champs comme ci-dessus ("Quiz Personnalisé")
3. **IMPORTANT :** Cochez "Demander au spectateur de saisir du texte"
4. Cliquez sur **Enregistrer**

---

## ⚠️ Important

### Les noms doivent être exacts

Les noms `Quiz Carte` et `Quiz Personnalisé` doivent être **exactement** comme indiqué (avec les majuscules et les accents).

Si vous voulez changer les noms, vous devrez aussi les modifier dans le code :

**Fichier à modifier :** `src/services/channel-points-service.ts`

```typescript
export const REWARD_CONFIGS = {
  card: {
    rewardTitle: 'Quiz Carte',  // ← Changez ici
    rewardCost: 1000,
  },
  quiz: {
    rewardTitle: 'Quiz Personnalisé',  // ← Changez ici
    rewardCost: 1500,
  },
};
```

---

## 🎮 Utilisation

### Pour les spectateurs

**Mode Carte :**
```
1. Cliquer sur "Quiz Carte" dans les récompenses
2. Entrer le nom d'une boîte (ex: "Géographie")
3. Valider
→ Le quiz démarre avec 6 questions de géographie
```

**Mode Personnalisé :**
```
1. Cliquer sur "Quiz Personnalisé" dans les récompenses
2. Entrer un nombre entre 5 et 20 (ex: "10")
3. Valider
→ Le quiz démarre avec 10 questions aléatoires
```

### Commande de test (streamer uniquement)

En tant que streamer, vous pouvez tester sans dépenser de points :

```
!quiz carte Géographie
!quiz 10
```

⚠️ Cette commande ne fonctionne QUE pour vous (le streamer).

---

## 🔍 Validation

### Mode Carte

**Format attendu :** Nom de la boîte (texte)

**Exemples valides :**
- `Géographie`
- `Histoire`
- `Cinéma`

**Vérifications :**
- La boîte doit exister dans votre base de données
- La boîte doit avoir au moins 6 questions (1 par catégorie)

**Messages d'erreur :**
```
❌ Boîte "XYZ" non trouvée. Boîtes disponibles: Géographie, Histoire
❌ Pas assez de questions dans la boîte "Géographie" (6 requises)
```

### Mode Personnalisé

**Format attendu :** Un nombre entre 5 et 20

**Exemples valides :**
- `5`
- `10`
- `15`
- `20`

**Exemples invalides :**
- `3` (trop petit)
- `25` (trop grand)
- `abc` (pas un nombre)

**Messages d'erreur :**
```
❌ Nombre de questions invalide (doit être entre 5 et 20)
❌ Pas assez de questions disponibles (25 dans la base, 30 demandées)
```

---

## 🎨 Personnalisation

### Changer les coûts

**Dans le dashboard Twitch :**
- Modifiez le coût directement dans les récompenses

**ET dans le code :**

**Fichier :** `src/services/channel-points-service.ts`

```typescript
export const REWARD_CONFIGS = {
  card: {
    rewardCost: 1000,  // ← Changez ici
  },
  quiz: {
    rewardCost: 1500,  // ← Changez ici
  },
};
```

### Changer les limites de questions (mode personnalisé)

**Fichier :** `src/services/channel-points-service.ts`

```typescript
// Ligne ~60
if (isNaN(num) || num < 5 || num > 20) {  // ← Changez 5 et 20
  return null;
}
```

---

## 📊 Messages dans le chat

### Succès

```
🎲 UserName a lancé un quiz "Géographie" ! Bonne chance à tous !
🎯 UserName a lancé un quiz de 10 questions ! Let's go !
```

### Erreurs

```
❌ Boîte "XYZ" non trouvée. Boîtes disponibles: Géographie, Histoire
❌ Nombre de questions invalide (doit être entre 5 et 20)
```

---

## 🐛 Dépannage

### Les redemptions ne sont pas détectées

**Problème :** L'API IRC de Twitch ne supporte pas les redemptions directement.

**Solution actuelle :** Utilisez la commande `!quiz` pour tester.

**Solution future :** Implémenter EventSub (nécessite un backend Node.js).

### La boîte n'est pas trouvée

**Vérifications :**
1. La boîte existe dans la base de données ?
2. Le nom est exact (casse comprise) ?
3. Elle a au moins 6 questions (1 par catégorie) ?

**Debug :**
Ouvrez la console navigateur (F12) et tapez :
```javascript
console.log('Boîtes disponibles:', quizStore.boxes.map(b => b.name));
```

---

## 🎉 C'est prêt !

Une fois configuré, vos spectateurs peuvent racheter des quiz avec leurs points de chaîne ! 🎁
