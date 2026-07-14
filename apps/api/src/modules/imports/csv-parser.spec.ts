import { parseCsv } from './csv-parser';

describe('parseCsv', () => {
  it('should parse a simple comma-delimited CSV into keyed rows', () => {
    const rows = parseCsv('sku,name,salePrice\nP1,Camiseta,49.90\nP2,Boné,25');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ sku: 'P1', name: 'Camiseta', salePrice: '49.90' });
    expect(rows[1].name).toBe('Boné');
  });

  it('should auto-detect the semicolon delimiter', () => {
    const rows = parseCsv('name;email\nAna;ana@x.com');
    expect(rows[0]).toEqual({ name: 'Ana', email: 'ana@x.com' });
  });

  it('should honor quoted fields containing the delimiter', () => {
    const rows = parseCsv('name,description\n"Kit, especial","Contém A, B e C"');
    expect(rows[0].name).toBe('Kit, especial');
    expect(rows[0].description).toBe('Contém A, B e C');
  });

  it('should support escaped double quotes inside quoted fields', () => {
    const rows = parseCsv('name\n"Produto ""Premium"""');
    expect(rows[0].name).toBe('Produto "Premium"');
  });

  it('should skip empty lines and strip a BOM', () => {
    const rows = parseCsv('﻿sku,name\nP1,A\n\n\nP2,B\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ sku: 'P2', name: 'B' });
  });

  it('should return an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('should tolerate rows with missing trailing columns', () => {
    const rows = parseCsv('sku,name,ean\nP1,Só nome');
    expect(rows[0]).toEqual({ sku: 'P1', name: 'Só nome', ean: '' });
  });
});
