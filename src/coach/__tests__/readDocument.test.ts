import { getDefaultSettings } from '@/config/settingsSchema';
import { migrate } from '@/db/migrate';
import * as labReportRepository from '@/db/repositories/labReportRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { composeSystemPrompt } from '../context';
import { executeTool } from '../tools';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
  journalRepository: jest.requireActual('@/db/repositories/journalRepository'),
  labReportRepository: jest.requireActual('@/db/repositories/labReportRepository'),
}));

describe('documenti della Cartella per il coach', () => {
  it('read_document restituisce il documento da allegare', async () => {
    const db = createTestDb();
    await migrate(db);
    const id = await labReportRepository.createReport(db, {
      title: 'medicalreport',
      reportDate: '2026-10-02',
      mimeType: 'application/pdf',
      fileName: 'medicalreport.pdf',
      data: new Uint8Array([37, 80, 68, 70]),
    });
    const ok = await executeTool(db, {
      id: 'c',
      name: 'read_document',
      arguments: { report_id: id },
    });
    expect(ok.isError).toBe(false);
    expect(ok.attachment).toEqual({
      reportId: id,
      title: 'medicalreport',
      mimeType: 'application/pdf',
    });
    const missing = await executeTool(db, {
      id: 'c',
      name: 'read_document',
      arguments: { report_id: 'nope' },
    });
    expect(missing.isError).toBe(true);
  });

  it("l'elenco dei documenti è nel prompt, con l'istruzione di aprirli", () => {
    const records = [{ id: 'r1', title: 'Withings report', date: '2026-10-02', kind: 'pdf' }];
    const base = {
      coach: getDefaultSettings().coach,
      language: 'it' as const,
      now: new Date(),
      records,
    };
    const cloud = composeSystemPrompt(base);
    expect(cloud).toContain('[r1] Withings report — 2026-10-02 (pdf)');
    expect(cloud).toContain('call read_document');
    expect(composeSystemPrompt({ ...base, compact: true })).toContain(
      'cannot open these documents',
    );
  });
});
