import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildCsvString } from './exportCsv';

describe('escapeCsvCell', () => {
  it('returns value when no special chars', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
  });
  it('wraps in quotes and escapes double quotes when comma present', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });
  it('doubles internal double quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('buildCsvString', () => {
  it('builds header and one row', () => {
    const rows = [{ name: 'Alice', age: 30 }];
    const columns = [{ key: 'name' as const, label: 'Name' }, { key: 'age' as const, label: 'Age' }];
    const csv = buildCsvString(rows, columns);
    expect(csv).toContain('\uFEFF');
    expect(csv).toContain('Name,Age');
    expect(csv).toContain('Alice,30');
  });
  it('escapes cells with commas', () => {
    const rows = [{ a: 'x,y' }];
    const csv = buildCsvString(rows, [{ key: 'a' as const, label: 'A' }]);
    expect(csv).toContain('"x,y"');
  });
});
