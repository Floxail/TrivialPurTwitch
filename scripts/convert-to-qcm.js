/**
 * Script de conversion des questions à choix multiples vers le format QCM
 *
 * Usage: node scripts/convert-to-qcm.js
 */

const fs = require('fs');
const path = require('path');

// Chemin vers le fichier questions
const questionsPath = path.join(__dirname, '../public/questions/questions.json');

// Lire le fichier
const data = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// Compteurs
let convertedCount = 0;
let skippedCount = 0;
let alreadyQcmCount = 0;

// Banques d'options supplémentaires par contexte
const optionBanks = {
  // Personnes célèbres
  celebrities: ['Beyoncé', 'Rihanna', 'Madonna', 'Lady Gaga', 'Taylor Swift', 'Shakira', 'Adele'],
  actors: ['Tom Hanks', 'Leonardo DiCaprio', 'Meryl Streep', 'Denzel Washington', 'Julia Roberts', 'Brad Pitt', 'Jennifer Aniston'],
  politicians: ['Emmanuel Macron', 'Angela Merkel', 'Barack Obama', 'Margaret Thatcher', 'Winston Churchill'],

  // Lieux
  cities: ['Tokyo', 'Sydney', 'Le Caire', 'Buenos Aires', 'Moscou', 'Pékin', 'New Delhi', 'Rio de Janeiro', 'Berlin', 'Rome', 'Madrid'],
  countries: ['L\'Australie', 'Le Canada', 'Le Japon', 'Le Brésil', 'L\'Inde', 'La Chine', 'L\'Allemagne', 'L\'Italie'],
  frenchCities: ['Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg', 'Nice'],

  // Événements/Fêtes
  holidays: ['Noël', 'Pâques', 'Halloween', 'la Toussaint', 'la Pentecôte', 'l\'Assomption', 'la Saint-Nicolas'],

  // Arts & Culture
  magazines: ['Le Point', 'L\'Express', 'Le Figaro Magazine', 'Télérama', 'Challenges', 'Capital'],
  authors: ['Victor Hugo', 'Molière', 'Shakespeare', 'Balzac', 'Zola', 'Flaubert', 'Proust'],

  // Sciences
  scientists: ['Einstein', 'Newton', 'Darwin', 'Pasteur', 'Curie', 'Galilée', 'Tesla'],

  // Sports
  sports: ['le tennis', 'le golf', 'la natation', 'l\'athlétisme', 'le cyclisme', 'la boxe'],

  // Empires/Civilisations
  empires: ['le maya', 'le perse', 'le grec', 'le chinois', 'le mongol', 'l\'ottoman'],

  // Films Batman
  batmanMovies: ['Batman Begins', 'The Dark Knight', 'Batman Returns', 'Batman Forever'],

  // Frères Marx
  marxBrothers: ['Groucho', 'Chico', 'Zeppo', 'Gummo'],

  // Chanteuses françaises
  frenchSingers: ['Édith Piaf', 'Barbara', 'Dalida', 'France Gall', 'Françoise Hardy'],

  // Langues
  languages: ['le polonais', 'le hongrois', 'le finnois', 'le turc', 'l\'albanais'],

  // Gares
  trainStations: ['Paris-Gare de Lyon', 'Paris-Nord', 'Paris-Est', 'Paris-Montparnasse'],

  // Lettres
  letters: ['O', 'I', 'Q', 'S', 'Z', 'B', 'C'],

  // Pays monarchies
  monarchies: ['La Belgique', 'Les Pays-Bas', 'Le Danemark', 'La Norvège'],

  // Édifices
  buildings: ['Le Sacré-Cœur', 'Notre-Dame', 'Le Louvre', 'La Statue de la Liberté', 'Big Ben'],

  // Agences de renseignement
  agencies: ['Le FSB', 'Le Mossad', 'La DGSI', 'La NSA', 'Interpol'],

  // Inventions
  inventions: ['le four à micro-ondes', 'le mixeur', 'le grille-pain', 'la machine à pain'],

  // Sauces
  sauces: ['mayonnaise', 'ketchup', 'sauce soja', 'sauce barbecue'],

  // BD
  comicCharacters: ['Tintin', 'Spirou', 'Blake et Mortimer', 'Lucky Luke', 'Gaston Lagaffe'],

  // Séries TV
  tvShows: ['Friends', 'The Office', 'Seinfeld', 'How I Met Your Mother'],

  // Terrains de sport
  sportFields: ['football', 'tennis', 'rugby', 'hockey'],

  // Surnoms de villes
  cityNicknames: ['Venise du Nord', 'Ville Lumière', 'Big Apple', 'Ville Éternelle']
};

