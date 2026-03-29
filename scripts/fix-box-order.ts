/**
 * Script pour réordonner les questions d'une boîte ordonnée.
 *
 * Usage:
 *   npx tsx scripts/fix-box-order.ts <action> [options]
 *
 * Actions:
 *   list <boxName>                         — Affiche les questions dans l'ordre actuel
 *   fix-pilotes <baseUrl> <twitchToken>    — Réordonne "Debout les Grou-Grou n°19 Les pilotes partie 2"
 *   reorder <boxName> <baseUrl> <twitchToken> <id1,id2,id3,...>  — Réordonne avec les IDs fournis
 */

// L'ordre correct des questions de "Pilotes P2" basé sur le fichier TXT
const PILOTES_ORDER = [
  "Dans la bande à Picsou (Ducks tales), comment s'appelle le pilote de l'oncle Picsou",
  "Dans le domaine des séries, qu'est ce qu'un épisode pilote",
  "l'épisode pilote est il toujours le premier épisode diffusé",
  "Mais du coup, est ce que dire que dire que le premier épisode d'une série est un pilote est une erreur",
  "Dans le premier pilote de la série Star Trek, comment s'appelle le conseiller scientifique de l'équipage du vaisseau Enterprise",
  "Dans l'univers du DC Comics, quel est le métier de Hal Jordan (autre que Green Lantern)",
  "Dans le deuxième pilote de la série Star Trek, comment s'appelle le conseiller scientifique de l'équipage du vaisseau Enterprise",
  "Dans le premier épisode de la série Bob l'éponge",
  "Dans le premier épisode diffusé de Hé Arnold! en qui est déguisé Arnold",
  "Dans la série Denver, le dernier dinosaure, comment le groupe choisi le nom du dinosaure",
  "Dans le tous premier épisode de gravity Fall, que trouve Dipper par hasard dans la forêt",
  "quel est le synospis de la première partie du pilote de Gumball",
  "Dans le pilote de la bande à Picsou (1987), pourquoi Donald confie les neveux à Picsou",
  "De quoi parle l'épisode pilote de la série \"il était une fois la vie",
  "Comment s'appelle le magazine hebdomadaire de bande dessinée français publié d'octobre 1959 à octobre 1989",
  "en quel année",  // "en quel annees est sorti le premier épisode de la série animée Men In black"
  "Dans le premier épisode de la série animée Pokémon, de quel Pokémon Sacha",
  "Qu'est ce qu'un épisode Backdoor",
  "Dans le vrai Pilote de la série Inspecteur Gadget",
  "dernière question, combien de fois la blague du pilote d'avion",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchQuestion(dbQuestion: string, patterns: string[]): number {
  const norm = normalize(dbQuestion);
  for (let i = 0; i < patterns.length; i++) {
    const patNorm = normalize(patterns[i]);
    if (norm.includes(patNorm) || patNorm.includes(norm.substring(0, 40))) {
      return i;
    }
  }
  return -1;
}

async function fetchQuestions(baseUrl: string, boxName: string): Promise<any[]> {
  const base = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
  const url = `${base}/api/questions?boxName=${encodeURIComponent(boxName)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TrivialPurTwitch-Script/1.0' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${url} → ${res.status} ${body.substring(0, 200)}`);
  }
  const data = await res.json();
  return data.questions || [];
}

async function reorderBox(baseUrl: string, token: string, boxName: string, questionIds: string[]) {
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/reorder-box`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ boxName, questionIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`POST reorder-box → ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function main() {
  const [action, ...args] = process.argv.slice(2);

  if (action === 'list') {
    const boxName = args[0];
    if (!boxName) { console.error('Usage: list <boxName>'); process.exit(1); }

    // Utilise l'URL locale par défaut
    const baseUrl = args[1] || 'http://localhost:3000';
    const questions = await fetchQuestions(baseUrl, boxName);

    console.log(`\n📦 Boîte: "${boxName}" — ${questions.length} questions\n`);
    questions.forEach((q: any, i: number) => {
      console.log(`  ${String(i + 1).padStart(2)}. [${q.id}]`);
      console.log(`      ${q.question.substring(0, 80)}${q.question.length > 80 ? '...' : ''}`);
      console.log(`      created_at: ${q.createdAt || '(null)'}`);
    });
    return;
  }

  if (action === 'fix-pilotes') {
    const baseUrl = args[0];
    const token = args[1];
    if (!baseUrl || !token) {
      console.error('Usage: fix-pilotes <baseUrl> <twitchToken>');
      process.exit(1);
    }

    const boxName = 'Debout les Grou-Grou n°19 Les pilotes partie 2';
    const questions = await fetchQuestions(baseUrl, boxName);

    console.log(`\n📦 Boîte: "${boxName}" — ${questions.length} questions\n`);

    // Matcher chaque question DB avec l'ordre du TXT
    const matched: { idx: number; question: any }[] = [];
    const unmatched: any[] = [];

    for (const q of questions) {
      const idx = matchQuestion(q.question, PILOTES_ORDER);
      if (idx >= 0) {
        matched.push({ idx, question: q });
      } else {
        unmatched.push(q);
        console.warn(`  ⚠️ Non matchée: "${q.question.substring(0, 60)}..."`);
      }
    }

    // Trier par l'index dans le TXT
    matched.sort((a, b) => a.idx - b.idx);

    // Les non-matchées vont à la fin
    const orderedIds = [...matched.map(m => m.question.id), ...unmatched.map(q => q.id)];

    console.log('\n📋 Ordre proposé:');
    matched.forEach((m, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. [TXT #${m.idx + 1}] ${m.question.question.substring(0, 70)}...`);
    });
    if (unmatched.length > 0) {
      console.log(`\n  + ${unmatched.length} question(s) non matchée(s) ajoutée(s) à la fin`);
    }

    console.log(`\n🔄 Envoi de la réorganisation...`);
    const result = await reorderBox(baseUrl, token, boxName, orderedIds);
    console.log(`✅ ${result.message}`);
    return;
  }

  if (action === 'reorder') {
    const [boxName, baseUrl, token, idsStr] = args;
    if (!boxName || !baseUrl || !token || !idsStr) {
      console.error('Usage: reorder <boxName> <baseUrl> <twitchToken> <id1,id2,...>');
      process.exit(1);
    }
    const ids = idsStr.split(',');
    const result = await reorderBox(baseUrl, token, boxName, ids);
    console.log(`✅ ${result.message}`);
    return;
  }

  console.log(`
Usage:
  npx tsx scripts/fix-box-order.ts list <boxName> [baseUrl]
  npx tsx scripts/fix-box-order.ts fix-pilotes <baseUrl> <twitchToken>
  npx tsx scripts/fix-box-order.ts reorder <boxName> <baseUrl> <twitchToken> <id1,id2,...>
  `);
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
