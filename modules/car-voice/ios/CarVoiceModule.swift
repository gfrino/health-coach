import ExpoModulesCore

struct CarVoiceTextsRecord: Record {
  @Field var appTitle: String = "AlbA"
  @Field var talk: String = ""
  @Field var states: [String: String] = [:]
  @Field var ok: String = "OK"
}

/// Ponte JS ↔ CarPlay: tocchi sullo schermo dell'auto verso JS, stati della conversazione verso CarPlay.
public class CarVoiceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CarVoice")

    Events("onAction", "onConnection", "onVisibility")

    OnStartObserving {
      let bridge = CarVoiceBridge.shared
      bridge.onAction = { [weak self] action in self?.sendEvent("onAction", ["action": action]) }
      bridge.onConnection = { [weak self] connected in
        self?.sendEvent("onConnection", ["connected": connected])
      }
      bridge.onVisibility = { [weak self] visible in
        self?.sendEvent("onVisibility", ["visible": visible])
      }
    }

    OnStopObserving {
      CarVoiceBridge.shared.onAction = nil
      CarVoiceBridge.shared.onConnection = nil
      CarVoiceBridge.shared.onVisibility = nil
    }

    // Lettura semplice: aggiornata sul main thread da connect/disconnect.
    Function("isConnected") { () -> Bool in
      return CarVoiceBridge.shared.isConnected
    }

    /// AlbA in primo piano sullo schermo dell'auto.
    Function("isVisible") { () -> Bool in
      return CarVoiceBridge.shared.isVisible
    }

    AsyncFunction("setTexts") { (texts: CarVoiceTextsRecord) in
      CarVoiceBridge.shared.setTexts(
        CarVoiceTexts(appTitle: texts.appTitle, talk: texts.talk, states: texts.states, ok: texts.ok))
    }.runOnQueue(.main)

    AsyncFunction("setState") { (state: String, muted: Bool) in
      _ = muted
      CarVoiceBridge.shared.setState(state)
    }.runOnQueue(.main)

    AsyncFunction("showMessage") { (message: String) in
      CarVoiceBridge.shared.showMessage(message)
    }.runOnQueue(.main)

    AsyncFunction("close") { () in
      CarVoiceBridge.shared.close()
    }.runOnQueue(.main)
  }
}
