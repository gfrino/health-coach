import { newId } from '../ids';
import type { Db } from '../types';

/** Referti ed esami: il file originale resta nel DB cifrato (BLOB), mai in chiaro su disco. */

export const MAX_REPORT_BYTES = 20 * 1024 * 1024;

export interface LabReport {
  id: string;
  title: string;
  reportDate: string | null;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  extractionStatus: 'none' | 'pending' | 'extracted' | 'confirmed' | 'failed';
  /** Riassunto scritto dall'AI dopo aver letto il documento. */
  summary: string | null;
  createdAt: number;
}

interface Row {
  id: string;
  title: string;
  report_date: string | null;
  mime_type: string | null;
  file_name: string | null;
  size_bytes: number | null;
  extraction_status: LabReport['extractionStatus'];
  notes: string | null;
  created_at: number;
}

const toReport = (r: Row): LabReport => ({
  id: r.id,
  title: r.title,
  reportDate: r.report_date,
  mimeType: r.mime_type,
  fileName: r.file_name,
  sizeBytes: r.size_bytes,
  extractionStatus: r.extraction_status,
  summary: r.notes,
  createdAt: r.created_at,
});

const SELECT = `SELECT r.id, r.title, r.report_date, r.extraction_status, r.notes, r.created_at,
  f.mime_type, f.file_name, f.size_bytes
  FROM lab_reports r LEFT JOIN lab_report_files f ON f.report_id = r.id`;

export async function createReport(
  db: Db,
  input: {
    title: string;
    reportDate?: string | null;
    mimeType: string;
    fileName?: string | null;
    data: Uint8Array;
  },
): Promise<string> {
  if (input.data.byteLength > MAX_REPORT_BYTES) throw new Error('file_too_large');
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO lab_reports (id, title, report_date, created_at) VALUES (?, ?, ?, ?)',
      [id, input.title.trim(), input.reportDate ?? null, Date.now()],
    );
    await db.runAsync(
      'INSERT INTO lab_report_files (report_id, mime_type, file_name, size_bytes, data) VALUES (?, ?, ?, ?, ?)',
      [id, input.mimeType, input.fileName ?? null, input.data.byteLength, input.data],
    );
  });
  return id;
}

export async function listReports(db: Db): Promise<LabReport[]> {
  const rows = await db.getAllAsync<Row>(
    `${SELECT} ORDER BY COALESCE(r.report_date, date(r.created_at / 1000, 'unixepoch')) DESC, r.created_at DESC`,
    [],
  );
  return rows.map(toReport);
}

export async function getReport(db: Db, id: string): Promise<LabReport | null> {
  const row = await db.getFirstAsync<Row>(`${SELECT} WHERE r.id = ?`, [id]);
  return row ? toReport(row) : null;
}

export async function getReportFile(
  db: Db,
  id: string,
): Promise<{ mimeType: string; fileName: string | null; data: Uint8Array } | null> {
  const row = await db.getFirstAsync<{
    mime_type: string;
    file_name: string | null;
    data: Uint8Array;
  }>('SELECT mime_type, file_name, data FROM lab_report_files WHERE report_id = ?', [id]);
  return row ? { mimeType: row.mime_type, fileName: row.file_name, data: row.data } : null;
}

export async function updateReport(
  db: Db,
  id: string,
  patch: { title?: string; reportDate?: string | null },
) {
  if (patch.title !== undefined)
    await db.runAsync('UPDATE lab_reports SET title = ? WHERE id = ?', [patch.title.trim(), id]);
  if (patch.reportDate !== undefined)
    await db.runAsync('UPDATE lab_reports SET report_date = ? WHERE id = ?', [
      patch.reportDate,
      id,
    ]);
}

export async function deleteReport(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM lab_reports WHERE id = ?', [id]);
}

// ── Valori letti dall'AI ─────────────────────────────────────────────────────

const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface LabResult {
  id: string;
  reportId: string | null;
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  measuredAt: string;
}

export interface LabResultInput {
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
}

