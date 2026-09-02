import { useQuestionsStore, Question, TrivialBox } from './questions-store';

const q = (id: string, boxName: string): Question => ({
  id,
  question: `Q${id}`,
  answer: `A${id}`,
  boxName,
});

const seed = (boxes: TrivialBox[]) => useQuestionsStore.setState({ boxes });
const rebuild = (questions: Question[]) =>
  useQuestionsStore.getState().rebuildBoxes(questions);

describe('rebuildBoxes', () => {
  it('conserve parentBox / description / hidden / createdBy des boites existantes', () => {
    seed([
      { name: 'Cinema 80s', cardNumbers: [], totalQuestions: 1, parentBox: 'Cinema', description: 'les 80s', hidden: true, createdBy: 'floxail', ordered: true },
    ]);

    const box = rebuild([q('1', 'Cinema 80s')]).find(b => b.name === 'Cinema 80s')!;

    expect(box.parentBox).toBe('Cinema');
    expect(box.description).toBe('les 80s');
    expect(box.hidden).toBe(true);
    expect(box.createdBy).toBe('floxail');
    expect(box.ordered).toBe(true);
  });

  it('garde une boite master qui n a aucune question', () => {
    seed([
      { name: 'Cinema', cardNumbers: [], totalQuestions: 0 },
      { name: 'Cinema 80s', cardNumbers: [], totalQuestions: 1, parentBox: 'Cinema' },
    ]);

    const names = rebuild([q('1', 'Cinema 80s')]).map(b => b.name);

    expect(names).toContain('Cinema');
  });

  it('garde une boite videe de ses questions (bulk move / delete)', () => {
    seed([
      { name: 'Histoire', cardNumbers: [1], totalQuestions: 1 },
      { name: 'Geo', cardNumbers: [], totalQuestions: 0 },
    ]);

    // toutes les questions d'Histoire sont deplacees vers Geo
    const boxes = rebuild([q('1', 'Geo')]);

    expect(boxes.map(b => b.name)).toContain('Histoire');
    expect(boxes.find(b => b.name === 'Histoire')!.totalQuestions).toBe(0);
    expect(boxes.find(b => b.name === 'Geo')!.totalQuestions).toBe(1);
  });

  it('ne ressuscite pas une boite absente de l etat courant', () => {
    seed([{ name: 'Geo', cardNumbers: [], totalQuestions: 0 }]);

    const names = rebuild([q('1', 'Geo')]).map(b => b.name);

    expect(names).toEqual(['Geo']);
  });

  it('la DB reste prioritaire sur ordered', () => {
    seed([{ name: 'Geo', cardNumbers: [], totalQuestions: 0, ordered: true }]);

    const box = rebuild([q('1', 'Geo')]).find(b => b.name === 'Geo')!;
    expect(box.ordered).toBe(true);

    const fromDb = useQuestionsStore
      .getState()
      .rebuildBoxes([q('1', 'Geo')], new Map([['Geo', false]]))
      .find(b => b.name === 'Geo')!;
    expect(fromDb.ordered).toBe(false);
  });
});
