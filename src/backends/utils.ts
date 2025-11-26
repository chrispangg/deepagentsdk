/**
 * Shared utility functions for memory backend implementations.
 */

import micromatch from "micromatch";
import { basename } from "path";
import type { FileData, GrepMatch } from "../types.ts";

// Constants
export const EMPTY_CONTENT_WARNING =
  "System reminder: File exists but has empty contents";
export const MAX_LINE_LENGTH = 10000;
export const LINE_NUMBER_WIDTH = 6;
export const TOOL_RESULT_TOKEN_LIMIT = 20000;
export const TRUNCATION_GUIDANCE =
  "... [results truncated, try being more specific with your parameters]";

/**
 * Format file content with line numbers (cat -n style).
 */
export function formatContentWithLineNumbers(
  content: string | string[],
  startLine: number = 1
): string {
  let lines: string[];
  if (typeof content === "string") {
    lines = content.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines = lines.slice(0, -1);
    }
  } else {
    lines = content;
  }

  const resultLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + startLine;

    if (line && line.length <= MAX_LINE_LENGTH) {
      resultLines.push(
        `${lineNum.toString().padStart(LINE_NUMBER_WIDTH)}\t${line}`
      );
    } else if (line) {
      // Split long line into chunks with continuation markers
      const numChunks = Math.ceil(line.length / MAX_LINE_LENGTH);
      for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
        const start = chunkIdx * MAX_LINE_LENGTH;
        const end = Math.min(start + MAX_LINE_LENGTH, line.length);
        const chunk = line.substring(start, end);
        if (chunkIdx === 0) {
          resultLines.push(
            `${lineNum.toString().padStart(LINE_NUMBER_WIDTH)}\t${chunk}`
          );
        } else {
          const continuationMarker = `${lineNum}.${chunkIdx}`;
          resultLines.push(
            `${continuationMarker.padStart(LINE_NUMBER_WIDTH)}\t${chunk}`
          );
        }
      }
    } else {
      resultLines.push(
        `${lineNum.toString().padStart(LINE_NUMBER_WIDTH)}\t`
      );
    }
  }

  return resultLines.join("\n");
}

/**
 * Check if content is empty and return warning message.
 */
export function checkEmptyContent(content: string): string | null {
  if (!content || content.trim() === "") {
    return EMPTY_CONTENT_WARNING;
  }
  return null;
}

/**
 * Convert FileData to plain string content.
 */
export function fileDataToString(fileData: FileData): string {
  return fileData.content.join("\n");
}

/**
 * Create a FileData object with timestamps.
 */
export function createFileData(content: string, createdAt?: string): FileData {
  const lines = typeof content === "string" ? content.split("\n") : content;
  const now = new Date().toISOString();

  return {
    content: lines,
    created_at: createdAt || now,
    modified_at: now,
  };
}

/**
 * Update FileData with new content, preserving creation timestamp.
 */
export function updateFileData(fileData: FileData, content: string): FileData {
  const lines = typeof content === "string" ? content.split("\n") : content;
  const now = new Date().toISOString();

  return {
    content: lines,
    created_at: fileData.created_at,
    modified_at: now,
  };
}

/**
 * Format file data for read response with line numbers.
 */
export function formatReadResponse(
  fileData: FileData,
  offset: number,
  limit: number
): string {
  const content = fileDataToString(fileData);
  const emptyMsg = checkEmptyContent(content);
  if (emptyMsg) {
    return emptyMsg;
  }

  const lines = content.split("\n");
  const startIdx = offset;
  const endIdx = Math.min(startIdx + limit, lines.length);

  if (startIdx >= lines.length) {
    return `Error: Line offset ${offset} exceeds file length (${lines.length} lines)`;
  }

  const selectedLines = lines.slice(startIdx, endIdx);
  return formatContentWithLineNumbers(selectedLines, startIdx + 1);
}

/**
 * Perform string replacement with occurrence validation.
 */
export function performStringReplacement(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): [string, number] | string {
  const occurrences = content.split(oldString).length - 1;

  if (occurrences === 0) {
    return `Error: String not found in file: '${oldString}'`;
  }

  if (occurrences > 1 && !replaceAll) {
    return `Error: String '${oldString}' appears ${occurrences} times in file. Use replace_all=true to replace all instances, or provide a more specific string with surrounding context.`;
  }

  const newContent = content.split(oldString).join(newString);
  return [newContent, occurrences];
}

/**
 * Validate and normalize a path.
 */
export function validatePath(path: string | null | undefined): string {
  const pathStr = path || "/";
  if (!pathStr || pathStr.trim() === "") {
    throw new Error("Path cannot be empty");
  }

  let normalized = pathStr.startsWith("/") ? pathStr : "/" + pathStr;

  if (!normalized.endsWith("/")) {
    normalized += "/";
  }

  return normalized;
}

/**
 * Search files dict for paths matching glob pattern.
 */
export function globSearchFiles(
  files: Record<string, FileData>,
  pattern: string,
  path: string = "/"
): string {
  let normalizedPath: string;
  try {
    normalizedPath = validatePath(path);
  } catch {
    return "No files found";
  }

  const filtered = Object.fromEntries(
    Object.entries(files).filter(([fp]) => fp.startsWith(normalizedPath))
  );

  const matches: Array<[string, string]> = [];
  for (const [filePath, fileData] of Object.entries(filtered)) {
    let relative = filePath.substring(normalizedPath.length);
    if (relative.startsWith("/")) {
      relative = relative.substring(1);
    }
    if (!relative) {
      const parts = filePath.split("/");
      relative = parts[parts.length - 1] || "";
    }

    if (
      micromatch.isMatch(relative, pattern, {
        dot: true,
        nobrace: false,
      })
    ) {
      matches.push([filePath, fileData.modified_at]);
    }
  }

  matches.sort((a, b) => b[1].localeCompare(a[1]));

  if (matches.length === 0) {
    return "No files found";
  }

  return matches.map(([fp]) => fp).join("\n");
}

/**
 * Return structured grep matches from an in-memory files mapping.
 */
export function grepMatchesFromFiles(
  files: Record<string, FileData>,
  pattern: string,
  path: string | null = null,
  glob: string | null = null
): GrepMatch[] | string {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (e: unknown) {
    const error = e as Error;
    return `Invalid regex pattern: ${error.message}`;
  }

  let normalizedPath: string;
  try {
    normalizedPath = validatePath(path);
  } catch {
    return [];
  }

  let filtered = Object.fromEntries(
    Object.entries(files).filter(([fp]) => fp.startsWith(normalizedPath))
  );

  if (glob) {
    filtered = Object.fromEntries(
      Object.entries(filtered).filter(([fp]) =>
        micromatch.isMatch(basename(fp), glob, { dot: true, nobrace: false })
      )
    );
  }

  const matches: GrepMatch[] = [];
  for (const [filePath, fileData] of Object.entries(filtered)) {
    for (let i = 0; i < fileData.content.length; i++) {
      const line = fileData.content[i];
      const lineNum = i + 1;
      if (line && regex.test(line)) {
        matches.push({ path: filePath, line: lineNum, text: line });
      }
    }
  }

  return matches;
}

