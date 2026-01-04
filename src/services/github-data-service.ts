// Service pour charger les questions depuis GitHub
export const loadQuestionsFromGitHub = async (): Promise<any> => {
  try {
    const response = await fetch(
      `${process.env.PUBLIC_URL}/questions/questions.json?t=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Erreur lors du chargement depuis GitHub:', error);
    return null;
  }
};

// Fusionner les questions GitHub avec localStorage
export const mergeQuestionsFromGitHub = (
  githubData: any,
  localQuestions: any[]
): any[] => {
  if (!githubData || !githubData.questions) {
    return localQuestions;
  }

  const githubQuestions = githubData.questions;

  // Créer un Set des IDs GitHub
  const githubIds = new Set(githubQuestions.map((q: any) => q.id));

  // Garder uniquement les questions locales qui ne sont PAS dans GitHub
  // (ce sont les questions créées manuellement en local)
  const localOnlyQuestions = localQuestions.filter(q => !githubIds.has(q.id));

  // Retourner : toutes les questions GitHub + questions locales uniquement
  return [...githubQuestions, ...localOnlyQuestions];
};
