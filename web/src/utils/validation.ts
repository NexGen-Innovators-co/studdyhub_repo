// src/utils/validation.ts
// Comprehensive frontend validation utilities.
// Prevents invalid data from reaching the API layer, reducing unnecessary
// requests, rate-limit pressure, and providing immediate user feedback.

// ─── Generic helpers ──────────────────────────────────────────────────────────

/** Trim and collapse inner whitespace */
export const sanitizeText = (text: string): string =>
  text.trim().replace(/\s+/g, ' ');

/** Strip HTML tags (basic XSS prevention before DB) */
export const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '');

/** Check if a string is a valid UUID v4 */
export const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// ─── Validation result type ───────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ok = (): ValidationResult => ({ valid: true, errors: [] });
const fail = (...errors: string[]): ValidationResult => ({ valid: false, errors });

// ─── Social post validation ──────────────────────────────────────────────────

export const POST_LIMITS = {
  MIN_CONTENT: 1,
  MAX_CONTENT: 5000,
  MAX_HASHTAGS: 20,
  MAX_MEDIA_FILES: 10,
  MAX_FILE_SIZE_MB: 50,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
  ALLOWED_DOC_TYPES: ['application/pdf'],
} as const;

export function validatePostContent(content: string): ValidationResult {
  const trimmed = content.trim();
  if (trimmed.length < POST_LIMITS.MIN_CONTENT) {
    return fail('Post content cannot be empty.');
  }
  if (trimmed.length > POST_LIMITS.MAX_CONTENT) {
    return fail(`Post content must be under ${POST_LIMITS.MAX_CONTENT} characters.`);
  }
  return ok();
}

export function validatePostMedia(files: File[]): ValidationResult {
  const errors: string[] = [];
  if (files.length > POST_LIMITS.MAX_MEDIA_FILES) {
    errors.push(`You can attach at most ${POST_LIMITS.MAX_MEDIA_FILES} files.`);
  }
  const allowedTypes: string[] = [
    ...POST_LIMITS.ALLOWED_IMAGE_TYPES,
    ...POST_LIMITS.ALLOWED_VIDEO_TYPES,
    ...POST_LIMITS.ALLOWED_DOC_TYPES,
  ];
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      errors.push(`"${file.name}" has an unsupported file type (${file.type}).`);
    }
    if (file.size > POST_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024) {
      errors.push(`"${file.name}" exceeds ${POST_LIMITS.MAX_FILE_SIZE_MB} MB limit.`);
    }
  }
  return errors.length ? fail(...errors) : ok();
}

// ─── Profile validation ──────────────────────────────────────────────────────

export const PROFILE_LIMITS = {
  MIN_DISPLAY_NAME: 1,
  MAX_DISPLAY_NAME: 50,
  MIN_USERNAME: 3,
  MAX_USERNAME: 30,
  MAX_BIO: 500,
  MAX_SCHOOL: 100,
  USERNAME_REGEX: /^[a-zA-Z0-9_]+$/,
} as const;

export function validateDisplayName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < PROFILE_LIMITS.MIN_DISPLAY_NAME) {
    return fail('Display name is required.');
  }
  if (trimmed.length > PROFILE_LIMITS.MAX_DISPLAY_NAME) {
    return fail(`Display name must be under ${PROFILE_LIMITS.MAX_DISPLAY_NAME} characters.`);
  }
  return ok();
}

export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();
  if (trimmed.length < PROFILE_LIMITS.MIN_USERNAME) {
    return fail(`Username must be at least ${PROFILE_LIMITS.MIN_USERNAME} characters.`);
  }
  if (trimmed.length > PROFILE_LIMITS.MAX_USERNAME) {
    return fail(`Username must be under ${PROFILE_LIMITS.MAX_USERNAME} characters.`);
  }
  if (!PROFILE_LIMITS.USERNAME_REGEX.test(trimmed)) {
    return fail('Username can only contain letters, numbers, and underscores.');
  }
  return ok();
}

export function validateBio(bio: string): ValidationResult {
  if (bio.length > PROFILE_LIMITS.MAX_BIO) {
    return fail(`Bio must be under ${PROFILE_LIMITS.MAX_BIO} characters.`);
  }
  return ok();
}

// ─── Note validation ─────────────────────────────────────────────────────────

export const NOTE_LIMITS = {
  MAX_TITLE: 200,
  MAX_CONTENT: 100_000,
} as const;

export function validateNoteTitle(title: string): ValidationResult {
  const trimmed = title.trim();
  if (!trimmed) return fail('Note title is required.');
  if (trimmed.length > NOTE_LIMITS.MAX_TITLE) {
    return fail(`Note title must be under ${NOTE_LIMITS.MAX_TITLE} characters.`);
  }
  return ok();
}

export function validateNoteContent(content: string): ValidationResult {
  if (content.length > NOTE_LIMITS.MAX_CONTENT) {
    return fail(`Note content is too long (max ${NOTE_LIMITS.MAX_CONTENT} characters).`);
  }
  return ok();
}

// ─── Search validation ───────────────────────────────────────────────────────

export const SEARCH_LIMITS = {
  MIN_QUERY: 2,
  MAX_QUERY: 200,
} as const;

export function validateSearchQuery(query: string): ValidationResult {
  const trimmed = query.trim();
  if (trimmed.length < SEARCH_LIMITS.MIN_QUERY) {
    return fail(`Search query must be at least ${SEARCH_LIMITS.MIN_QUERY} characters.`);
  }
  if (trimmed.length > SEARCH_LIMITS.MAX_QUERY) {
    return fail(`Search query must be under ${SEARCH_LIMITS.MAX_QUERY} characters.`);
  }
  return ok();
}

