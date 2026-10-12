import { smartPick, sortByCreation, stratifiedPick } from './quiz-picker';

const items = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

describe('smartPick', () => {
  it('retourne le nombre demandé, sans doublon', () => {
    const picked = smartPick(items('q', 20), 7, []);
    expect(picked).toHaveLength(7);
    expect(new Set(picked.map(q => q.id)).size).toBe(7);
  });

  it('priorise les questions absentes de l\'historique', () => {
    const pool = items('q', 10);
    const recent = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
    const picked = smartPick(pool, 3, recent).map(q => q.id).sort();
    expect(picked).toEqual(['q7', 'q8', 'q9']);
  });

  it('complète avec les plus anciennement jouées', () => {
    const pool = items('q', 4);
    // q0 = le plus récent, q3 = le plus ancien
    const picked = smartPick(pool, 1, ['q0', 'q1', 'q2', 'q3']).map(q => q.id);
    expect(['q2', 'q3']).toContain(picked[0]);
  });

  it('pool plus petit que la demande : tout le pool', () => {
    expect(smartPick(items('q', 3), 10, [])).toHaveLength(3);
  });
});

describe('stratifiedPick', () => {
  it('répartit équitablement entre les pools', () => {
    const picked = stratifiedPick([items('a', 10), items('b', 10)], 4, []);
    expect(picked.filter(q => q.id.startsWith('a'))).toHaveLength(2);
    expect(picked.filter(q => q.id.startsWith('b'))).toHaveLength(2);
  });

  it('compense un pool trop petit', () => {
    const picked = stratifiedPick([items('a', 1), items('b', 10)], 6, []);
    expect(picked).toHaveLength(6);
    expect(picked.filter(q => q.id.startsWith('a'))).toHaveLength(1);
  });
});

describe('sortByCreation', () => {
  it('trie par createdAt puis id, les dates manquantes en dernier', () => {
    const sorted = sortByCreation([
      { id: 'c' },
      { id: 'b', createdAt: '2026-01-02' },
      { id: 'a', createdAt: '2026-01-02' },
      { id: 'd', createdAt: '2026-01-01' },
    ]);
    expect(sorted.map(q => q.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});
