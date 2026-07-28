export type MetadataEntry = { key: string; value: string };

export type EntryDraft = {
  secret: string;
  otpUri: string;
  metadata: MetadataEntry[];
  notes: string;
};

export function parseEntryContent(raw: string): EntryDraft {
  const [secret = "", ...lines] = raw.split("\n");
  const metadata: MetadataEntry[] = [];
  const notes: string[] = [];
  let otpUri = "";

  for (const line of lines) {
    if (!otpUri && line.startsWith("otpauth://")) {
      otpUri = line;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key && value) {
        metadata.push({ key, value });
        continue;
      }
    }
    notes.push(line);
  }

  return { secret, otpUri, metadata, notes: notes.join("\n") };
}

export function serializeEntryContent(draft: EntryDraft): string {
  return [
    draft.secret,
    draft.otpUri,
    ...draft.metadata
      .filter(({ key }) => key.trim())
      .map(({ key, value }) => `${key}: ${value}`),
    draft.notes,
  ]
    .filter((line, index) => index === 0 || line.length > 0)
    .join("\n");
}
