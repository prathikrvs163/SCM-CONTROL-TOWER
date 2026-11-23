/** Split a "Subject: ..." first line from the draft body. */
export function splitDraft(draft: string): {
  subject: string | null;
  body: string;
} {
  const match = /^\s*subject:\s*(.+?)\s*(?:\r?\n|$)([\s\S]*)$/i.exec(draft);
  if (!match) return { subject: null, body: draft.trim() };
  return { subject: match[1], body: match[2].trim() };
}
