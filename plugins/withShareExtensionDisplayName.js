/**
 * expo-share-intent usa `iosShareExtensionName` sia come nome del target Xcode sia come nome
 * mostrato nel menu "Condividi". Il target deve essere diverso da quello dell'app ("HealthCoach"),
 * altrimenti EAS assegna all'app il provisioning profile dell'estensione e la build di produzione
 * fallisce. Qui, a progetto generato, il nome mostrato torna "Health Coach".
 */
const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('@expo/config-plugins');

module.exports = function withShareExtensionDisplayName(config, { targetName, displayName }) {
  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        targetName,
        'ShareExtension-Info.plist',
      );
      if (fs.existsSync(file)) {
        const xml = fs.readFileSync(file, 'utf8');
        fs.writeFileSync(
          file,
          xml.replace(
            /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
            `$1${displayName}$2`,
          ),
        );
      }
      return cfg;
    },
  ]);
};
