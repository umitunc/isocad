import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PipingPdfAnalyzer } from '../pdf-loader/PipingPdfAnalyzer';

describe('PipingPdfAnalyzer on real sample isometric PDFs', () => {
  it('extracts MTO, Cut List, Supports, and Weld Log from GN-80-AH01FS-FA00.030.pdf', async () => {
    const pdfPath = path.resolve(process.cwd(), 'public/samples/GN-80-AH01FS-FA00.030.pdf');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    const analyzer = new PipingPdfAnalyzer();
    const res = await analyzer.analyzeDocument(doc, 'GN-80-AH01FS-FA00.030');

    expect(res.lineNo).toContain('GN-80');
    expect(res.mto.length).toBeGreaterThanOrEqual(2);
    expect(res.cuts.length).toBeGreaterThanOrEqual(5);
    expect(res.welds.length).toBeGreaterThanOrEqual(5);
  });

  it('extracts Russian Cyrillic MTO & Cut List from GN-400-AH01FS-FA00.015-B1.pdf', async () => {
    const pdfPath = path.resolve(process.cwd(), 'public/samples/GN-400-AH01FS-FA00.015-B1.pdf');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    const analyzer = new PipingPdfAnalyzer();
    const res = await analyzer.analyzeDocument(doc, 'GN-400-AH01FS-FA00.015-B1');

    expect(res.mto.length).toBeGreaterThanOrEqual(10);
    expect(res.cuts.length).toBeGreaterThanOrEqual(10);
    expect(res.welds.length).toBeGreaterThanOrEqual(5);
  });

  it('extracts Supports and As-Built Weld Stamps from CGG-800-AH01PG-FA00.520-HC.pdf', async () => {
    const pdfPath = path.resolve(process.cwd(), 'docs/idea/CGG-800-AH01PG-FA00.520-HC.pdf');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    const analyzer = new PipingPdfAnalyzer();
    const res = await analyzer.analyzeDocument(doc, 'CGG-800-AH01PG-FA00.520-HC');

    expect(res.supports.length).toBeGreaterThanOrEqual(3);
    expect(res.welds.length).toBeGreaterThanOrEqual(10);
  });
});
