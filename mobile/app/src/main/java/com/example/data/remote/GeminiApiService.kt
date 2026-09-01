package com.example.data.remote

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Gateway for AI operations across StuddyHub.
 *
 * In alignment with the security architecture, ALL AI operations are securely routed through
 * Supabase Edge Functions (`gemini-chat`, `document-processor`, `generate-summary`, `generate-flashcards`, etc.),
 * where service tokens, rate-limits, and model keys are managed server-side.
 */
object GeminiApiService {

    private const val TAG = "GeminiApiService"

    /**
     * Analyze a file (base64 encoded) via the backend document processor edge function.
     */
    suspend fun analyzeFile(base64Data: String, mimeType: String, prompt: String): String = withContext(Dispatchers.IO) {
        val effectivePrompt = prompt.ifBlank { "Extract and structure all content from this document clearly into formatted markdown notes." }
        try {
            Log.d(TAG, "Executing document extraction via backend document-processor for mimeType: $mimeType")
            val payload = JSONObject().apply {
                put("userId", BackendApiService.currentUserId ?: "")
                put("skipDbSave", true)
                put("files", JSONArray().apply {
                    put(JSONObject().apply {
                        put("name", "document_${System.currentTimeMillis()}")
                        put("mimeType", mimeType)
                        put("data", base64Data)
                        put("prompt", effectivePrompt)
                    })
                })
            }

            val result = BackendApiService.executeEdgeFunction("document-processor", payload)
            if (result is BackendResult.Success) {
                val docs = result.data.optJSONArray("documents") ?: result.data.optJSONArray("savedDocuments")
                if (docs != null && docs.length() > 0) {
                    val firstDoc = docs.getJSONObject(0)
                    val extracted = firstDoc.optString("content_extracted", "")
                        .ifBlank { firstDoc.optString("content", "") }
                        .ifBlank { firstDoc.optString("ai_summary", "") }
                    if (extracted.isNotBlank()) {
                        return@withContext extracted
                    }
                }
                val rawText = result.data.optString("text", "")
                    .ifBlank { result.data.optString("extractedText", "") }
                    .ifBlank { result.data.optString("response", "") }
                if (rawText.isNotBlank()) {
                    return@withContext rawText
                }
            } else if (result is BackendResult.Error) {
                Log.w(TAG, "document-processor edge function returned error: ${result.message}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to analyze file via backend: ${e.message}", e)
        }

        ""
    }

    /**
     * Analyze an image via backend image-analyzer / document-processor edge function.
     */
    suspend fun analyzeImage(base64Image: String, mimeType: String, prompt: String): String = withContext(Dispatchers.IO) {
        val effectivePrompt = prompt.ifBlank { "Describe and extract all key study text and diagram insights from this image." }
        try {
            Log.d(TAG, "Executing image analysis via backend for mimeType: $mimeType")
            val payload = JSONObject().apply {
                put("image", base64Image)
                put("mimeType", mimeType)
                put("prompt", effectivePrompt)
            }

            val imgResult = BackendApiService.executeEdgeFunction("image-analyzer", payload)
            if (imgResult is BackendResult.Success) {
                val description = imgResult.data.optString("description", "")
                    .ifBlank { imgResult.data.optString("text", "") }
                    .ifBlank { imgResult.data.optString("response", "") }
                if (description.isNotBlank()) {
                    return@withContext description
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "image-analyzer edge function error, falling back to document-processor: ${e.message}")
        }

        // Fallback to document-processor
        analyzeFile(base64Image, mimeType, effectivePrompt)
    }
}
