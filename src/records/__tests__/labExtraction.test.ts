import { migrate } from '@/db/migrate';
import * as labReportRepository from '@/db/repositories/labReportRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import {
  countValueLines,
  linesExtractionInstruction,
  parseDeviceExtraction,
  parseExtraction,
  parseNumber,
  parseRange,
} from '../labExtraction';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  getDb: jest.fn(),
  labReportRepository: jest.requireActual('@/db/repositories/labReportRepository'),
}));
jest.mock('@/i18n', () => ({ resolveLanguage: () => 'it', deviceLanguageCodes: () => ['it'] }));

describe('lettura dei referti', () => {
  it('intervalli di riferimento dal testo', () => {
    expect(parseRange('13.0 – 17.0')).toEqual({ low: 13, high: 17 });
    expect(parseRange('3,5-20')).toEqual({ low: 3.5, high: 20 });
    expect(parseRange('< 200')).toEqual({ low: null, high: 200 });
    expect(parseRange('≥40')).toEqual({ low: 40, high: null });
    expect(parseRange('negativo')).toEqual({ low: null, high: null });
  });

  it("formato a righe del modello sul telefono (e limiti calcolati dall'app)", () => {
    const text = [
      'DATE: 2026-09-28',
      'LAB: Medical Laboratory',
      'SUMMARY: A blood test report.',
      'VALUES:',
      'name | value | unit | reference range as written',
      '- Total cholesterol | 212 | mg/dL | < 200',
      'Hemoglobin | 14.2 | g/dL | 13.0 – 17.0',
      'HIV | negative | | ',
    ].join('\n');
    const r = parseDeviceExtraction(text)!;
    expect(r).toMatchObject({
      reportDate: '2026-09-28',
      labName: 'Medical Laboratory',
      summary: 'A blood test report.',
    });
    expect(r.results).toEqual([
      {
        name: 'Total cholesterol',
        value: 212,
        valueText: null,
        unit: 'mg/dL',
        refLow: null,
        refHigh: 200,
        refText: '< 200',
      },
      {
        name: 'Hemoglobin',
        value: 14.2,
        valueText: null,
        unit: 'g/dL',
        refLow: 13,
        refHigh: 17,
        refText: '13.0 – 17.0',
      },
      {
        name: 'HIV',
        value: null,
        valueText: 'negative',
        unit: null,
        refLow: null,
        refHigh: null,
        refText: null,
      },
    ]);
    expect(parseDeviceExtraction('nothing useful')).toBeNull();
  });

  it('legge il JSON del modello in modo tollerante', () => {
    const text =
      'Ecco i valori:\n```json\n{"report_date":"2026-09-12","lab_name":"Lab Ticino","summary":"Esami del sangue: LDL alto.","results":[' +
      '{"name":"Colesterolo LDL","value":"162,5","unit":"mg/dL","ref_low":null,"ref_high":130,"ref_text":"<130"},' +
      '{"name":"HIV","value":null,"value_text":"negativo"},' +
      '{"name":"","value":3},{"name":"Vuoto","value":null}]}\n```';
    expect(parseExtraction(text)).toEqual({
      reportDate: '2026-09-12',
      labName: 'Lab Ticino',
      summary: 'Esami del sangue: LDL alto.',
      results: [
        {
          name: 'Colesterolo LDL',
          value: 162.5,
          valueText: null,
          unit: 'mg/dL',
          refLow: null,
          refHigh: 130,
          refText: '<130',
        },
        {
          name: 'HIV',
          value: null,
          valueText: 'negativo',
          unit: null,
          refLow: null,
          refHigh: null,
          refText: null,
        },
      ],
    });
    expect(parseExtraction('nessun json')).toBeNull();
    expect(parseExtraction('{"report_date":"12.09.2026","results":[]}')?.reportDate).toBeNull();
  });

  it('salva valori e riassunto, usa la data del documento e trova i valori precedenti', async () => {
    const db = createTestDb();
    await migrate(db);
    const created = new Date(2026, 9, 3, 10, 0).getTime();
    jest.useFakeTimers().setSystemTime(created);
    const id1 = await labReportRepository.createReport(db, {
      title: 'Esami marzo',
      reportDate: '2026-10-03', // giorno dell'importazione: vince la data del documento
      mimeType: 'application/pdf',
      data: new Uint8Array([1]),
    });
    const id2 = await labReportRepository.createReport(db, {
      title: 'Esami settembre',
      reportDate: '2026-09-20', // data scelta dall'utente: resta
      mimeType: 'application/pdf',
      data: new Uint8Array([2]),
    });
    jest.useRealTimers();
    const ldl = (value: number) => ({
      name: 'Colesterolo LDL',
      value,
      valueText: null,
      unit: 'mg/dL',
      refLow: null,
      refHigh: 130,
      refText: null,
    });
    await labReportRepository.saveExtraction(db, id1, {
      reportDate: '2026-03-15',
      labName: 'Lab',
      summary: 'LDL alto.',
      results: [ldl(162)],
    });
    await labReportRepository.saveExtraction(db, id2, {
      reportDate: '2026-09-01',
      labName: null,
      summary: 'LDL migliorato.',
      results: [{ ...ldl(118), name: 'colesterolo  LDL' }],
    });

    const r1 = await labReportRepository.getReport(db, id1);
    expect(r1).toMatchObject({
      reportDate: '2026-03-15',
      summary: 'LDL alto.',
      extractionStatus: 'extracted',
    });
    expect((await labReportRepository.getReport(db, id2))?.reportDate).toBe('2026-09-20');

    const latest = await labReportRepository.latestResults(db);
    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({ value: 118, measuredAt: '2026-09-20' });
    const prev = await labReportRepository.previousResults(db, 'Colesterolo LDL', '2026-09-20');
    expect(prev.map((p) => p.value)).toEqual([162]);
    expect(labReportRepository.outOfRange(prev[0]!)).toBe('high');
    expect(labReportRepository.outOfRange(latest[0]!)).toBeNull();

    // Rileggere sostituisce i valori del referto.
    await labReportRepository.saveExtraction(db, id1, {
      reportDate: null,
      labName: null,
      summary: 'Riletto.',
      results: [],
    });
    expect(await labReportRepository.listResults(db, id1)).toEqual([]);
  });
});

