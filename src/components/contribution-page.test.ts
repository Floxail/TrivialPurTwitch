import { tabFromSearch } from './contribution-page';

describe('tabFromSearch', () => {
  it('ouvre l\'onglet bulk avec ?mode=bulk (lien de la commande Discord /proposer)', () => {
    expect(tabFromSearch('?mode=bulk')).toBe('bulk');
  });

  it('onglet simple par défaut', () => {
    expect(tabFromSearch('')).toBe('single');
    expect(tabFromSearch('?mode=autre')).toBe('single');
  });
});
