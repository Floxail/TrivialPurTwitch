import { pointsForCorrectAnswer } from './scoring';

describe('pointsForCorrectAnswer', () => {
  it('base seule', () => {
    expect(pointsForCorrectAnswer(1, false, false, 1)).toBe(1);
  });

  it('FIRST ajoute 2', () => {
    expect(pointsForCorrectAnswer(1, true, false, 1)).toBe(3);
  });

  it('seul à trouver ajoute 1', () => {
    expect(pointsForCorrectAnswer(1, false, true, 1)).toBe(2);
  });

  it('combo : +1 par question enchaînée, plafonné à +3', () => {
    expect(pointsForCorrectAnswer(1, false, false, 2)).toBe(2);
    expect(pointsForCorrectAnswer(1, false, false, 4)).toBe(4);
    expect(pointsForCorrectAnswer(1, false, false, 9)).toBe(4);
  });

  it('cumule base 3, FIRST, seul et combo', () => {
    expect(pointsForCorrectAnswer(3, true, true, 3)).toBe(3 + 2 + 1 + 2);
  });
});
