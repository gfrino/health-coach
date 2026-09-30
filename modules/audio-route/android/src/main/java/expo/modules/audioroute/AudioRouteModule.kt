package expo.modules.audioroute

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Conversazione a voce: audio sull'altoparlante (salvo cuffie), modalità comunicazione per l'eco. */
class AudioRouteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioRoute")

    AsyncFunction("setSpeakerphone") { on: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (on) {
          val headset = audio.availableCommunicationDevices.firstOrNull {
            it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
              it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
              it.type == AudioDeviceInfo.TYPE_BLE_HEADSET
          }
          val target = headset ?: audio.availableCommunicationDevices.firstOrNull {
            it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
          }
          if (target != null) audio.setCommunicationDevice(target)
        } else {
          audio.clearCommunicationDevice()
        }
      } else {
        @Suppress("DEPRECATION")
        audio.isSpeakerphoneOn = on && !audio.isWiredHeadsetOn && !audio.isBluetoothScoOn
      }
    }
  }
}
