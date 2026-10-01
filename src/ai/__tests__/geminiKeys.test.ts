import { classifyHttpError, providerMessage } from '../errors';
import { extractKey } from '../registry';

describe('chiavi Gemini e errori del provider', () => {
  it('riconosce le nuove chiavi AQ. e le vecchie AIza', () => {
    const aq = 'AQ.Ab8RN6KxYz0123456789abcdefGHIJ_-klmn.opq';
    const aiza = 'AIzaSyD0123456789abcdefghijklmnopqrstuv';
    expect(extractKey('gemini', `  ${aq}\n`)).toBe(aq);
    expect(extractKey('gemini', aiza)).toBe(aiza);
    expect(extractKey('gemini', 'ciao mondo')).toBeNull();
  });

  it('fatturazione richiesta (Svizzera/UE) prima del "credito esaurito"', () => {
    const body = JSON.stringify({
      error: {
        code: 400,
        message:
          'Gemini API free tier is not available in your country. Please enable billing on your project in Google AI Studio.',
        status: 'FAILED_PRECONDITION',
      },
    });
    const e = classifyHttpError(400, body);
    expect(e.code).toBe('billing_required');
    expect(providerMessage(e)).toMatch(/^Gemini API free tier is not available/);
    expect(
      classifyHttpError(
        400,
        '{"error":{"message":"User location is not supported for the API use."}}',
      ).code,
    ).toBe('billing_required');
  });

  it('dettaglio leggibile anche da testo semplice', () => {
    expect(providerMessage(classifyHttpError(500, 'upstream timeout'))).toBe('upstream timeout');
  });
});
