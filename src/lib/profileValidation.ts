export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

const GENDER_ALIASES: Record<string, GenderValue> = {
  male: 'male',
  female: 'female',
  'non-binary': 'non_binary',
  non_binary: 'non_binary',
  'prefer not to say': 'prefer_not_to_say',
  prefer_not_to_say: 'prefer_not_to_say',
};

const MAX_AGE = 100;
const MIN_AGE = 18;

export function sanitizeProfileText(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPhoneInput(value: string): string {
  let cleaned = value.replace(/[^\d+]/g, '');

  if (cleaned.includes('+')) {
    cleaned = cleaned.startsWith('+')
      ? `+${cleaned.slice(1).replace(/\+/g, '')}`
      : cleaned.replace(/\+/g, '');
  }

  if (cleaned.startsWith('+234')) {
    const digits = cleaned.slice(4).replace(/\D/g, '').slice(0, 10);
    return digits ? `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`.trim() : '+234';
  }

  if (cleaned.startsWith('234')) {
    const digits = cleaned.slice(3).replace(/\D/g, '').slice(0, 10);
    return digits ? `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`.trim() : '+234';
  }

  if (cleaned.startsWith('0')) {
    const digits = cleaned.slice(1).replace(/\D/g, '').slice(0, 10);
    return digits ? `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`.trim() : '0';
  }

  if (cleaned.startsWith('+')) {
    return cleaned.slice(0, 16);
  }

  const digits = cleaned.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function validatePhoneNumber(value: string): { ok: boolean; normalized: string | null; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, normalized: null };

  const raw = trimmed.replace(/\s+/g, '');

  if (raw.startsWith('+')) {
    if (!/^\+[1-9]\d{7,14}$/.test(raw)) {
      return {
        ok: false,
        normalized: null,
        message: 'Enter a valid phone number with a country code, e.g. +2348012345678.',
      };
    }

    return { ok: true, normalized: raw };
  }

  if (/^0\d{10}$/.test(raw)) {
    return { ok: true, normalized: `+234${raw.slice(1)}` };
  }

  if (/^234\d{10}$/.test(raw)) {
    return { ok: true, normalized: `+${raw}` };
  }

  return {
    ok: false,
    normalized: null,
    message: 'Use a valid Nigerian number (080...) or E.164 format (+234...).',
  };
}

export function normalizeDateOfBirth(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function validateDateOfBirth(value: string): { ok: boolean; iso: string | null; message?: string } {
  const iso = normalizeDateOfBirth(value);
  if (!value.trim()) return { ok: true, iso: null };
  if (!iso) return { ok: false, iso: null, message: 'Enter a valid date of birth.' };

  const birthDate = new Date(`${iso}T00:00:00.000Z`);
  const today = new Date();
  const minDate = new Date(today.getFullYear() - MAX_AGE, today.getMonth(), today.getDate());
  const adultDate = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());

  if (birthDate > today) {
    return { ok: false, iso: null, message: 'Date of birth cannot be in the future.' };
  }

  if (birthDate < minDate) {
    return { ok: false, iso: null, message: `Enter a realistic date of birth (not older than ${MAX_AGE} years).` };
  }

  if (birthDate > adultDate) {
    return { ok: false, iso: null, message: `You must be at least ${MIN_AGE} years old to use this profile.` };
  }

  return { ok: true, iso };
}

export function normalizeGender(value: string): GenderValue | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized) return null;
  return GENDER_ALIASES[normalized.replace(/_/g, ' ')] || GENDER_ALIASES[normalized] || null;
}

export function validateGender(value: string): { ok: boolean; normalized: GenderValue | null; message?: string } {
  if (!value.trim()) return { ok: true, normalized: null };

  const normalized = normalizeGender(value);
  if (!normalized) {
    return {
      ok: false,
      normalized: null,
      message: 'Select a valid gender option.',
    };
  }

  return { ok: true, normalized };
}
