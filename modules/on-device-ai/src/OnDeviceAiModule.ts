import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { OnDeviceAiModuleEvents, OnDeviceAvailability } from './OnDeviceAi.types';

declare class OnDeviceAiModule extends NativeModule<OnDeviceAiModuleEvents> {
  getAvailability(): Promise<OnDeviceAvailability>;
  download(): Promise<void>;
  generate(requestId: string, instructions: string, prompt: string): Promise<string>;
  /** Dalla build 1.41.0 (iOS): `engine` "pcc" usa Private Cloud Compute. Assente prima. */
  generateWith?(
    requestId: string,
    instructions: string,
    prompt: string,
    engine: 'pcc' | 'device',
  ): Promise<string>;
  cancel(requestId: string): Promise<void>;
}

/** `null` se il modulo nativo non è presente (es. test, web, build vecchia). */
export default requireOptionalNativeModule<OnDeviceAiModule>('OnDeviceAi');
