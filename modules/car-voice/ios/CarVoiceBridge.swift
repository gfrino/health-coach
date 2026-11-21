import CarPlay
import UIKit

/// Coach vocale su CarPlay (categoria "voice-based conversational app", iOS 26.4+).
///
/// Il nativo mostra solo i template; la conversazione (riconoscimento, AI, voce) gira in JS
/// come sul telefono. Il delegate della scena CarPlay (target dell'app, vedi plugins/withCarPlay.js)
/// chiama `connect`/`disconnect`; il modulo Expo inoltra i tocchi a JS e riceve gli stati.
public final class CarVoiceBridge: NSObject {
  public static let shared = CarVoiceBridge()

  public private(set) var interfaceController: CPInterfaceController?
  var onAction: ((String) -> Void)?
  var onConnection: ((Bool) -> Void)?

  /// Testi tradotti mandati da JS; finché non arrivano si usano questi (italiano).
  var texts = CarVoiceTexts.fallback
  private var voiceTemplate: CPVoiceControlTemplate?
  private var voicePresented = false
  private var presenting = false
  private var pendingState: String?

  public var isConnected: Bool { interfaceController != nil }

  // MARK: - Ciclo di vita della scena

  public func connect(_ controller: CPInterfaceController) {
    interfaceController = controller
    controller.setRootTemplate(makeRootTemplate(), animated: false, completion: nil)
    onConnection?(true)
  }

  public func disconnect() {
    interfaceController = nil
    voiceTemplate = nil
    voicePresented = false
    presenting = false
    pendingState = nil
    onConnection?(false)
  }

  // MARK: - Chiamate da JS (sempre sul main thread)

  func setTexts(_ newTexts: CarVoiceTexts) {
    texts = newTexts
    // Il template vocale ha i titoli fissati alla creazione: lo si ricrea alla prossima apertura.
    if !voicePresented { voiceTemplate = nil }
    if let controller = interfaceController, !voicePresented {
      controller.setRootTemplate(makeRootTemplate(), animated: false, completion: nil)
    }
  }

  func setState(_ state: String) {
    guard let controller = interfaceController else { return }
    if voicePresented, let template = voiceTemplate {
      template.activateVoiceControlState(withIdentifier: state)
      return
    }
    // Il template si attiva solo dopo la presentazione: lo stato aspetta in pendingState.
    pendingState = state
    if presenting { return }
    presenting = true
    let template = makeVoiceTemplate()
    voiceTemplate = template
    present(template, on: controller) { [weak self] ok in
      guard let self else { return }
      self.presenting = false
      guard ok, self.voiceTemplate === template else { return }
      self.voicePresented = true
      if let pending = self.pendingState { template.activateVoiceControlState(withIdentifier: pending) }
      self.pendingState = nil
    }
  }

  func showMessage(_ message: String) {
    guard let controller = interfaceController else { return }
    let alert = CPAlertTemplate(
      titleVariants: [message],
      actions: [
        CPAlertAction(title: texts.ok, style: .default) { _ in
          controller.dismissTemplate(animated: true, completion: nil)
        }
      ])
    voicePresented = false
    voiceTemplate = nil
    present(alert, on: controller, completion: nil)
  }

  func close() {
    guard let controller = interfaceController, controller.presentedTemplate != nil else { return }
    voicePresented = false
    voiceTemplate = nil
    pendingState = nil
    controller.dismissTemplate(animated: true, completion: nil)
  }

  // MARK: - Template

  /// Se c'è già un template presentato (un solo modale alla volta) lo si chiude prima.
  private func present(
    _ template: CPTemplate, on controller: CPInterfaceController, completion: ((Bool) -> Void)?
  ) {
    let show = {
      controller.presentTemplate(template, animated: true) { ok, _ in completion?(ok) }
    }
    if controller.presentedTemplate != nil {
      controller.dismissTemplate(animated: false) { _, _ in show() }
    } else {
      show()
    }
  }

  private func makeRootTemplate() -> CPListTemplate {
    let talk = CPListItem(
      text: texts.talk, detailText: nil, image: UIImage(systemName: "waveform.circle.fill"))
    talk.handler = { [weak self] _, completion in
      self?.onAction?("start")
      completion()
    }
    let template = CPListTemplate(title: texts.appTitle, sections: [CPListSection(items: [talk])])
    return template
  }

  private func makeVoiceTemplate() -> CPVoiceControlTemplate {
    let symbols: [(String, String)] = [
      ("idle", "mic.circle"),
      ("connecting", "antenna.radiowaves.left.and.right"),
      ("listening", "waveform"),
      ("thinking", "ellipsis.circle"),
      ("speaking", "person.wave.2"),
    ]
    let config = UIImage.SymbolConfiguration(pointSize: 90, weight: .regular)
    let states = symbols.map { id, symbol -> CPVoiceControlState in
      let state = CPVoiceControlState(
        identifier: id,
        titleVariants: [texts.states[id] ?? id],
        image: UIImage(systemName: symbol, withConfiguration: config),
        repeats: true)
      if #available(iOS 26.4, *) {
        state.actionButtons = actionButtons()
      }
      return state
    }
    return CPVoiceControlTemplate(voiceControlStates: states)
  }

  /// Microfono (parla / interrompi / riprendi), pausa e fine. Solo da iOS 26.4.
  private func actionButtons() -> [CPButton] {
    let config = UIImage.SymbolConfiguration(pointSize: 28, weight: .semibold)
    func button(_ symbol: String, _ action: String) -> CPButton {
      CPButton(image: UIImage(systemName: symbol, withConfiguration: config) ?? UIImage()) {
        [weak self] _ in self?.onAction?(action)
      }
    }
    return [button("mic.fill", "tap"), button("pause.fill", "mute"), button("xmark", "end")]
  }
}

struct CarVoiceTexts {
  var appTitle: String
  var talk: String
  var states: [String: String]
  var ok: String

  static let fallback = CarVoiceTexts(
    appTitle: "AlbA",
    talk: "Parla con il coach",
    states: [
      "idle": "In pausa",
      "connecting": "Mi collego…",
      "listening": "Ti ascolto",
      "thinking": "Ci penso…",
      "speaking": "Coach",
    ],
    ok: "OK")
}
