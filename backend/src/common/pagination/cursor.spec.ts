import { toPage, isNewerThan } from './cursor';

describe('toPage', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('returns every row and no cursor when the page is not full', () => {
    expect(toPage(rows.slice(0, 2), 5)).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      nextCursor: null,
    });
  });

  it('returns a cursor when an extra row was fetched', () => {
    expect(toPage(rows, 2)).toEqual({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b' });
  });

  it('does not return a cursor when rows exactly fill the page', () => {
    expect(toPage(rows, 3)).toEqual({ items: rows, nextCursor: null });
  });

  it('handles an empty page', () => {
    expect(toPage([], 30)).toEqual({ items: [], nextCursor: null });
  });
});

describe('isNewerThan', () => {
  it('accepts any id when there is no cursor', () => {
    expect(isNewerThan('01', null)).toBe(true);
  });

  it('compares UUIDv7 ids lexicographically', () => {
    expect(isNewerThan('0190b', '0190a')).toBe(true);
    expect(isNewerThan('0190a', '0190a')).toBe(false);
    expect(isNewerThan('01909', '0190a')).toBe(false);
  });
});
