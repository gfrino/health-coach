import CoreGraphics
import Foundation

/// Onde animate per il template vocale di CarPlay.
///
/// CarPlay non permette alle app vocali di disegnare liberamente sullo schermo dell'auto: ogni
/// stato del template ha una sola immagine, che però può essere animata. Qui si generano i
/// fotogrammi (solo CoreGraphics, così si possono vedere in anteprima anche su Mac):
/// - speaking: barre che si muovono a impulsi irregolari, come le sillabe del parlato;
/// - listening: onda morbida che scorre, più bassa;
/// - thinking: tre punti che pulsano in sequenza;
/// - connecting: un'onda luminosa che attraversa barre ferme;
/// - idle: barre basse e spente (in pausa).
enum CarWaveformKind: String, CaseIterable {
  case idle, connecting, listening, thinking, speaking
}

struct CarWaveforms {
  /// Dimensioni in punti e scala: 220×110 pt a 2x (schermi CarPlay) restano leggere in memoria.
  static let size = CGSize(width: 220, height: 110)
  static let scale: CGFloat = 2
  static let bars = 15

  /// Colori (RGBA): verde menta di AlbA su sfondo scuro di CarPlay.
  static let mint: [CGFloat] = [0.56, 0.83, 0.69, 1]
  static let mintSoft: [CGFloat] = [0.56, 0.83, 0.69, 0.45]
  static let white: [CGFloat] = [0.93, 0.96, 0.94, 1]
  static let dim: [CGFloat] = [0.56, 0.83, 0.69, 0.3]

  /// Numero di fotogrammi e durata del ciclo per ogni stato.
  static func timing(_ kind: CarWaveformKind) -> (frames: Int, duration: Double) {
    switch kind {
    case .idle: return (1, 1)
    case .connecting: return (16, 1.2)
    case .listening: return (24, 1.8)
    case .thinking: return (15, 1.2)
    case .speaking: return (32, 2.4)
    }
  }

  static func frames(_ kind: CarWaveformKind) -> [CGImage] {
    let (count, _) = timing(kind)
    return (0..<count).compactMap { frame(kind, t: Double($0) / Double(count)) }
  }

  /// Un fotogramma, con `t` da 0 a 1 lungo il ciclo (l'ultimo si ricollega al primo).
  static func frame(_ kind: CarWaveformKind, t: Double) -> CGImage? {
    let w = Int(size.width * scale)
    let h = Int(size.height * scale)
    guard
      let ctx = CGContext(
        data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return nil }
    ctx.scaleBy(x: scale, y: scale)
    switch kind {
    case .thinking: drawDots(ctx, t: t)
    default: drawBars(ctx, kind: kind, t: t)
    }
    return ctx.makeImage()
  }

  // MARK: - Barre

  private static func drawBars(_ ctx: CGContext, kind: CarWaveformKind, t: Double) {
    let barWidth: CGFloat = 8
    let gap = (size.width - CGFloat(bars) * barWidth) / CGFloat(bars + 1)
    let mid = size.height / 2
    let maxH = size.height * 0.86
    let minH: CGFloat = 8
    for i in 0..<bars {
      let x = gap + CGFloat(i) * (barWidth + gap)
      let pos = Double(i) / Double(bars - 1)
      // Più alte al centro, come una voce vista da vicino.
      let center = 0.35 + 0.65 * sin(.pi * pos)
      var level: Double
      var color = mint
      switch kind {
      case .idle:
        level = 0.08
        color = dim
      case .listening:
        // Onda che scorre lentamente: ascolto attento, poco movimento.
        let phase = 2 * .pi * (t - pos * 0.9)
        level = (0.12 + 0.3 * (0.5 + 0.5 * sin(phase))) * (0.45 + 0.55 * center)
        color = white
      case .connecting:
        // Una luce che attraversa barre ferme.
        let d = abs(pos - t)
        let glow = max(0, 1 - min(d, 1 - d) * 5)
        level = 0.12 + 0.18 * glow
        color = glow > 0.2 ? mint : mintSoft
      case .speaking:
        level = speech(t: t, pos: pos) * center
      case .thinking:
        level = 0
      }
      let barH = max(minH, CGFloat(level) * maxH)
      let rect = CGRect(x: x, y: mid - barH / 2, width: barWidth, height: barH)
      ctx.setFillColor(CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(), components: color)!)
      ctx.addPath(CGPath(roundedRect: rect, cornerWidth: barWidth / 2, cornerHeight: barWidth / 2, transform: nil))
      ctx.fillPath()
    }
  }

  /// Intensità del parlato: sillabe (impulsi) a intervalli irregolari ma ripetibili, con una
  /// pausa breve nel ciclo; ogni barra riceve l'impulso con un piccolo ritardo e una sua grana.
  static func speech(t: Double, pos: Double) -> Double {
    // Attacchi delle sillabe lungo il ciclo e la loro forza (una frase con una pausa).
    let syllables: [(at: Double, strength: Double)] = [
      (0.00, 0.85), (0.09, 0.6), (0.16, 1.0), (0.27, 0.7), (0.35, 0.9),
      (0.47, 0.45), (0.62, 0.95), (0.71, 0.65), (0.79, 0.8), (0.88, 0.55),
    ]
    let local = t - (pos - 0.5) * 0.06
    var env = 0.0
    for s in syllables {
      var d = local - s.at
      d -= floor(d)  // ciclo continuo
      // Attacco rapido, rilascio più lento: forma di una sillaba.
      let value = d < 0.025 ? d / 0.025 : exp(-(d - 0.025) * 18)
      env = max(env, s.strength * value)
    }
    // Grana diversa per barra, che cambia nel tempo: la voce non è mai liscia.
    let grain = 0.75 + 0.25 * sin(2 * .pi * (t * 3 + pos * 7.3)) * sin(2 * .pi * (t * 5 + pos * 2.1))
    return max(0.1, min(1, 0.1 + env * grain))
  }

  // MARK: - Punti

  private static func drawDots(_ ctx: CGContext, t: Double) {
    let r: CGFloat = 9
    let spacing: CGFloat = 34
    let mid = CGPoint(x: size.width / 2, y: size.height / 2)
    for i in 0..<3 {
      // Ogni punto pulsa a turno.
      let phase = t - Double(i) / 3
      let p = 0.5 + 0.5 * cos(2 * .pi * phase)
      let grow = CGFloat(0.7 + 0.5 * p)
      let alpha = CGFloat(0.35 + 0.65 * p)
      let x = mid.x + CGFloat(i - 1) * spacing
      let rect = CGRect(x: x - r * grow, y: mid.y - r * grow, width: 2 * r * grow, height: 2 * r * grow)
      ctx.setFillColor(
        CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(), components: [mint[0], mint[1], mint[2], alpha])!)
      ctx.fillEllipse(in: rect)
    }
  }
}
