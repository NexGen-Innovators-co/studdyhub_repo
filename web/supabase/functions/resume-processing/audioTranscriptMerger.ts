// resume-processing/audioTranscriptMerger.ts
//
// Deterministic, prompt-independent merging of per-part audio transcripts.
//
// The audio transcription path in resume-processing transcribes each stored
// part independently and appends each result to content_extracted. Because the
// per-part prompt can change over time (or differ between processors), the
// stored parts may contain chunk artifacts like part headers, repeated speaker
// labels, or segment intros. Rather than hard-coding regex removal for one
// specific prompt output, this module normalizes the final assembled transcript
// in a stable, explainable way and then recompresses the paragraph structure so
// the stored content reads like one continuous transcription.
//
// This is intentionally separate from the audio cursor save path so the live
// progress still stores raw per-part results, while the terminal document state
// is normalized only once per completed/partial finalization.

const DB_CONTENT_CAP = 1 * 1024 * 1024; // match resume-processing DB cap

export interface MergeAudioTranscriptOptions {
  /** Previously stored transcript, if any. May be a placeholder or prior parts. */
  existing?: string;
  /** Newly assembled raw transcript from the current round/parts. */
  incoming?: string;
  /** When true, treat the result as finalized and recompress paragraph spacing. */
  finalize?: boolean;
}

export function mergeAudioTranscript({
  existing = '',
  incoming = '',
  finalize = false,
}: MergeAudioTranscriptOptions = {}): string {
  const parts = [existing, incoming].filter((s) => s && s.trim().length > 0);
  if (parts.length === 0) return '';

  // Start from the raw assembly that the resume path already uses. We do not
  // change the live per-part append semantics here; this function is meant to
  // be called when we want the *stored final* form, not intermediate progress.
  let merged = parts.length === 1 ? parts[0] : `${parts[0]}\n\n${parts[1]}`;

  // Normalize whitespace without touching intentional paragraph breaks.
  merged = normalizeSpacing(merged);

  if (finalize) {
    merged = recomposeParagraphFlow(merged);
  }

  return truncateForDb(merged);
}

/**
 * Normalize repeated newlines and awkward join markers without assuming any
 * specific prompt wording. The goal is to reduce obvious chunk seams while
 * preserving the actual transcript text.
 */
function normalizeSpacing(text: string): string {
  // Collapse 3+ blank lines into a single blank line.
  let normalized = text.replace(/\n{3,}/g, '\n\n');

  // Remove standalone "seam" lines that only exist to mark a chunk boundary.
  // These are usually short, uppercase/dotted/labeled lines with no real
  // sentence content. We treat them as removable only when they are on their
  // own line and the surrounding content still reads coherently after removal.
  normalized = normalized.replace(
    /\n([ \t]*)(?:-{2,}|~{2,}|={2,}|•{2,}|†{2,}|‡{2,}|\*{3,}|#{1,3}|-{1,3} ?[0-9]+[-\s]*[0-9]*[ \t]*\n)/g,
    '\n',
  );

  // Remove lines that are only a part marker, e.g. "Part 1", "Segment 2 of 5",
  // "Chunk 3/12", "Part I", "Part A", etc. This is deliberately broad but still
  // limited to lines that contain nothing else meaningful.
  normalized = normalized.replace(
    /\n[ \t]*(?:part|segment|chunk|section|clip|piece|file|audio|recording)[ \t]*[0-9]+(?:[ \t]*(?:of|/|÷|\/|to)[ \t]*[0-9]+)?[ \t]*\n+/gi,
    '\n',
  );

  // Remove lines that look like an artificial intro sentence naming a new file
  // or new segment. This is the most common "bad UX" pattern you described: the
  // transcript starts every chunk with "This is a new file..." or similar.
  //
  // We do not try to enumerate every possible phrasing. Instead we target the
  // structural pattern: a short standalone sentence on its own line that
  // introduces a new segment/file/audio piece.
  normalized = normalized.replace(
    /\n[ \t]*[A-Z][A-Za-z0-9',. :;\-]{0,120}?\b(?:file|audio|recording|segment|clip|piece|part|section|track|voice|speaker)\b[A-Za-z0-9',. :;\-]{0,120}?[ \t]*\n+/gi,
    '\n',
  );

  // Collapse any newlines left behind by the removals above.
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized.trim();
}

/**
 * Recompose paragraph flow for the finalized transcript. This is the step that
 * tries to make the stored content read like one continuous document instead of
 * concatenated chunks, while still keeping real paragraph boundaries intact.
 */
function recomposeParagraphFlow(text: string): string {
  // Split into paragraphs on blank lines.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) return '';

  const cleaned: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    // Skip standalone seam lines that survived earlier normalization.
    if (looksLikeSeamLine(trimmed)) {
      continue;
    }

    cleaned.push(trimmed);
  }

  if (cleaned.length === 0) return '';

  // Rejoin with a single blank line between paragraphs.
  // This avoids the "every chunk starts a new file" feel because we no longer
  // preserve chunk-sized paragraph blocks unless they are genuinely separate.
  return cleaned.join('\n\n');
}

/**
 * Heuristic: a "seam line" is usually a short, structural marker rather than
 * real transcript content.
 */
function looksLikeSeamLine(line: string): boolean {
  if (line.length === 0) return false;
  if (line.length > 160) return false;

  const lower = line.toLowerCase();

  // Explicit chunk/part markers.
  if (/^(part|segment|chunk|section|clip|piece|file|audio|recording|track|voice)\s/i.test(
    line,
  )) {
    return true;
  }

  // Patterns like "--- Page N ---", "=== Transcript ===", "*** End of part ***".
  if (/^[\s\p{P}\p{S}]*$/.test(line) && /[\-=*\+]{3,}/.test(line)) {
    return true;
  }

  // Very short lines that are likely headers or labels, not sentences.
  if (
    line.length < 60 &&
    /[.:]\s*$/.test(line) &&
    /^[A-Z\[\(\)]/.test(line)
  ) {
    return true;
  }

  return false;
}

function truncateForDb(text: string): string {
  if (text.length <= DB_CONTENT_CAP) return text;
  return text.slice(0, DB_CONTENT_CAP - 12) + '\n\n[TRANSCRIPT TRUNCATED FOR STORAGE]';
}
