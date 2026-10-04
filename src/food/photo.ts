import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { ImagePart } from '@/ai/types';

/**
 * Foto del piatto per il diario alimentare: scattata o scelta dalla galleria, rimpicciolita e
 * mandata solo all'AI per la stima. Non viene salvata da nessuna parte (né nella Cartella né
 * nel diario): resta in memoria il tempo della richiesta.
 */

/** Lato lungo: abbastanza per riconoscere i cibi, leggera da inviare. */
const MAX_SIDE = 1024;

export interface FoodPhoto {
  /** Anteprima a schermo (file temporaneo del sistema). */
  uri: string;
  image: ImagePart;
}

export async function pickFoodPhoto(source: 'camera' | 'library'): Promise<FoodPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('permission_denied');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;

  const long = Math.max(asset.width, asset.height);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (long > MAX_SIDE)
    ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) return null;
  return { uri: out.uri, image: { mimeType: 'image/jpeg', base64: out.base64 } };
}
