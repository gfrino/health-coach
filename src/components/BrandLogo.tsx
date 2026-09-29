import { SymbolView } from 'expo-symbols';
import { Image, Platform, View } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';

import { BRAND_GLYPHS } from '@/integrations/brandIcons.generated';
import { getIntegration } from '@/integrations/integrationsCatalog';
import { LOGO_ASSETS, LOGO_SVGS } from '@/integrations/logoAssets';
import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props {
  /** id del catalogo integrazioni (es. 'gemini', 'apple_health', 'device'). */
  id: string;
  size?: number;
}

/** Glifi con un altro id nel catalogo. */
const ALIASES: Record<string, string> = { chatgpt_account: 'openai' };

/**
 * Logo di un'integrazione. Priorità: file ufficiale (assets/logos) → simbolo di sistema /
 * glifo ufficiale Simple Icons nel colore del marchio → badge con iniziale.
 * Decorativo per gli screen reader: il nome è sempre scritto accanto.
 */
export function BrandLogo({ id, size = 40 }: Props) {
  const { colors } = useTheme();
  const radius = Math.round(size * 0.24);
  const key = ALIASES[id] ?? id;
  const tile = {
    width: size,
    height: size,
    borderRadius: radius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  // Loghi ufficiali su riquadro bianco ("contain" mantiene interi anche i loghi orizzontali).
  const whiteTile = [
    tile,
    { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  ];
  const svg = LOGO_SVGS[id] ?? LOGO_SVGS[key];
  if (svg) {
    return (
      <View style={whiteTile} accessible={false}>
        <SvgXml xml={svg} width={size * 0.72} height={size * 0.72} />
      </View>
    );
  }
  const asset = LOGO_ASSETS[id] ?? LOGO_ASSETS[key];
  if (asset) {
    return (
      <View style={whiteTile} accessible={false}>
        <Image
          source={asset}
          resizeMode="contain"
          style={{ width: size * 0.8, height: size * 0.8 }}
        />
      </View>
    );
  }

  // AI del telefono: simbolo ufficiale Apple Intelligence su iOS, Gemini (Nano) su Android.
  if (id === 'device' && Platform.OS === 'ios') {
    return (
      <View
        style={[tile, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border }]}
        accessible={false}
      >
        <SymbolView
          name="apple.intelligence"
          type="multicolor"
          size={size * 0.62}
          tintColor="#8E5CF7"
        />
      </View>
    );
  }

  const glyph = BRAND_GLYPHS[id === 'device' ? 'device_android' : key];
  if (glyph) {
    return (
      <View
        style={[tile, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border }]}
        accessible={false}
      >
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
          <Path d={glyph.path} fill={glyph.hex} />
        </Svg>
      </View>
    );
  }

  const integration = getIntegration(key);
  return (
    <View
      style={[tile, { backgroundColor: integration?.color ?? colors.primary }]}
      accessible={false}
    >
      <AppText
        variant="headline"
        style={{ color: '#FFFFFF', fontSize: size * 0.45, lineHeight: size * 0.56 }}
      >
        {(integration?.name ?? id).charAt(0)}
      </AppText>
    </View>
  );
}
