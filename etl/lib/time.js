export function toUtcISOString(date) {
  return date.toISOString();
}

export function safeFormatUtc(date) {
  return toUtcISOString(date).replace('.000Z', 'Z');
}
