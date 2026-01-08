/**
 * File preview component with line numbers.
 */
import React from "react";
import { Box, Text } from "ink";
import { emoji, colors } from "../theme";
import type { FileInfo } from "../../types";

interface FilePreviewProps {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Maximum lines to show */
  maxLines?: number;
  /** Whether this is a write preview (vs read) */
  isWrite?: boolean;
}

export function FilePreview({
  path,
  content,
  maxLines = 20,
  isWrite = false,
}: FilePreviewProps): React.ReactElement {
  const lines = content.split("\n");
  const totalLines = lines.length;
  const displayLines = lines.slice(0, maxLines);
  const truncated = totalLines > maxLines;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      marginY={1}
    >
      {/* Header */}
      <Box paddingX={2} paddingY={1} borderBottom>
        <Text color={colors.info}>
          {emoji.file} {isWrite ? "Writing:" : "Reading:"}{" "}
        </Text>
        <Text color={colors.file}>{path}</Text>
        <Text dimColor> ({totalLines} lines)</Text>
      </Box>

      {/* Content with line numbers */}
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        {displayLines.map((line, index) => (
          <Box key={index}>
            <Text dimColor>{String(index + 1).padStart(4, " ")} </Text>
            <Text>{truncateLine(line, 70)}</Text>
          </Box>
        ))}
        {truncated && (
          <Box marginTop={1}>
            <Text dimColor>
              ... {totalLines - maxLines} more lines ...
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Truncate a line if too long.
 */
function truncateLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) {
    return line;
  }
  return line.substring(0, maxLength - 3) + "...";
}

/**
 * Compact file written notification.
 */
interface FileWrittenProps {
  path: string;
}

export function FileWritten({ path }: FileWrittenProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.success}>✓ Wrote: </Text>
      <Text color={colors.file}>{path}</Text>
    </Box>
  );
}

/**
 * Compact file edited notification.
 */
interface FileEditedProps {
  path: string;
  occurrences: number;
}

export function FileEdited({
  path,
  occurrences,
}: FileEditedProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.success}>{emoji.edit} Edited: </Text>
      <Text color={colors.file}>{path}</Text>
      <Text dimColor>
        {" "}
        ({occurrences} change{occurrences === 1 ? "" : "s"})
      </Text>
    </Box>
  );
}

/**
 * Compact file read notification.
 */
interface FileReadProps {
  path: string;
  lines: number;
}

export function FileRead({ path, lines }: FileReadProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.info}>📖 Read: </Text>
      <Text color={colors.file}>{path}</Text>
      <Text dimColor> ({lines} lines)</Text>
    </Box>
  );
}

/**
 * Compact ls result notification.
 */
interface LsResultProps {
  path: string;
  count: number;
}

export function LsResult({ path, count }: LsResultProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.info}>📂 Listed: </Text>
      <Text color={colors.file}>{path}</Text>
      <Text dimColor> ({count} item{count === 1 ? "" : "s"})</Text>
    </Box>
  );
}

/**
 * Compact glob result notification.
 */
interface GlobResultProps {
  pattern: string;
  count: number;
}

export function GlobResult({ pattern, count }: GlobResultProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.info}>🔍 Glob: </Text>
      <Text color={colors.tool}>{pattern}</Text>
      <Text dimColor> ({count} match{count === 1 ? "" : "es"})</Text>
    </Box>
  );
}

/**
 * Compact grep result notification.
 */
interface GrepResultProps {
  pattern: string;
  count: number;
}

export function GrepResult({ pattern, count }: GrepResultProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.info}>🔎 Grep: </Text>
      <Text color={colors.tool}>{pattern}</Text>
      <Text dimColor> ({count} match{count === 1 ? "" : "es"})</Text>
    </Box>
  );
}

/**
 * File list panel for /files command.
 */
interface FileListProps {
  files: FileInfo[];
  workDir?: string;
}

export function FileList({
  files,
  workDir,
}: FileListProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text bold color={colors.info}>
          {emoji.file} Files
        </Text>
        {workDir && <Text dimColor> in {workDir}</Text>}
      </Box>

      {files.length === 0 ? (
        <Box paddingLeft={2}>
          <Text dimColor>No files found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {files.map((file) => (
            <Box key={file.path} paddingLeft={2}>
              <Text>{file.is_dir ? "📁" : "📄"} </Text>
              <Text color={colors.file}>{file.path}</Text>
              {file.size !== undefined && (
                <Text dimColor> ({file.size} bytes)</Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