// ─── Group validation ────────────────────────────────────────────────────────

export const GROUP_LIMITS = {
  MIN_NAME: 3,
  MAX_NAME: 100,
  MAX_DESCRIPTION: 1000,
} as const;

export function validateGroupName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < GROUP_LIMITS.MIN_NAME) {
    return fail(`Group name must be at least ${GROUP_LIMITS.MIN_NAME} characters.`);
  }
  if (trimmed.length > GROUP_LIMITS.MAX_NAME) {
    return fail(`Group name must be under ${GROUP_LIMITS.MAX_NAME} characters.`);
  }
  return ok();
}

export function validateGroupDescription(desc: string): ValidationResult {
  if (desc.length > GROUP_LIMITS.MAX_DESCRIPTION) {
    return fail(`Group description must be under ${GROUP_LIMITS.MAX_DESCRIPTION} characters.`);
  }
  return ok();
}

// ─── Email validation ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return fail('Email is required.');
  if (!EMAIL_REGEX.test(email.trim())) return fail('Please enter a valid email address.');
  return ok();
}

// ─── Password validation ─────────────────────────────────────────────────────

export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (password.length > 128) return fail('Password is too long.');
  if (!/[A-Z]/.test(password)) return fail('Password needs at least one uppercase letter.');
  if (!/[a-z]/.test(password)) return fail('Password needs at least one lowercase letter.');
  if (!/[0-9]/.test(password)) return fail('Password needs at least one number.');
  return ok();
}

// ─── File upload validation ──────────────────────────────────────────────────

export const UPLOAD_LIMITS = {
  MAX_DOCUMENT_SIZE_MB: 25,
  MAX_AVATAR_SIZE_MB: 5,
  MAX_AUDIO_SIZE_MB: 100,
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ],
  ALLOWED_AVATAR_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'],
} as const;

export function validateDocumentUpload(file: File): ValidationResult {
  const errors: string[] = [];
  if (!UPLOAD_LIMITS.ALLOWED_DOCUMENT_TYPES.includes(file.type as any)) {
    errors.push('Unsupported document type. Allowed: PDF, Word, TXT, Markdown.');
  }
  if (file.size > UPLOAD_LIMITS.MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
    errors.push(`Document must be under ${UPLOAD_LIMITS.MAX_DOCUMENT_SIZE_MB} MB.`);
  }
  return errors.length ? fail(...errors) : ok();
}

export function validateAvatarUpload(file: File): ValidationResult {
  const errors: string[] = [];
  if (!UPLOAD_LIMITS.ALLOWED_AVATAR_TYPES.includes(file.type as any)) {
    errors.push('Avatar must be JPEG, PNG, or WebP.');
  }
  if (file.size > UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB * 1024 * 1024) {
    errors.push(`Avatar must be under ${UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB} MB.`);
  }
  return errors.length ? fail(...errors) : ok();
}

export function validateAudioUpload(file: File): ValidationResult {
  const errors: string[] = [];
  if (!UPLOAD_LIMITS.ALLOWED_AUDIO_TYPES.includes(file.type as any)) {
    errors.push('Unsupported audio type. Allowed: MP3, WAV, M4A, WebM, OGG.');
  }
  if (file.size > UPLOAD_LIMITS.MAX_AUDIO_SIZE_MB * 1024 * 1024) {
    errors.push(`Audio file must be under ${UPLOAD_LIMITS.MAX_AUDIO_SIZE_MB} MB.`);
  }
  return errors.length ? fail(...errors) : ok();
}

// ─── Report / moderation validation ──────────────────────────────────────────

export const REPORT_LIMITS = {
  MIN_REASON: 10,
  MAX_REASON: 1000,
} as const;

export function validateReportReason(reason: string): ValidationResult {
  const trimmed = reason.trim();
  if (trimmed.length < REPORT_LIMITS.MIN_REASON) {
    return fail(`Please provide more detail (at least ${REPORT_LIMITS.MIN_REASON} characters).`);
  }
  if (trimmed.length > REPORT_LIMITS.MAX_REASON) {
    return fail(`Report reason is too long (max ${REPORT_LIMITS.MAX_REASON} characters).`);
  }
  return ok();
}

// ─── Chat message validation ─────────────────────────────────────────────────

export const CHAT_LIMITS = {
  MIN_MESSAGE: 1,
  MAX_MESSAGE: 5000,
} as const;

export function validateChatMessage(content: string): ValidationResult {
  const trimmed = content.trim();
  if (trimmed.length < CHAT_LIMITS.MIN_MESSAGE) {
    return fail('Message cannot be empty.');
  }
  if (trimmed.length > CHAT_LIMITS.MAX_MESSAGE) {
    return fail(`Message must be under ${CHAT_LIMITS.MAX_MESSAGE} characters.`);
  }
  return ok();
}

// ─── Comment validation ──────────────────────────────────────────────────────

export const COMMENT_LIMITS = {
  MIN_CONTENT: 1,
  MAX_CONTENT: 2000,
} as const;

export function validateComment(content: string): ValidationResult {
  const trimmed = content.trim();
  if (trimmed.length < COMMENT_LIMITS.MIN_CONTENT) {
    return fail('Comment cannot be empty.');
  }
  if (trimmed.length > COMMENT_LIMITS.MAX_CONTENT) {
    return fail(`Comment must be under ${COMMENT_LIMITS.MAX_CONTENT} characters.`);
  }
  return ok();
}

// ─── Composite validator ─────────────────────────────────────────────────────

/**
 * Run multiple validations and merge all errors.
 * Returns { valid: true } only if ALL validators pass.
 */
export function validateAll(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(r => r.errors);
  return allErrors.length ? fail(...allErrors) : ok();
}
