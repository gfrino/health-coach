import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { create } from 'zustand';

import { getDb, profileRepository } from '@/db';
import { bytesToBase64 } from '@/lib/base64';

/**
 * Foto del profilo: si sceglie dalla libreria o si scatta, ritagliata quadrata, ridotta a 512 px
 * e salvata nel DB cifrato. La copia in memoria (data URI) serve a profilo e menu laterale.
 */

const SIDE = 512;

export const useProfilePhoto = create<{ uri: string | null; loaded: boolean }>(() => ({
  uri: null,
  loaded: false,
}));

const toUri = (bytes: Uint8Array | null) =>
  bytes && bytes.length ? `data:image/jpeg;base64,${bytesToBase64(bytes)}` : null;

export async function loadProfilePhoto(): Promise<void> {
  if (useProfilePhoto.getState().loaded) return;
  const photo = await profileRepository.getPhoto(await getDb());
  useProfilePhoto.setState({ uri: toUri(photo), loaded: true });
}

/** Ridimensiona a 512 px (se il modulo nativo c'è: nelle build più vecchie no) e restituisce i byte. */
async function shrink(uri: string): Promise<Uint8Array> {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- modulo nativo assente nelle build più vecchie */
    const { ImageManipulator, SaveFormat } =
      require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const image = await ImageManipulator.manipulate(uri).resize({ width: SIDE }).renderAsync();
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return new Uint8Array(await new File(out.uri).arrayBuffer());
  } catch {
    return new Uint8Array(await new File(uri).arrayBuffer());
  }
}

/** Sceglie o scatta la foto e la salva. Restituisce false se l'utente annulla. */
export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<boolean> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('permission_denied');
  }
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return false;
  const bytes = await shrink(asset.uri);
  await profileRepository.setPhoto(await getDb(), bytes);
  useProfilePhoto.setState({ uri: toUri(bytes), loaded: true });
  return true;
}

export async function removeProfilePhoto(): Promise<void> {
  await profileRepository.setPhoto(await getDb(), null);
  useProfilePhoto.setState({ uri: null, loaded: true });
}
