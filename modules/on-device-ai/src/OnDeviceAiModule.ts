import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { OnDeviceAiModuleEvents, OnDeviceAvailability } from './OnDeviceAi.types';

declare class OnDeviceAiModule extends NativeModule<OnDeviceAiModuleEvents> {
  getAvailability(): Promise<OnDeviceAvailability>;
  download(): Promise<void>;
  generate(requestId: string, instructions: string, prompt: string): Promise<string>;
  cancel(requestId: string): Promise<void>;
}

/** `null` se il modulo nativo non è presente (es. test, web, build vecchia). */
export default requireOptionalNativeModule<OnDeviceAiModule>('OnDeviceAi');
