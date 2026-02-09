import { PRResponseSchema, type PRResponse } from "@/types/structured-output";

function extractMarkdownCodeBlocks(text: string): string[] {
  const matches: string[] = [];
  const regex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const content = match[1]?.trim();
    if (content) matches.push(content);
  }

  return matches;
}

function extractBalancedJsonObjects(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        results.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return results;
}

function parseEscapedJsonString(rawQuotedValue: string): string | null {
  try {
    return JSON.parse(`"${rawQuotedValue}"`) as string;
  } catch {
    return null;
  }
}

function extractFieldAsEscapedJsonString(
  text: string,
  fieldName: "title" | "description",
): string | null {
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`, "i");
  const startMatch = fieldPattern.exec(text);
  if (!startMatch) return null;

  const start = startMatch.index + startMatch[0].length;
  let escaped = false;
  let value = "";

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      value += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      return value;
    }

    value += char;
  }

  return null;
}

function parseFromLooseFieldExtraction(text: string): PRResponse | null {
  const rawTitle = extractFieldAsEscapedJsonString(text, "title");
  const rawDescription = extractFieldAsEscapedJsonString(text, "description");
  if (!rawTitle || !rawDescription) return null;

  const title = parseEscapedJsonString(rawTitle);
  const description = parseEscapedJsonString(rawDescription);
  if (!title || !description) return null;

  const validated = PRResponseSchema.safeParse({ title, description });
  if (!validated.success) return null;
  return validated.data;
}

function parseFromTitleDescriptionText(text: string): PRResponse | null {
  const titleMatch = text.match(/TITLE:\s*(.+?)(?=\n\nDESCRIPTION:|$)/s);
  const descriptionMatch = text.match(/DESCRIPTION:\s*(.+?)$/s);
  if (!titleMatch || !descriptionMatch) return null;

  const validated = PRResponseSchema.safeParse({
    title: titleMatch[1].trim(),
    description: descriptionMatch[1].trim(),
  });
  if (!validated.success) return null;
  return validated.data;
}

export function parsePRResponseFromRawText(text: string): PRResponse | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidateSources = [trimmed, ...extractMarkdownCodeBlocks(trimmed)];

  for (const source of candidateSources) {
    const objectCandidates = extractBalancedJsonObjects(source);
    for (let i = objectCandidates.length - 1; i >= 0; i -= 1) {
      const candidate = objectCandidates[i];
      try {
        const parsed = JSON.parse(candidate) as unknown;
        const validated = PRResponseSchema.safeParse(parsed);
        if (validated.success) return validated.data;
      } catch {
        // Keep scanning other candidates
      }
    }
  }

  const loose = parseFromLooseFieldExtraction(trimmed);
  if (loose) return loose;

  return parseFromTitleDescriptionText(trimmed);
}
