/**
 * CompositeBackend: Route operations to different backends based on path prefix.
 */

import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
} from "../types";

/**
 * Backend that routes file operations to different backends based on path prefix.
 *
 * This enables hybrid storage strategies by routing files to different backends
 * based on their path prefix. Useful for separating persistent and ephemeral storage,
 * or using different storage backends for different types of files.
 *
 * @example Hybrid storage strategy
 * ```typescript
 * import { CompositeBackend, FilesystemBackend, StateBackend } from 'ai-sdk-deep-agent';
 *
 * const state = { todos: [], files: {} };
 * const backend = new CompositeBackend(
 *   new StateBackend(state), // Default: ephemeral storage
 *   {
 *     '/persistent/': new FilesystemBackend({ rootDir: './persistent' }), // Persistent files
 *     '/cache/': new StateBackend(state), // Cached files (ephemeral)
 *   }
 * );
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 * });
 * ```
 *
 * @example Multiple persistent backends
 * ```typescript
 * const backend = new CompositeBackend(
 *   new FilesystemBackend({ rootDir: './default' }),
 *   {
 *     '/user-data/': new FilesystemBackend({ rootDir: './user-data' }),
 *     '/system/': new FilesystemBackend({ rootDir: './system' }),
 *   }
 * );
 * ```
 */
export class CompositeBackend implements BackendProtocol {
  private defaultBackend: BackendProtocol;
  private routes: Record<string, BackendProtocol>;
  private sortedRoutes: Array<[string, BackendProtocol]>;

  /**
   * Create a new CompositeBackend instance.
   *
   * @param defaultBackend - Backend to use for paths that don't match any route prefix
   * @param routes - Record mapping path prefixes to backends.
   *                 Routes are matched by longest prefix first.
   *                 Example: `{ '/persistent/': filesystemBackend, '/cache/': stateBackend }`
   */
  constructor(
    defaultBackend: BackendProtocol,
    routes: Record<string, BackendProtocol>
  ) {
    this.defaultBackend = defaultBackend;
    this.routes = routes;

    // Sort routes by length (longest first) for correct prefix matching
    this.sortedRoutes = Object.entries(routes).sort(
      (a, b) => b[0].length - a[0].length
    );
  }

  /**
   * Determine which backend handles this key and strip prefix.
   */
  private getBackendAndKey(key: string): [BackendProtocol, string] {
    for (const [prefix, backend] of this.sortedRoutes) {
      if (key.startsWith(prefix)) {
        const suffix = key.substring(prefix.length);
        const strippedKey = suffix ? "/" + suffix : "/";
        return [backend, strippedKey];
      }
    }

    return [this.defaultBackend, key];
  }

  /**
   * List files and directories in the specified directory (non-recursive).
   */
  async lsInfo(path: string): Promise<FileInfo[]> {
    // Check if path matches a specific route
    for (const [routePrefix, backend] of this.sortedRoutes) {
      if (path.startsWith(routePrefix.replace(/\/$/, ""))) {
        const suffix = path.substring(routePrefix.length);
        const searchPath = suffix ? "/" + suffix : "/";
        const infos = await backend.lsInfo(searchPath);

        // Add route prefix back to paths
        const prefixed: FileInfo[] = [];
        for (const fi of infos) {
          prefixed.push({
            ...fi,
            path: routePrefix.slice(0, -1) + fi.path,
          });
        }
        return prefixed;
      }
    }

    // At root, aggregate default and all routed backends
    if (path === "/") {
      const results: FileInfo[] = [];
      const defaultInfos = await this.defaultBackend.lsInfo(path);
      results.push(...defaultInfos);

      // Add the route itself as a directory
      for (const [routePrefix] of this.sortedRoutes) {
        results.push({
          path: routePrefix,
          is_dir: true,
          size: 0,
          modified_at: "",
        });
      }

      results.sort((a, b) => a.path.localeCompare(b.path));
      return results;
    }

    // Path doesn't match a route: query only default backend
    return await this.defaultBackend.lsInfo(path);
  }

  /**
   * Read file content, routing to appropriate backend.
   */
  async read(
    filePath: string,
    offset: number = 0,
    limit: number = 2000
  ): Promise<string> {
    const [backend, strippedKey] = this.getBackendAndKey(filePath);
    return await backend.read(strippedKey, offset, limit);
  }

  /**
   * Read file content as raw FileData.
   */
  async readRaw(filePath: string): Promise<FileData> {
    const [backend, strippedKey] = this.getBackendAndKey(filePath);
    return await backend.readRaw(strippedKey);
  }

  /**
   * Structured search results or error string for invalid input.
   */
  async grepRaw(
    pattern: string,
    path: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    // If path targets a specific route, search only that backend
    for (const [routePrefix, backend] of this.sortedRoutes) {
      if (path.startsWith(routePrefix.replace(/\/$/, ""))) {
        const suffix = path.substring(routePrefix.length);
        const searchPath = suffix ? "/" + suffix : "/";
        const raw = await backend.grepRaw(pattern, searchPath, glob);

        if (typeof raw === "string") {
          return raw;
        }

        return raw.map((m) => ({
          ...m,
          path: routePrefix.slice(0, -1) + m.path,
        }));
      }
    }

    // Otherwise, search default and all routed backends and merge
    const allMatches: GrepMatch[] = [];
    const rawDefault = await this.defaultBackend.grepRaw(pattern, path, glob);

    if (typeof rawDefault === "string") {
      return rawDefault;
    }

    allMatches.push(...rawDefault);

    // Search all routes
    for (const [routePrefix, backend] of Object.entries(this.routes)) {
      const raw = await backend.grepRaw(pattern, "/", glob);

      if (typeof raw === "string") {
        return raw;
      }

      allMatches.push(
        ...raw.map((m) => ({
          ...m,
          path: routePrefix.slice(0, -1) + m.path,
        }))
      );
    }

    return allMatches;
  }

  /**
   * Structured glob matching returning FileInfo objects.
   */
  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    // Route based on path
    for (const [routePrefix, backend] of this.sortedRoutes) {
      if (path.startsWith(routePrefix.replace(/\/$/, ""))) {
        const suffix = path.substring(routePrefix.length);
        const searchPath = suffix ? "/" + suffix : "/";
        const infos = await backend.globInfo(pattern, searchPath);

        return infos.map((fi) => ({
          ...fi,
          path: routePrefix.slice(0, -1) + fi.path,
        }));
      }
    }

    // Path doesn't match any specific route - search all backends
    const defaultInfos = await this.defaultBackend.globInfo(pattern, path);
    results.push(...defaultInfos);

    for (const [routePrefix, backend] of Object.entries(this.routes)) {
      const infos = await backend.globInfo(pattern, "/");
      results.push(
        ...infos.map((fi) => ({
          ...fi,
          path: routePrefix.slice(0, -1) + fi.path,
        }))
      );
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }

  /**
   * Create a new file, routing to appropriate backend.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    const [backend, strippedKey] = this.getBackendAndKey(filePath);
    return await backend.write(strippedKey, content);
  }

  /**
   * Edit a file, routing to appropriate backend.
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    const [backend, strippedKey] = this.getBackendAndKey(filePath);
    return await backend.edit(strippedKey, oldString, newString, replaceAll);
  }
}

