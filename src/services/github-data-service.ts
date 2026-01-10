// Service pour charger les questions depuis GitHub
export const loadQuestionsFromGitHub = async (): Promise<any> => {
  try {
    // Essayer d'abord depuis GitHub raw (toujours à jour)
    const githubRawUrl = 'https://raw.githubusercontent.com/Floxail/TrivialPurTwitch/master/public/questions/questions.json';

    try {
      const response = await fetch(`${githubRawUrl}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Questions chargées depuis GitHub raw');
        return data;
      }
    } catch (githubError) {
      console.warn('⚠️ Impossible de charger depuis GitHub raw, fallback vers build local', githubError);
    }

    // Fallback : charger depuis le build local
    const response = await fetch(
      `${process.env.PUBLIC_URL}/questions/questions.json?t=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Questions chargées depuis build local');
    return data;
  } catch (error) {
    console.error('❌ Erreur lors du chargement depuis GitHub:', error);
    return null;
  }
};

// Fusionner les questions GitHub avec localStorage
export const mergeQuestionsFromGitHub = (
  githubData: any,
  localQuestions: any[],
  previousGithubIds?: Set<string>
): any[] => {
  if (!githubData || !githubData.questions) {
    return localQuestions;
  }

  const githubQuestions = githubData.questions;
  const currentGithubIds = new Set(githubQuestions.map((q: any) => q.id));

  // Déterminer quelles questions locales sont vraiment "locales" (créées manuellement)
  // On considère qu'une question est locale si :
  // 1. Elle n'est pas dans GitHub actuellement
  // 2. Elle n'était pas dans GitHub précédemment (si on a l'historique)

  let localOnlyQuestions;

  if (previousGithubIds) {
    // Si on a l'historique des IDs GitHub précédents
    // Les questions vraiment locales sont celles qui n'ont JAMAIS été dans GitHub
    localOnlyQuestions = localQuestions.filter(q =>
      !currentGithubIds.has(q.id) && !previousGithubIds.has(q.id)
    );
  } else {
    // Premier chargement : on considère que les questions non-GitHub sont locales
    localOnlyQuestions = localQuestions.filter(q => !currentGithubIds.has(q.id));
  }

  console.log(`🔄 Merge: ${githubQuestions.length} questions GitHub + ${localOnlyQuestions.length} questions locales`);

  // Retourner : toutes les questions GitHub + questions vraiment locales
  return [...githubQuestions, ...localOnlyQuestions];
};
