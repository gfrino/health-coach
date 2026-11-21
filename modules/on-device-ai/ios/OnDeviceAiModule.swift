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
        var result = Self.deviceAvailability()
        result["pcc"] = Self.pccAvailability()
        return result
      }
      #endif
      return ["status": "unavailable", "reason": "unsupportedOS", "engine": "apple", "pcc": "unsupportedOS"]
    }

    // Su iOS il download del modello è gestito dal sistema (Apple Intelligence).
    AsyncFunction("download") { () in }

    AsyncFunction("cancel") { (requestId: String) in
      self.lock.lock()
      self.cancelled.insert(requestId)
      self.lock.unlock()
    }

    AsyncFunction("generate") { (requestId: String, instructions: String, prompt: String) async throws -> String in
      try await self.run(requestId: requestId, instructions: instructions, prompt: prompt, pcc: false)
    }

    /// Come generate, scegliendo il modello: "pcc" (Private Cloud Compute, iOS 27) o "device".
    AsyncFunction("generateWith") {
      (requestId: String, instructions: String, prompt: String, engine: String) async throws -> String in
      try await self.run(requestId: requestId, instructions: instructions, prompt: prompt, pcc: engine == "pcc")
    }
  }

  private func run(requestId: String, instructions: String, prompt: String, pcc: Bool) async throws -> String {
    defer { self.clear(requestId) }
    #if canImport(FoundationModels)
    if pcc {
      if #available(iOS 27.0, *), Self.pccAllowed {
        let session = LanguageModelSession(
          model: PrivateCloudComputeLanguageModel(), instructions: instructions)
        do {
          return try await self.stream(session, requestId: requestId, prompt: prompt)
        } catch let error as PrivateCloudComputeLanguageModel.Error {
          throw Self.mapPcc(error)
        } catch let error as LanguageModelSession.GenerationError {
          throw Self.map(error)
        } catch let error as OnDeviceAiError {
          throw error
        } catch {
          throw OnDeviceAiError("pcc_unavailable", error.localizedDescription)
        }
      }
      throw OnDeviceAiError("pcc_unavailable", "Private Cloud Compute not available")
    }
    if #available(iOS 26.0, *) {
      let session = LanguageModelSession(instructions: instructions)
      do {
        return try await self.stream(session, requestId: requestId, prompt: prompt)
      } catch let error as LanguageModelSession.GenerationError {
        throw Self.map(error)
      }
    }
    #endif
    throw OnDeviceAiError("unavailable", "On-device model not available on this OS version")
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private func stream(_ session: LanguageModelSession, requestId: String, prompt: String) async throws -> String {
    var text = ""
    for try await snapshot in session.streamResponse(to: prompt) {
      if self.isCancelled(requestId) { break }
      text = snapshot.content
      self.sendEvent("onToken", ["requestId": requestId, "text": text])
    }
    return text
  }

  /// PCC solo se la build ha l'entitlement (flag nell'Info.plist, vedi app.config.ts):
  /// senza, il primo prompt farebbe chiudere l'app.
  static var pccAllowed: Bool {
    (Bundle.main.object(forInfoDictionaryKey: "AlbAPrivateCloudCompute") as? Bool) == true
  }

  @available(iOS 26.0, *)
  private static func deviceAvailability() -> [String: String] {
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

  /// "available", "quota" (limite giornaliero raggiunto), "deviceNotEligible", "systemNotReady",
  /// "notEntitled" (build senza permesso) o "unsupportedOS" (prima di iOS 27).
  private static func pccAvailability() -> String {
    guard pccAllowed else { return "notEntitled" }
    if #available(iOS 27.0, *) {
      let model = PrivateCloudComputeLanguageModel()
      switch model.availability {
      case .available:
        return model.quotaUsage.isLimitReached ? "quota" : "available"
      case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible: return "deviceNotEligible"
        case .systemNotReady: return "systemNotReady"
        @unknown default: return "systemNotReady"
        }
      }
    }
    return "unsupportedOS"
  }

  @available(iOS 27.0, *)
  private static func mapPcc(_ error: PrivateCloudComputeLanguageModel.Error) -> OnDeviceAiError {
    switch error {
    case .quotaLimitReached:
      return OnDeviceAiError("pcc_quota", error.localizedDescription)
    case .networkFailure:
      return OnDeviceAiError("pcc_network", error.localizedDescription)
    case .serviceUnavailable:
      return OnDeviceAiError("pcc_unavailable", error.localizedDescription)
    @unknown default:
      return OnDeviceAiError("pcc_unavailable", error.localizedDescription)
    }
  }

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
