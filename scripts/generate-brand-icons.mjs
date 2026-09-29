// Genera src/integrations/brandIcons.generated.ts con i soli loghi necessari,
// presi da Simple Icons (CC0: https://simpleicons.org). Eseguire: npm run icons
import { writeFileSync } from 'node:fs';
import * as icons from 'simple-icons';

/** id integrazione → slug Simple Icons */
const MAP = {
  gemini: 'googlegemini',
  anthropic: 'claude',
  fitbit: 'fitbit',
  garmin: 'garmin',
  strava: 'strava',
  kimi: 'kimi',
  device_android: 'googlegemini',
};

const out = {};
for (const [id, slug] of Object.entries(MAP)) {
  const key = `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  const icon = icons[key];
  if (!icon) throw new Error(`Simple Icons: logo "${slug}" non trovato`);
  out[id] = { title: icon.title, hex: `#${icon.hex}`, path: icon.path };
}

const body = `// File generato da scripts/generate-brand-icons.mjs — non modificare a mano.
// Loghi: Simple Icons (CC0). I marchi appartengono ai rispettivi proprietari.
export interface BrandGlyph {
  title: string;
  hex: string;
  /** Path SVG su viewBox 0 0 24 24. */
  path: string;
}

export const BRAND_GLYPHS: Record<string, BrandGlyph> = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(new URL('../src/integrations/brandIcons.generated.ts', import.meta.url), body);
console.log(`Generati ${Object.keys(out).length} loghi`);