/** Nome confrontabile tra referti diversi: minuscolo, senza accenti e spazi doppi. */
export const normalizeLabName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Fuori dall'intervallo di riferimento? null = non valutabile. */
export function outOfRange(
  r: Pick<LabResult, 'value' | 'refLow' | 'refHigh'>,
): 'low' | 'high' | null {
  if (r.value == null) return null;
  if (r.refLow != null && r.value < r.refLow) return 'low';
  if (r.refHigh != null && r.value > r.refHigh) return 'high';
  return null;
}

export async function setExtractionStatus(
  db: Db,
  id: string,
  status: LabReport['extractionStatus'],
): Promise<void> {
  await db.runAsync('UPDATE lab_reports SET extraction_status = ? WHERE id = ?', [status, id]);
}

/** Sostituisce i valori letti dal referto, salva il riassunto e (se mancava) la data. */
export async function saveExtraction(
  db: Db,
  id: string,
  input: {
    reportDate: string | null;
    labName: string | null;
    summary: string | null;
    results: LabResultInput[];
  },
): Promise<void> {
  const report = await getReport(db, id);
  if (!report) return;
  // La data impostata all'importazione è quella del giorno: se l'utente non l'ha cambiata,
  // vale la data scritta sul documento.
  const importDay = localDay(report.createdAt);
  const keepUserDate = report.reportDate !== null && report.reportDate !== importDay;
  const date = keepUserDate ? report.reportDate : (input.reportDate ?? report.reportDate);
  const measuredAt = date ?? importDay;
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM lab_results WHERE report_id = ?', [id]);
    for (const r of input.results) {
      await db.runAsync(
        `INSERT INTO lab_results (id, report_id, name, normalized_name, value, value_text, unit, ref_low, ref_high, ref_text, measured_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          id,
          r.name,
          normalizeLabName(r.name),
          r.value,
          r.valueText,
          r.unit,
          r.refLow,
          r.refHigh,
          r.refText,
          measuredAt,
          now,
        ],
      );
    }
    await db.runAsync(
      `UPDATE lab_reports SET extraction_status = 'extracted', notes = ?, lab_name = COALESCE(lab_name, ?),
       report_date = ? WHERE id = ?`,
      [input.summary, input.labName, date, id],
    );
  });
}

const toResult = (r: {
  id: string;
  report_id: string | null;
  name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  measured_at: string;
}): LabResult => ({
  id: r.id,
  reportId: r.report_id,
  name: r.name,
  value: r.value,
  valueText: r.value_text,
  unit: r.unit,
  refLow: r.ref_low,
  refHigh: r.ref_high,
  refText: r.ref_text,
  measuredAt: r.measured_at,
});

export async function listResults(db: Db, reportId: string): Promise<LabResult[]> {
  const rows = await db.getAllAsync<Parameters<typeof toResult>[0]>(
    'SELECT * FROM lab_results WHERE report_id = ? ORDER BY created_at, rowid',
    [reportId],
  );
  return rows.map(toResult);
}

/** Ultimo valore di ogni esame (tutti i referti), dal più recente. */
export async function latestResults(db: Db, limit = 60): Promise<LabResult[]> {
  const rows = await db.getAllAsync<Parameters<typeof toResult>[0]>(
    `SELECT * FROM lab_results l WHERE NOT EXISTS (
       SELECT 1 FROM lab_results n WHERE n.normalized_name = l.normalized_name
       AND (n.measured_at > l.measured_at OR (n.measured_at = l.measured_at AND n.created_at > l.created_at))
     ) ORDER BY measured_at DESC, name LIMIT ?`,
    [limit],
  );
  return rows.map(toResult);
}

/** Valori precedenti dello stesso esame (per mostrare l'andamento). */
export async function previousResults(
  db: Db,
  name: string,
  beforeDate: string,
  limit = 3,
): Promise<LabResult[]> {
  const rows = await db.getAllAsync<Parameters<typeof toResult>[0]>(
    `SELECT * FROM lab_results WHERE normalized_name = ? AND measured_at < ?
     ORDER BY measured_at DESC LIMIT ?`,
    [normalizeLabName(name), beforeDate, limit],
  );
  return rows.map(toResult);
}