// Fonction pour mélanger un tableau
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Fonction pour trouver le meilleur pool d'options basé sur le contexte
function findBestPool(question, existingOptions) {
  const q = question.toLowerCase();
  const opts = existingOptions.map(o => o.toLowerCase()).join(' ');

  // Essayer de matcher le contexte
  if (q.includes('ambassadeur') || q.includes('nations unies') || opts.includes('jolie') || opts.includes('clooney')) {
    return optionBanks.celebrities;
  }
  if (q.includes('batman')) {
    return optionBanks.batmanMovies;
  }
  if (q.includes('marx')) {
    return optionBanks.marxBrothers;
  }
  if (q.includes('chanteuse') || q.includes('piaf')) {
    return optionBanks.frenchSingers;
  }
  if (q.includes('fête') || q.includes('saint-')) {
    return optionBanks.holidays;
  }
  if (q.includes('gare') || q.includes('train')) {
    return optionBanks.trainStations;
  }
  if (q.includes('lettre') || q.includes('plaque')) {
    return optionBanks.letters;
  }
  if (q.includes('monarchie') || q.includes('royaume')) {
    return optionBanks.monarchies;
  }
  if (q.includes('édifice') || q.includes('construit') || q.includes('exposition')) {
    return optionBanks.buildings;
  }
  if (q.includes('agence') || q.includes('renseignement') || q.includes('cia') || q.includes('mi6')) {
    return optionBanks.agencies;
  }
  if (q.includes('inventé') || q.includes('breveté') || q.includes('moulinex')) {
    return optionBanks.inventions;
  }
  if (q.includes('sauce') || q.includes('végane')) {
    return optionBanks.sauces;
  }
  if (q.includes('héros') || q.includes('bd') || q.includes('van hamme') || q.includes('bande dessinée')) {
    return optionBanks.comicCharacters;
  }
  if (q.includes('magazine') || q.includes('hebdomadaire')) {
    return optionBanks.magazines;
  }
  if (q.includes('langue') || q.includes('romane')) {
    return optionBanks.languages;
  }
  if (q.includes('empire') || opts.includes('inca') || opts.includes('aztèque')) {
    return optionBanks.empires;
  }
  if (q.includes('terrain') || (q.includes('grand') && opts.includes('basket'))) {
    return optionBanks.sportFields;
  }
  if (q.includes('surnom') || q.includes('venise')) {
    return optionBanks.cityNicknames;
  }
  if (q.includes('ville') || q.includes('paris')) {
    return optionBanks.cities;
  }
  if (q.includes('pays') || q.includes('continent')) {
    return optionBanks.countries;
  }

  // Fallback: essayer de créer une option similaire aux existantes
  return null;
}

// Fonction pour choisir une option supplémentaire cohérente
function getExtraOption(question, answer, existingOptions, category) {
  const pool = findBestPool(question, existingOptions);

  if (pool) {
    // Filtrer les options déjà utilisées
    const existingLower = existingOptions.map(o => o.toLowerCase());
    const answerLower = answer.toLowerCase();
    const available = pool.filter(o =>
      !existingLower.some(e => e.includes(o.toLowerCase()) || o.toLowerCase().includes(e)) &&
      !o.toLowerCase().includes(answerLower)
    );

    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
  }

  // Fallback intelligent basé sur le format des options existantes
  // Si les options commencent par un article, en créer une similaire
  const firstOption = existingOptions[0];
  if (firstOption.startsWith('l\'') || firstOption.startsWith('L\'')) {
    return 'l\'Indonésie';
  }
  if (firstOption.startsWith('le ') || firstOption.startsWith('Le ')) {
    return 'le Maroc';
  }
  if (firstOption.startsWith('la ') || firstOption.startsWith('La ')) {
    return 'la Belgique';
  }

  // Dernier recours
  return 'Aucun(e) des précédent(e)s';
}

// Pattern 1: Options avec tirets sur plusieurs lignes
function parseMultilineOptions(question) {
  const match = question.match(/^(.+?)[\s:]+\n-\s*(.+?)\n-\s*(.+?)(?:\n-\s*(.+?))?(?:\n-\s*(.+?))?$/s);
  if (match) {
    const options = [match[2], match[3]];
    if (match[4]) options.push(match[4].replace(/\?$/, '').trim());
    if (match[5]) options.push(match[5].replace(/\?$/, '').trim());
    return {
      cleanQuestion: match[1].trim() + ' ?',
      options: options.map(o => o.trim())
    };
  }
  return null;
}

