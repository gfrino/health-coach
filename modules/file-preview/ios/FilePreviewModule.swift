import ExpoModulesCore
import ImageIO
import PDFKit
import QuickLook
import Vision

/// Anteprima dei documenti dentro l'app con QuickLook (lo stesso visore di File e Mail):
/// PDF con zoom e ricerca, foto, documenti Office e testo. Il file resta sul telefono.
public final class FilePreviewModule: Module {
  private var source: PreviewSource?

  public func definition() -> ModuleDefinition {
    Name("FilePreview")

    AsyncFunction("preview") { (url: URL, title: String?, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_NO_VIEW_CONTROLLER", "Nessuna schermata da cui aprire l'anteprima")
        return
      }
      let source = PreviewSource(url: url, title: title) { [weak self] in
        self?.source = nil
        promise.resolve(nil)
      }
      self.source = source
      let controller = QLPreviewController()
      controller.dataSource = source
      controller.delegate = source
      presenter.present(controller, animated: true)
    }
    .runOnQueue(.main)

    /// Testo di un PDF (PDFKit) o di una foto (riconoscimento del testo di Vision), sul telefono.
    /// Serve all'AI del telefono, che non sa aprire PDF e immagini. `nil` se non c'è testo.
    AsyncFunction("extractText") { (url: URL, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        if url.pathExtension.lowercased() == "pdf" {
          promise.resolve(Self.pdfText(url))
        } else {
          promise.resolve(Self.ocrText(url))
        }
      }
    }
  }

  private static let maxPages = 30

  private static func pdfText(_ url: URL) -> String? {
    guard let doc = PDFDocument(url: url) else { return nil }
    var pages: [String] = []
    for i in 0..<min(doc.pageCount, maxPages) {
      guard let page = doc.page(at: i) else { continue }
      if let text = page.string, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        pages.append(text)
      } else if let image = pageImage(page) {
        // PDF scansionato (solo immagini): riconoscimento del testo sulla pagina renderizzata.
        if let text = recognize(image) { pages.append(text) }
      }
    }
    let joined = pages.joined(separator: "\n\n")
    return joined.isEmpty ? nil : joined
  }

  private static func pageImage(_ page: PDFPage) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let scale = 2000 / max(bounds.width, bounds.height)
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    return page.thumbnail(of: size, for: .mediaBox).cgImage
  }

  private static func ocrText(_ url: URL) -> String? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
    return recognize(image)
  }

  private static func recognize(_ image: CGImage) -> String? {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    do {
      try VNImageRequestHandler(cgImage: image).perform([request])
    } catch {
      return nil
    }
    let items = (request.results ?? []).compactMap { observation -> OCRItem? in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      return OCRItem(text: text, box: observation.boundingBox)
    }
    return rowsText(items)
  }

  /// Ricostruisce le righe delle tabelle: Vision restituisce i blocchi per colonne (prima tutti i
  /// nomi, poi tutti i valori) e l'AI accoppiava i numeri sbagliati (es. TSH 24 invece di 1,8).
  /// Si raggruppano i blocchi alla stessa altezza e si leggono da sinistra a destra, separati da
  /// " | ": "TSH | 1,8 | mU/L | 0,4–4,0".
  static func rowsText(_ items: [OCRItem]) -> String? {
    // Coordinate di Vision: origine in basso a sinistra, quindi dall'alto = midY decrescente.
    let sorted = items.sorted { $0.box.midY > $1.box.midY }
    var rows: [[OCRItem]] = []
    for item in sorted {
      if var last = rows.last, !last.isEmpty {
        let mid = last.map { $0.box.midY }.reduce(0, +) / CGFloat(last.count)
        let height = last.map { $0.box.height }.reduce(0, +) / CGFloat(last.count)
        // Stessa riga se il centro è entro poco più di mezza altezza del testo.
        if abs(item.box.midY - mid) <= max(min(height, item.box.height) * 0.6, 0.004) {
          last.append(item)
          rows[rows.count - 1] = last
          continue
        }
      }
      rows.append([item])
    }
    let lines = rows.map { row in
      row.sorted { $0.box.minX < $1.box.minX }.map { $0.text }.joined(separator: " | ")
    }
    return lines.isEmpty ? nil : lines.joined(separator: "\n")
  }
}

/// Blocco di testo riconosciuto con la sua posizione (coordinate normalizzate di Vision).
struct OCRItem {
  let text: String
  let box: CGRect
}

private final class PreviewItem: NSObject, QLPreviewItem {
  let previewItemURL: URL?
  let previewItemTitle: String?

  init(url: URL, title: String?) {
    previewItemURL = url
    previewItemTitle = title
  }
}

private final class PreviewSource: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
  private let item: PreviewItem
  private let onDismiss: () -> Void

  init(url: URL, title: String?, onDismiss: @escaping () -> Void) {
    item = PreviewItem(url: url, title: title)
    self.onDismiss = onDismiss
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
    item
  }

  func previewControllerDidDismiss(_ controller: QLPreviewController) {
    onDismiss()
  }
}
