import ExpoModulesCore
import QuickLook

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
  }
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