// Pattern 2: "Lequel/Laquelle de ces X : A, B ou C ?"
function parseInlineOptions(question) {
  const match = question.match(/^(.+?)[\s:]+([^:,]+),\s*([^,]+?)(?:,\s*([^,]+?))?\s+ou\s+([^?]+)\s*\??$/i);
  if (match) {
    const options = [match[2].trim(), match[3].trim()];
    if (match[4]) options.push(match[4].trim());
    options.push(match[5].trim().replace(/\?$/, ''));
    return {
      cleanQuestion: match[1].trim() + ' ?',
      options
    };
  }
  return null;
}

// Pattern 3: Questions avec 4 options séparées par des virgules
function parseFourOptions(question) {
  const match = question.match(/^(.+?)[\s:]+([^:,]+),\s*([^,]+),\s*([^,]+),\s*([^?]+)\s*\??$/i);
  if (match) {
    return {
      cleanQuestion: match[1].trim() + ' ?',
      options: [match[2].trim(), match[3].trim(), match[4].trim(), match[5].trim().replace(/\?$/, '')]
    };
  }
  return null;
}

// Fonction principale de détection et conversion
function convertToQcm(q) {
  // Ignorer si déjà QCM
  if (q.questionType === 'qcm' && q.qcmOptions) {
    alreadyQcmCount++;
    return null;
  }

  const question = q.question;
  const answer = q.answer;

  // Vérifier si c'est une question à choix multiples
  const isMultipleChoice =
    /\b(lequel|laquelle|parmi ces|de ces)\b/i.test(question) &&
    (question.includes(':') || question.includes('\n-') || /,\s*.+\s+ou\s+/i.test(question));

  if (!isMultipleChoice) {
    return null;
  }

  // Essayer les différents parsers
  let parsed = parseMultilineOptions(question) ||
               parseInlineOptions(question) ||
               parseFourOptions(question);

  if (!parsed) {
    console.log(`⚠️ Pattern non reconnu: "${question.substring(0, 80)}..."`);
    skippedCount++;
    return null;
  }

  let { cleanQuestion, options } = parsed;

  // Nettoyer les options
  options = options.map(o => o.replace(/^\s*-\s*/, '').trim());

  // Trouver l'index de la bonne réponse (comparaison plus souple)
  let correctIndex = -1;
  const answerLower = answer.toLowerCase().trim();

  for (let i = 0; i < options.length; i++) {
    const optLower = options[i].toLowerCase().trim();
    // Match exact ou partiel
    if (optLower === answerLower ||
        optLower.includes(answerLower) ||
        answerLower.includes(optLower) ||
        // Gérer les articles
        optLower.replace(/^(l'|le |la |les )/, '') === answerLower.replace(/^(l'|le |la |les )/, '')) {
      correctIndex = i;
      break;
    }
  }

  if (correctIndex === -1) {
    console.log(`⚠️ Réponse "${answer}" non trouvée dans les options: ${options.join(', ')}`);
    console.log(`   Question: "${question.substring(0, 60)}..."`);
    skippedCount++;
    return null;
  }

  // Ajouter une 4ème option si nécessaire
  if (options.length < 4) {
    const extra = getExtraOption(question, answer, options, q.category);
    options.push(extra);
  }

  // S'assurer qu'on a exactement 4 options
  options = options.slice(0, 4);

  // Mélanger les options et trouver le nouvel index
  const correctAnswer = options[correctIndex];
  const shuffledOptions = shuffle(options);
  const newCorrectIndex = shuffledOptions.findIndex(o => o === correctAnswer);

  convertedCount++;
  console.log(`✅ Converti: "${cleanQuestion.substring(0, 50)}..." → [${shuffledOptions.join(', ')}]`);

  return {
    ...q,
    question: cleanQuestion,
    questionType: 'qcm',
    qcmOptions: shuffledOptions,
    qcmCorrectIndex: newCorrectIndex
  };
}

// Traiter toutes les questions
console.log('🔄 Analyse des questions...\n');

const updatedQuestions = data.questions.map(q => {
  const converted = convertToQcm(q);
  return converted || q;
});

// Mettre à jour les données
data.questions = updatedQuestions;
data.exportDate = new Date().toISOString();

// Sauvegarder
fs.writeFileSync(questionsPath, JSON.stringify(data, null, 2), 'utf8');

console.log('\n📊 Résumé:');
console.log(`   ✅ Questions converties: ${convertedCount}`);
console.log(`   ⏭️ Questions ignorées (pattern non reconnu): ${skippedCount}`);
console.log(`   📋 Déjà en format QCM: ${alreadyQcmCount}`);
console.log(`\n✅ Fichier sauvegardé: ${questionsPath}`);
