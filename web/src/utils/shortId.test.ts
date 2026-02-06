import { describe, it, expect } from 'vitest';
import { shortId } from './shortId';

describe('shortId', () => {
  it('returns em dash for null', () => {
    expect(shortId(null)).toBe('—');
  });
  it('returns em dash for undefined', () => {
    expect(shortId(undefined)).toBe('—');
  });
  it('returns em dash for empty string', () => {
    expect(shortId('')).toBe('—');
  });
  it('returns id when length <= default len (8)', () => {
    expect(shortId('abc')).toBe('abc');
    expect(shortId('12345678')).toBe('12345678');
  });
  it('shortens long id to 8 chars + ellipsis', () => {
    expect(shortId('cmlajowo4000011topdrpoktz')).toBe('cmlajowo…');
  });
  it('respects custom len', () => {
    expect(shortId('abcdefghij', 4)).toBe('abcd…');
    expect(shortId('ab', 4)).toBe('ab');
  });
});
