import { useState } from 'react';
import { Button, Form, Card, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './convertisseur.scss';

type QuestionField = {
  question: string;
  answer: string;
};

type ParsedQuestion = {
  question: string;
  answer: string;
  alternativeAnswers?: string[];
};

type CardMode = 'carte' | 'quiz';

const Convertisseur = () => {
  const [mode, setMode] = useState<CardMode>('carte');
  const [boxName, setBoxName] = useState('');
  const [cardNumber, setCardNumber] = useState(1);

  // Mode Carte
  const [carteQuestions, setCarteQuestions] = useState<QuestionField[]>(
    Array(6).fill(null).map(() => ({ question: '', answer: '' }))
  );

  // Mode Quiz - un seul bloc de texte
  const [quizTextBlock, setQuizTextBlock] = useState('');

  // Mode Quiz - choix de catégorie ('random' ou 0-5)
  const [quizCategoryMode, setQuizCategoryMode] = useState<'random' | number>('random');

  const categoryColors = ['#4A90E2', '#E91E63', '#FFC107', '#533303ff', '#4CAF50', '#FF5722'];
  const categoryNames = ['▲ Bleu', '▲ Rose', '▲ Jaune', '▲ Marron', '▲ Vert', '▲ Orange'];

  const handleCarteQuestionChange = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...carteQuestions];
    updated[index][field] = value;
    setCarteQuestions(updated);
  };

  const parseQuizText = (text: string): ParsedQuestion[] => {
    const questions: ParsedQuestion[] = [];
    const lines = text.split('\n');

    let currentQuestion: Partial<ParsedQuestion> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('Q:') || trimmedLine.startsWith('q:')) {
        // Si on a déjà une question en cours, on la sauvegarde
        if (currentQuestion.question && currentQuestion.answer) {
          questions.push(currentQuestion as ParsedQuestion);
        }
        // Nouvelle question
        currentQuestion = {
          question: trimmedLine.substring(2).trim(),
        };
      } else if (trimmedLine.startsWith('R:') || trimmedLine.startsWith('r:')) {
        currentQuestion.answer = trimmedLine.substring(2).trim();
      } else if (trimmedLine.startsWith('ALT:') || trimmedLine.startsWith('alt:')) {
        const altAnswers = trimmedLine.substring(4).trim();
        // Séparer les réponses alternatives par virgule
        currentQuestion.alternativeAnswers = altAnswers.split(',').map(a => a.trim()).filter(a => a);
      }
    }

    // Ajouter la dernière question si elle est complète
    if (currentQuestion.question && currentQuestion.answer) {
      questions.push(currentQuestion as ParsedQuestion);
    }

    return questions;
  };

  const resetForm = () => {
    setCarteQuestions(Array(6).fill(null).map(() => ({ question: '', answer: '' })));
    setQuizTextBlock('');
    setBoxName('');
    setCardNumber(1);
    setQuizCategoryMode('random');
  };

  const downloadJSON = () => {
    if (!boxName.trim()) {
      alert('❌ Veuillez saisir un nom de boîte');
      return;
    }

    let questionsData: any[] = [];

    if (mode === 'carte') {
      const emptyCount = carteQuestions.filter((q) => !q.question.trim() || !q.answer.trim()).length;
      if (emptyCount > 0) {
        if (!window.confirm(`⚠️ ${emptyCount} question(s) vide(s). Continuer ?`)) return;
      }

      questionsData = carteQuestions
        .filter((q) => q.question.trim() && q.answer.trim())
        .map((q, index) => ({
          id: `${boxName.toLowerCase().replace(/\s+/g, '_')}_${cardNumber}_${index}`,
          category: index,
          question: q.question.trim(),
          answer: q.answer.trim(),
          boxName: boxName.trim(),
          cardNumber,
        }));
    } else {
      // Mode Quiz
      const parsed = parseQuizText(quizTextBlock);

      if (parsed.length === 0) {
        alert('❌ Aucune question trouvée. Utilisez le format:\nQ: votre question\nR: votre réponse\nALT: réponses alternatives (optionnel)');
        return;
      }

      questionsData = parsed.map((q, index) => ({
        id: `${boxName.toLowerCase().replace(/\s+/g, '_')}_quiz_${index}`,
        category: quizCategoryMode === 'random' ? Math.floor(Math.random() * 6) : quizCategoryMode,
        question: q.question,
        answer: q.answer,
        ...(q.alternativeAnswers && q.alternativeAnswers.length > 0 && {
          alternativeAnswers: q.alternativeAnswers,
        }),
        boxName: boxName.trim(),
      }));
    }

    const jsonData = {
      boxName: boxName.trim(),
      ...(mode === 'carte' && { cardNumber }),
      questions: questionsData,
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boxName.toLowerCase().replace(/\s+/g, '-')}_${mode === 'carte' ? `carte${cardNumber}` : 'quiz'}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`✅ Fichier téléchargé : ${questionsData.length} question(s)`);
  };

  const renderCarteFields = () => {
    return carteQuestions.map((q, index) => (
      <Card
        key={index}
        className="mb-3"
        style={{ borderLeft: `4px solid ${categoryColors[index]}` }}
      >
        <Card.Body>
          <h5 style={{ color: categoryColors[index] }}>
            {categoryNames[index]}
          </h5>
          <Form.Group className="mb-2">
            <Form.Label>Question</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={q.question}
              onChange={(e) => handleCarteQuestionChange(index, 'question', e.target.value)}
              placeholder="Saisir la question..."
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Réponse</Form.Label>
            <Form.Control
              type="text"
              value={q.answer}
              onChange={(e) => handleCarteQuestionChange(index, 'answer', e.target.value)}
              placeholder="Saisir la réponse..."
            />
          </Form.Group>
        </Card.Body>
      </Card>
    ));
  };

  return (
    <div className="convertisseur-container">
      <div className="convertisseur-header">
        <h2>
          <FontAwesomeIcon icon={['fas', 'wand-magic-sparkles']} /> Convertisseur de Questions
        </h2>
        <p className="text-muted">Créez vos cartes de quiz avec saisie manuelle</p>
      </div>

      <div className="mode-selector mb-4">
        <Button
          variant={mode === 'carte' ? 'primary' : 'outline-primary'}
          onClick={() => setMode('carte')}
          className="me-2"
        >
          🎴 Mode Carte (6 questions)
        </Button>
        <Button
          variant={mode === 'quiz' ? 'primary' : 'outline-primary'}
          onClick={() => setMode('quiz')}
        >
          📝 Mode Quiz (bloc texte)
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Nom de la boîte *</Form.Label>
            <Form.Control
              type="text"
              value={boxName}
              onChange={(e) => setBoxName(e.target.value)}
              placeholder="Ex: Cinéma 91, Histoire, etc."
            />
          </Form.Group>

          {mode === 'carte' && (
            <Form.Group className="mb-3">
              <Form.Label>Numéro de carte *</Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={cardNumber}
                onChange={(e) => setCardNumber(parseInt(e.target.value) || 1)}
              />
            </Form.Group>
          )}
        </Card.Body>
      </Card>

      <div className="questions-section mb-4">
        {mode === 'carte' ? (
          renderCarteFields()
        ) : (
          <Card>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label><strong>Catégorie des questions</strong></Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={quizCategoryMode === 'random' ? 'primary' : 'outline-secondary'}
                    onClick={() => setQuizCategoryMode('random')}
                  >
                    🎲 Aléatoire
                  </Button>
                  {categoryNames.map((name, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={quizCategoryMode === index ? 'primary' : 'outline-secondary'}
                      onClick={() => setQuizCategoryMode(index)}
                      style={{
                        borderColor: categoryColors[index],
                        color: quizCategoryMode === index ? 'white' : categoryColors[index],
                        backgroundColor: quizCategoryMode === index ? categoryColors[index] : 'transparent',
                      }}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
                <small className="text-muted mt-1 d-block">
                  {quizCategoryMode === 'random'
                    ? 'Chaque question aura une couleur aléatoire'
                    : `Toutes les questions seront en ${categoryNames[quizCategoryMode as number]}`}
                </small>
              </Form.Group>

              <Form.Group>
                <Form.Label>
                  <strong>Saisissez vos questions</strong>
                  <br />
                  <small className="text-muted">
                    Utilisez le format: Q: question / R: réponse / ALT: réponses alternatives (optionnel)
                  </small>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={15}
                  value={quizTextBlock}
                  onChange={(e) => setQuizTextBlock(e.target.value)}
                  placeholder={`Q: Qui a réalisé le film Titanic ?\nR: James Cameron\nALT: Cameron\n\nQ: En quelle année est sorti Jurassic Park ?\nR: 1993\n\nQ: Quel acteur joue Iron Man ?\nR: Robert Downey Jr\nALT: RDJ, Robert Downey Junior`}
                  style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}
                />
              </Form.Group>
              <Alert variant="secondary" className="mt-3 mb-0">
                <small>
                  <FontAwesomeIcon icon={['fas', 'lightbulb']} /> <strong>Astuce:</strong>
                  <ul className="mb-0 mt-2">
                    <li><strong>Q:</strong> pour commencer une nouvelle question</li>
                    <li><strong>R:</strong> pour la réponse principale</li>
                    <li><strong>ALT:</strong> pour les réponses alternatives (séparées par des virgules)</li>
                  </ul>
                </small>
              </Alert>
            </Card.Body>
          </Card>
        )}
      </div>

      <div className="action-buttons d-flex gap-2 justify-content-center mb-4">
        <Button variant="success" size="lg" onClick={downloadJSON}>
          <FontAwesomeIcon icon={['fas', 'download']} /> Télécharger JSON
        </Button>
        <Button variant="outline-danger" size="lg" onClick={resetForm}>
          <FontAwesomeIcon icon={['fas', 'rotate-left']} /> Réinitialiser
        </Button>
      </div>

      <Alert variant="info">
        <h6>
          <FontAwesomeIcon icon={['fas', 'circle-info']} /> Comment utiliser ?
        </h6>
        <ol className="mb-0">
          <li>Choisissez le mode (Carte ou Quiz)</li>
          <li>Saisissez le nom de votre boîte et le numéro de carte (si mode Carte)</li>
          <li>
            <strong>Mode Carte:</strong> Remplissez les 6 questions/réponses individuellement
          </li>
          <li>
            <strong>Mode Quiz:</strong> Collez vos questions au format Q:/R:/ALT: dans le bloc texte
          </li>
          <li>Cliquez sur "Télécharger JSON" pour générer le fichier</li>
          <li>Importez le fichier dans le gestionnaire de questions</li>
        </ol>
      </Alert>
    </div>
  );
};

export default Convertisseur;
