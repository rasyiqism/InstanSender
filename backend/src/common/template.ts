/**
 * Replace shortcodes in a message template with recipient-specific values.
 *
 * Supported shortcodes:
 *  - `{name}` -> recipient's name. Falls back to empty string when name is absent.
 */
export function personalize(
  template: string | null | undefined,
  name: string | null | undefined,
): string {
  if (!template) return '';
  const value = name?.trim() || '';
  return template.replace(/\{name\}/g, value);
}
