import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class AudioRouteModule extends NativeModule {
  /** true → altoparlante del telefono; false → percorso di sistema (auricolare, cuffie, AirPods). */
  setSpeakerphone(on: boolean): Promise<void>;
}

/** `null` se il modulo nativo non è presente (test, build vecchia). */
export default requireOptionalNativeModule<AudioRouteModule>('AudioRoute');
