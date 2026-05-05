# Cloud Text-to-Speech (TTS) Admin Runbook

This runbook describes actions to recover and prevent failures in `cloud-tts` edge function.

## 1. Overview

- Source is `supabase/functions/cloud-tts/index.ts`.
- Error logs appear under table `system_error_logs` with `source = cloud-tts`.
- Common error codes:
  - `TTS_API_FORBIDDEN` (403): Cloud TTS API disabled / invalid API key / no billing.
  - `TTS_AUTH_FAILED` (401): invalid API key / expired credentials.
  - `TTS_QUOTA_EXCEEDED` (429): quota cap reached.
  - `TTS_API_ERROR`: generic server error.
  - `TTS_RUNTIME_ERROR`: function exception.

## 2. Immediate user-facing fallback behavior

- For 403 / 401 errors, the edge function sets `fallback: native` in response.
- Frontend service `src/services/cloudTtsService.ts` will trigger fallback to browser speech synthesis via `speakText`.

## 3. Troubleshooting 403 (primary user issue)

1. Open Google Cloud Console for project `715850638091`.
2. Ensure **Text-to-Speech API** is enabled:
   - https://console.developers.google.com/apis/api/texttospeech.googleapis.com/overview
3. Confirm billing is active and no historical suspension.
4. Verify service account / API key is valid and matches `GEMINI_API_KEY` in Supabase Edge Function secrets.
5. Confirm `GEMINI_API_KEY` includes proper permissions for Text-to-Speech.
6. Check IAM role requires `roles/texttospeech.admin` or similar.

## 4. Re-run test

- In app: trigger TTS e.g. note read-aloud.
- Confirm status no longer appears as `cloud-tts` 403 in system logs.

## 5. Optional config for faster recovery

- Add env var to supabase function (if supported):
  - `CLOUD_TTS_FALLBACK_NATIVE=true`

## 6. Permanent monitoring

- Monitor `system_error_logs` for `source = cloud-tts` and `status = open`.
- Create alert on repeated `TTS_API_FORBIDDEN` or `TTS_QUOTA_EXCEEDED` errors.

## 7. Post incident cleanup

- Mark logs `resolved` once issue is fixed (use admin tool in module `SystemErrorLogs`).
- Validate request rates and error counts decreased.

## 8. Developer notes

- The function now returns `fallback: 'native'` for 403/401.
- `cloudTtsService.generateSpeech` checks this and triggers browser fallback path.
