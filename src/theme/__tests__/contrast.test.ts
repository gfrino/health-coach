import { contrastRatio } from '../contrast';
import { palettes } from '../tokens';

const AA = 4.5;

describe.each(Object.entries(palettes))('palette %s — contrasto WCAG AA', (_scheme, p) => {
  const pairs: [string, string, string][] = [
    ['text/background', p.text, p.background],
    ['text/surface', p.text, p.surface],
    ['text/surfaceAlt', p.text, p.surfaceAlt],
    ['textMuted/background', p.textMuted, p.background],
    ['textMuted/surface', p.textMuted, p.surface],
    ['onPrimary/primary', p.onPrimary, p.primary],
    ['primary/background', p.primary, p.background],
    ['primary/surface', p.primary, p.surface],
    ['danger/background', p.danger, p.background],
    ['danger-button', p.background, p.danger],
    ['warning/warningSoft', p.warning, p.warningSoft],
    ['text/warningSoft', p.text, p.warningSoft],
    ['text/primarySoft', p.text, p.primarySoft],
    ['textMuted/tabBar', p.textMuted, p.tabBar],
  ];
  it.each(pairs)('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});
