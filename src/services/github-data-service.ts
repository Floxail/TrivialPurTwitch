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
  
  // Créer un Set des IDs locaux pour éviter les doublons
  const localIds = new Set(localQuestions.map(q => q.id));
  
  // Ajouter seulement les questions GitHub qui n'existent pas en local
  const newQuestions = githubQuestions.filter((q: any) => !localIds.has(q.id));
  
  return [...localQuestions, ...newQuestions];
};
