package expo.modules.ondeviceai

import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/** Gemini Nano tramite ML Kit GenAI Prompt API (AICore): tutto resta sul dispositivo. */
class OnDeviceAiModule : Module() {
  private val model: GenerativeModel by lazy { Generation.getClient() }
  private val jobs = ConcurrentHashMap<String, Job>()

  override fun definition() = ModuleDefinition {
    Name("OnDeviceAi")

    Events("onToken", "onDownloadProgress")

    AsyncFunction("getAvailability") Coroutine { ->
      try {
        when (model.checkStatus()) {
          FeatureStatus.AVAILABLE -> mapOf("status" to "available", "engine" to "gemini-nano")
          FeatureStatus.DOWNLOADABLE -> mapOf("status" to "downloadable", "engine" to "gemini-nano")
          FeatureStatus.DOWNLOADING -> mapOf("status" to "downloading", "engine" to "gemini-nano")
          else -> mapOf("status" to "unavailable", "reason" to "deviceNotEligible", "engine" to "gemini-nano")
        }
      } catch (e: Exception) {
        mapOf("status" to "unavailable", "reason" to "deviceNotEligible", "engine" to "gemini-nano")
      }
    }

    AsyncFunction("download") Coroutine { ->
      var failure: String? = null
      model.download().collect { status ->
        when (status) {
          is DownloadStatus.DownloadStarted -> sendEvent("onDownloadProgress", mapOf("bytes" to 0.0))
          is DownloadStatus.DownloadProgress ->
            sendEvent("onDownloadProgress", mapOf("bytes" to status.totalBytesDownloaded.toDouble()))
          DownloadStatus.DownloadCompleted -> sendEvent("onDownloadProgress", mapOf("done" to true))
          is DownloadStatus.DownloadFailed -> failure = status.e.message ?: "download failed"
        }
      }
      failure?.let { throw CodedException("download_failed", it, null) }
    }

    AsyncFunction("cancel") { requestId: String ->
      jobs.remove(requestId)?.cancel()
    }

    AsyncFunction("generate") Coroutine { requestId: String, instructions: String, prompt: String ->
      // La Prompt API non ha un campo "system": le istruzioni precedono il prompt.
      val fullPrompt = "$instructions\n\n$prompt"
      val text = StringBuilder()
      try {
        coroutineScope {
          val job = launch {
            model.generateContentStream(fullPrompt).collect { chunk ->
              text.append(chunk.candidates.firstOrNull()?.text ?: "")
              sendEvent("onToken", mapOf("requestId" to requestId, "text" to text.toString()))
            }
          }
          jobs[requestId] = job
          job.join()
        }
      } catch (e: CancellationException) {
        // Annullata dall'utente: restituisce il testo parziale.
      } catch (e: Exception) {
        val msg = e.message ?: "generation failed"
        val code = when {
          msg.contains("quota", ignoreCase = true) || msg.contains("busy", ignoreCase = true) -> "rate_limited"
          msg.contains("token", ignoreCase = true) && msg.contains("limit", ignoreCase = true) -> "context_window"
          else -> "unknown"
        }
        throw CodedException(code, msg, e)
      } finally {
        jobs.remove(requestId)
      }
      text.toString()
    }
  }
}
