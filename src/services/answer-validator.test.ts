import { verifyAnswer } from './answer-validator';
import { Question, QuestionType } from 'components/store/questions-store';
import { Answer, usePlayerStore } from 'components/store/player-store';

const joconde: Question = {
  id: '1',
  question: 'Qui a peint la Joconde ?',
  answer: 'Léonard de Vinci',
  alternativeAnswers: ['Leonardo'],
  boxName: 'Test',
};

describe('verifyAnswer — réponse principale vs ALT', () => {
  it('réponse principale : pas marquée alternative', () => {
    expect(verifyAnswer('leonard de vinci', joconde)).toEqual({ valid: true, isCorrect: true });
  });

  it('réponse ALT : marquée alternative', () => {
    expect(verifyAnswer('leonardo', joconde)).toEqual({ valid: true, isCorrect: true, isAlternative: true });
  });

  it('QCM : jamais alternative', () => {
    const qcm: Question = { ...joconde, questionType: QuestionType.QCM, qcmOptions: ['Lyon', 'Paris'], qcmCorrectIndex: 1 };
    expect(verifyAnswer('B', qcm)).toEqual({ valid: true, isCorrect: true });
  });
});

describe('recordAnswers — points de base', () => {
  beforeEach(() => {
    usePlayerStore.setState({ players: {} });
    ['main', 'alt'].forEach(nick => usePlayerStore.getState().initPlayer(nick, ''));
  });

  it('applique basePoints puis les bonus habituels', () => {
    // 2 répondants → pas de bonus "seul" ; aucun FIRST ni combo
    usePlayerStore.getState().recordAnswers([
      new Answer('main', false, false, 1000, 3),
      new Answer('alt', false, false, 1200, 1),
    ]);
    const { players } = usePlayerStore.getState();
    expect(players.main.score).toBe(3);
    expect(players.alt.score).toBe(1);
  });

  it('bonus FIRST s\'ajoute à la base', () => {
    usePlayerStore.getState().recordAnswers([
      new Answer('main', true, false, 1000, 3),
      new Answer('alt', false, false, 1200, 1),
    ]);
    expect(usePlayerStore.getState().players.main.score).toBe(5);
  });

  it('sans basePoints explicite : base 1 (comportement historique)', () => {
    usePlayerStore.getState().recordAnswers([new Answer('main', false, false, 1000)]);
    // 1 base + 1 bonus "seul"
    expect(usePlayerStore.getState().players.main.score).toBe(2);
  });
});
