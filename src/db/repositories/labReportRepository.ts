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
  createdAt: r.created_at,
});

const SELECT = `SELECT r.id, r.title, r.report_date, r.extraction_status, r.created_at,
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
