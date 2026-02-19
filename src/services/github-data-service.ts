// Service pour charger les questions depuis l'API Turso (source de vérité unique)
//
// Architecture : 1 Vercel + 1 Turso DB partagée entre tous les streamers
// Priorité 1 : API Turso (/api/questions)
// Priorité 2 : Build local (filet de sécurité si API totalement down)
// Priorité 3 : Cache localStorage (géré automatiquement par Zustand persist)

export const loadQuestionsFromAPI = async (): Promise<any> => {
  try {
    const response = await fetch(`/api/questions?t=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Questions chargées depuis la BD Turso (${data.questions.length})`);
      return data;
    }
  } catch (apiError) {
    console.warn('⚠️ API Turso indisponible, fallback vers build local', apiError);
  }

  // Fallback d'urgence : build local bundlé
  try {
    const response = await fetch(
      `${process.env.PUBLIC_URL}/questions/questions.json?t=${Date.now()}`
    );
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Questions chargées depuis build local (urgence)');
      return data;
    }
  } catch (localError) {
    console.error('❌ Build local inaccessible:', localError);
  }

  return null;
};

// Fusionner les questions BD avec les questions locales (custom par navigateur)
export const mergeQuestionsFromDB = (
  dbData: any,
  localQuestions: any[],
  previousDBIds?: Set<string>
): any[] => {
  if (!dbData || !dbData.questions) {
    return localQuestions;
  }

  const dbQuestions = dbData.questions;
  const currentDBIds = new Set(dbQuestions.map((q: any) => q.id));

  // Questions locales = questions qui n'ont JAMAIS été dans la BD
  // (custom privées du streamer, non partagées)
  let localOnlyQuestions;

  if (previousDBIds) {
    localOnlyQuestions = localQuestions.filter(q =>
      !currentDBIds.has(q.id) && !previousDBIds.has(q.id)
    );
  } else {
    localOnlyQuestions = localQuestions.filter(q => !currentDBIds.has(q.id));
  }

  console.log(`🔄 Merge: ${dbQuestions.length} questions BD + ${localOnlyQuestions.length} questions locales`);

  return [...dbQuestions, ...localOnlyQuestions];
};
