/**
 * Correzioni all'estensione di condivisione generata da expo-share-intent, applicate a progetto
 * generato (finalized mod, dopo tutti gli altri plugin):
 *
 * 1. Nome nel menu "Condividi": il plugin usa `iosShareExtensionName` sia per il target Xcode sia
 *    per il nome mostrato. Il target deve differire dall'app ("HealthCoach"), altrimenti EAS
 *    assegna all'app il provisioning profile dell'estensione; qui il nome mostrato torna quello voluto.
 *
 * 2. PDF + testo (es. Withings condivide il referto insieme a un testo): l'estensione salva ogni
 *    elemento sotto la stessa chiave e apre l'app con il tipo dell'ULTIMO elemento, quindi il testo
 *    sovrascriveva il PDF. Si elaborano prima testi e link, per ultimi i file.
 */
const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('@expo/config-plugins');

const LOOP = 'for (index, attachment) in (attachments).enumerated() {';
const SORTED_LOOP = `// Health Coach: testi e link prima, file per ultimi (il file non viene sovrascritto).
      let isTextOrUrl = { (a: NSItemProvider) -> Bool in
        !a.hasItemConformingToTypeIdentifier(self.fileURLType)
          && !a.hasItemConformingToTypeIdentifier(self.pdfContentType)
          && !a.hasItemConformingToTypeIdentifier(self.imageContentType)
          && !a.hasItemConformingToTypeIdentifier(self.videoContentType)
          && (a.hasItemConformingToTypeIdentifier(self.urlContentType)
            || a.hasItemConformingToTypeIdentifier(self.textContentType))
      }
      let ordered = attachments.filter(isTextOrUrl) + attachments.filter { !isTextOrUrl($0) }
      for (index, attachment) in ordered.enumerated() {`;

module.exports = function withShareExtensionFixes(config, { targetName, displayName }) {
  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, targetName);

      const plist = path.join(dir, 'ShareExtension-Info.plist');
      if (fs.existsSync(plist)) {
        const xml = fs.readFileSync(plist, 'utf8');
        fs.writeFileSync(
          plist,
          xml.replace(
            /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
            `$1${displayName}$2`,
          ),
        );
      }

      const swift = path.join(dir, 'ShareViewController.swift');
      if (fs.existsSync(swift)) {
        const code = fs.readFileSync(swift, 'utf8');
        if (!code.includes('Health Coach: testi e link prima')) {
          if (!code.includes(LOOP)) {
            throw new Error(
              'withShareExtensionFixes: expo-share-intent è cambiato, aggiornare la patch del ciclo degli allegati',
            );
          }
          fs.writeFileSync(swift, code.replace(LOOP, SORTED_LOOP));
        }
      }
      return cfg;
    },
  ]);
};
