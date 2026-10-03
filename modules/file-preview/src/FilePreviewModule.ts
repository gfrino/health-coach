import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class FilePreviewModule extends NativeModule {
  /** Anteprima di sistema (QuickLook) del file locale; si risolve alla chiusura. */
  preview(fileUri: string, title: string | null): Promise<void>;
  /** Testo di un PDF o di una foto (OCR), letto sul telefono; `null` se non c'è testo. */
  extractText?(fileUri: string): Promise<string | null>;
}

/** `null` su Android, nei test e nelle build che non contengono il modulo. */
export default requireOptionalNativeModule<FilePreviewModule>('FilePreview');
