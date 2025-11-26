/**
 * StateBackend: Store files in shared state (ephemeral, in-memory).
 */

import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
  DeepAgentState,
} from "../types.ts";
import {
  createFileData,
  fileDataToString,
  formatReadResponse,
  globSearchFiles,
  grepMatchesFromFiles,
  performStringReplacement,
  updateFileData,
} from "./utils.ts";

/**
 * Backend that stores files in shared state (ephemeral).
 *
 * Files persist within a single agent invocation but not across invocations.
 * This is the default backend for deep agents.
 */
export class StateBackend implements BackendProtocol {
  private state: DeepAgentState;

  constructor(state: DeepAgentState) {
    this.state = state;
  }

  /**
   * Get files from current state.
   */
  private getFiles(): Record<string, FileData> {
    return this.state.files || {};
  }

  /**
   * List files and directories in the specified directory (non-recursive).
   */
  lsInfo(path: string): FileInfo[] {
    const files = this.getFiles();
    const infos: FileInfo[] = [];
    const subdirs = new Set<string>();

    const normalizedPath = path.endsWith("/") ? path : path + "/";

    for (const [k, fd] of Object.entries(files)) {
      if (!k.startsWith(normalizedPath)) {
        continue;
      }

      const relative = k.substring(normalizedPath.length);

      if (relative.includes("/")) {
        const subdirName = relative.split("/")[0];
        subdirs.add(normalizedPath + subdirName + "/");
        continue;
      }

      const size = fd.content.join("\n").length;
      infos.push({
        path: k,
        is_dir: false,
        size: size,
        modified_at: fd.modified_at,
      });
    }

    for (const subdir of Array.from(subdirs).sort()) {
      infos.push({
        path: subdir,
        is_dir: true,
        size: 0,
        modified_at: "",
      });
    }

    infos.sort((a, b) => a.path.localeCompare(b.path));
    return infos;
  }

  /**
   * Read file content with line numbers.
   */
  read(filePath: string, offset: number = 0, limit: number = 2000): string {
    const files = this.getFiles();
    const fileData = files[filePath];

    if (!fileData) {
      return `Error: File '${filePath}' not found`;
    }

    return formatReadResponse(fileData, offset, limit);
  }

  /**
   * Read file content as raw FileData.
   */
  readRaw(filePath: string): FileData {
    const files = this.getFiles();
    const fileData = files[filePath];

    if (!fileData) throw new Error(`File '${filePath}' not found`);
    return fileData;
  }

  /**
   * Create a new file with content.
   */
  write(filePath: string, content: string): WriteResult {
    const files = this.getFiles();

    if (filePath in files) {
      return {
        error: `Cannot write to ${filePath} because it already exists. Read and then make an edit, or write to a new path.`,
      };
    }

    const newFileData = createFileData(content);
    this.state.files[filePath] = newFileData;
    return { path: filePath };
  }

  /**
   * Edit a file by replacing string occurrences.
   */
  edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): EditResult {
    const files = this.getFiles();
    const fileData = files[filePath];

    if (!fileData) {
      return { error: `Error: File '${filePath}' not found` };
    }

    const content = fileDataToString(fileData);
    const result = performStringReplacement(
      content,
      oldString,
      newString,
      replaceAll
    );

    if (typeof result === "string") {
      return { error: result };
    }

    const [newContent, occurrences] = result;
    const newFileData = updateFileData(fileData, newContent);
    this.state.files[filePath] = newFileData;
    return { path: filePath, occurrences };
  }

  /**
   * Structured search results or error string for invalid input.
   */
  grepRaw(
    pattern: string,
    path: string = "/",
    glob: string | null = null
  ): GrepMatch[] | string {
    const files = this.getFiles();
    return grepMatchesFromFiles(files, pattern, path, glob);
  }

  /**
   * Structured glob matching returning FileInfo objects.
   */
  globInfo(pattern: string, path: string = "/"): FileInfo[] {
    const files = this.getFiles();
    const result = globSearchFiles(files, pattern, path);

    if (result === "No files found") {
      return [];
    }

    const paths = result.split("\n");
    const infos: FileInfo[] = [];
    for (const p of paths) {
      const fd = files[p];
      const size = fd ? fd.content.join("\n").length : 0;
      infos.push({
        path: p,
        is_dir: false,
        size: size,
        modified_at: fd?.modified_at || "",
      });
    }
    return infos;
  }
}

