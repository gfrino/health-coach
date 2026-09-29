import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Errore con codice leggibile da JS (error.code).
final class OnDeviceAiError: Exception, @unchecked Sendable {
  private let errorCode: String
  private let message: String

  init(_ code: String, _ message: String) {
    self.errorCode = code
    self.message = message
    super.init()
  }

  override var code: String { errorCode }
  override var reason: String { message }
}

/// Modello linguistico di sistema (Apple Foundation Models, iOS 26+): tutto resta sul dispositivo.
public class OnDeviceAiModule: Module {
  private let lock = NSLock()
  private var cancelled = Set<String>()

  private func isCancelled(_ id: String) -> Bool {
    lock.lock(); defer { lock.unlock() }
    return cancelled.contains(id)
  }

  private func clear(_ id: String) {
    lock.lock(); defer { lock.unlock() }
    cancelled.remove(id)
  }

  public func definition() -> ModuleDefinition {
    Name("OnDeviceAi")

    Events("onToken", "onDownloadProgress")

    AsyncFunction("getAvailability") { () -> [String: String] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
          return ["status": "available", "engine": "apple"]
        case .unavailable(let reason):
          switch reason {
          case .deviceNotEligible:
            return ["status": "unavailable", "reason": "deviceNotEligible", "engine": "apple"]
          case .appleIntelligenceNotEnabled:
            return ["status": "unavailable", "reason": "notEnabled", "engine": "apple"]
          case .modelNotReady:
            return ["status": "downloading", "reason": "modelNotReady", "engine": "apple"]
          @unknown default:
            return ["status": "unavailable", "reason": "unknown", "engine": "apple"]
          }
        }
      }
      #endif
      return ["status": "unavailable", "reason": "unsupportedOS", "engine": "apple"]
    }

    // Su iOS il download del modello è gestito dal sistema (Apple Intelligence).
    AsyncFunction("download") { () in }

    AsyncFunction("cancel") { (requestId: String) in
      self.lock.lock()
      self.cancelled.insert(requestId)
      self.lock.unlock()
    }

    AsyncFunction("generate") { (requestId: String, instructions: String, prompt: String) async throws -> String in
      defer { self.clear(requestId) }
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let session = LanguageModelSession(instructions: instructions)
        var text = ""
        do {
          for try await snapshot in session.streamResponse(to: prompt) {
            if self.isCancelled(requestId) { break }
            text = snapshot.content
            self.sendEvent("onToken", ["requestId": requestId, "text": text])
          }
        } catch let error as LanguageModelSession.GenerationError {
          throw Self.map(error)
        }
        return text
      }
      #endif
      throw OnDeviceAiError("unavailable", "On-device model not available on this OS version")
    }
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func map(_ error: LanguageModelSession.GenerationError) -> OnDeviceAiError {
    switch error {
    case .guardrailViolation:
      return OnDeviceAiError("guardrail", error.localizedDescription)
    case .refusal:
      return OnDeviceAiError("refused", error.localizedDescription)
    case .exceededContextWindowSize:
      return OnDeviceAiError("context_window", error.localizedDescription)
    case .unsupportedLanguageOrLocale:
      return OnDeviceAiError("unsupported_language", error.localizedDescription)
    case .rateLimited:
      return OnDeviceAiError("rate_limited", error.localizedDescription)
    case .concurrentRequests:
      return OnDeviceAiError("busy", error.localizedDescription)
    case .assetsUnavailable:
      return OnDeviceAiError("unavailable", error.localizedDescription)
    default:
      return OnDeviceAiError("unknown", error.localizedDescription)
    }
  }
  #endif
}
