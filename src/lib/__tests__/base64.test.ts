import { base64ToBytes, bytesToBase64 } from '../base64';

describe('base64', () => {
  it('andata e ritorno, anche con il prefisso data: delle immagini incollate', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 250]);
    const b64 = bytesToBase64(bytes);
    expect(base64ToBytes(b64)).toEqual(bytes);
    expect(base64ToBytes(`data:image/jpeg;base64,${b64}`)).toEqual(bytes);
  });
});
