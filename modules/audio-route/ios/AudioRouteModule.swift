import AVFoundation
import ExpoModulesCore

/// Conversazione a voce: WebRTC usa la modalità "voice chat", che su iPhone manda l'audio
/// all'auricolare (come una telefonata). Qui lo si porta sull'altoparlante, salvo cuffie collegate.
public class AudioRouteModule: Module {
  private var speakerOn = false
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AudioRoute")

    AsyncFunction("setSpeakerphone") { (on: Bool) in
      self.speakerOn = on
      self.apply()
      if on && self.observer == nil {
        // WebRTC riconfigura la sessione audio all'avvio e a ogni cambio di percorso: si riapplica.
        self.observer = NotificationCenter.default.addObserver(
          forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.apply() }
      } else if !on, let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
      }
    }

    OnDestroy {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
    }
  }

  private func apply() {
    let session = AVAudioSession.sharedInstance()
    let headphones = session.currentRoute.outputs.contains { output in
      [.headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .airPlay, .carAudio, .usbAudio]
        .contains(output.portType)
    }
    try? session.overrideOutputAudioPort(speakerOn && !headphones ? .speaker : .none)
  }
}
