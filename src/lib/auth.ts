const STUDENT_EMAIL_DOMAIN = 'student.local';

function sanitizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function isEmailLike(input: string): boolean {
  return input.includes('@');
}

function toStudentAuthEmail(username: string): string {
  const sanitized = sanitizeUsername(username);
  if (!sanitized) {
    throw new Error('用户名格式无效');
  }
  return `${sanitized}@${STUDENT_EMAIL_DOMAIN}`;
}

function toLoginEmail(input: string): string {
  const trimmed = input.trim();
  if (isEmailLike(trimmed)) {
    return trimmed;
  }
  return toStudentAuthEmail(trimmed);
}

function isValidUsername(username: string): boolean {
  const sanitized = sanitizeUsername(username);
  return sanitized.length >= 2 && sanitized.length <= 30;
}

export {
  STUDENT_EMAIL_DOMAIN,
  sanitizeUsername,
  isEmailLike,
  toStudentAuthEmail,
  toLoginEmail,
  isValidUsername,
};