describe('parseNumber', () => {
  it('riconosce i separatori delle migliaia non ambigui', () => {
    expect(parseNumber('9,676')).toBe(9676);
    expect(parseNumber("1'930")).toBe(1930);
    expect(parseNumber('1,234,567')).toBe(1234567);
    expect(parseNumber('1.234.567')).toBe(1234567);
    expect(parseNumber('1.930,5')).toBe(1930.5);
    expect(parseNumber('2,500.75')).toBe(2500.75);
  });
  it('mantiene i decimali', () => {
    expect(parseNumber('3,5')).toBe(3.5);
    expect(parseNumber('14.2')).toBe(14.2);
    expect(parseNumber('1,020')).toBe(1.02);
    expect(parseNumber('1.020')).toBe(1.02);
    expect(parseNumber('0,125')).toBe(0.125);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });
});

describe('formato a righe per tutti i modelli', () => {
  it('chiede un riassunto più ricco ai modelli online', () => {
    expect(linesExtractionInstruction('Italian', true)).toContain('2–4 short sentences in Italian');
    expect(linesExtractionInstruction('Italian', false)).toContain('one sentence in Italian');
    expect(linesExtractionInstruction('Italian', true)).toContain('never the patient');
  });

  it('legge una risposta tipo Withings con migliaia e senza intervallo', () => {
    const parsed = parseDeviceExtraction(
      [
        'DATE: 2026-08-15',
        'LAB: Withings',
        'SUMMARY: Rapporto Withings di un mese: passi, peso e sonno.',
        'VALUES:',
        'Daily steps | 9,676 | steps |',
        'Weight | 77.7 | kg |',
        'BMR | 1930 | kcal |',
      ].join('\n'),
    );
    expect(parsed?.reportDate).toBe('2026-08-15');
    expect(parsed?.results.map((r) => [r.name, r.value])).toEqual([
      ['Daily steps', 9676],
      ['Weight', 77.7],
      ['BMR', 1930],
    ]);
    expect(parsed?.results[0]?.refLow).toBeNull();
  });

  it('conta solo le righe di valori complete durante lo streaming', () => {
    expect(countValueLines('SUMMARY: x\nVALUES:\nname | value | unit | range\nWeight | 77')).toBe(0);
    expect(countValueLines('VALUES:\nWeight | 77.7 | kg |\nBMI | 24')).toBe(1);
    expect(countValueLines('VALUES:\nWeight | 77.7 | kg |\nBMI | 24.9 | |\n')).toBe(2);
  });
});
