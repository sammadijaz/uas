/**
 * UAS Engine — Core Type Definitions
 *
 * These types are the TypeScript translation of the specs defined in:
 *   /docs/specs/install-recipe.md
 *   /docs/specs/profile.md
 *   /docs/specs/execution-lifecycle.md
 *
 * Every type here corresponds 1:1 to spec definitions. If you need to change
 * a type, update the spec first.
 */

// ─── Installer Types ─────────────────────────────────────────────

export type InstallerType = "exe" | "msi" | "zip" | "portable";
export type Architecture = "x64" | "x86" | "arm64";
export type ShortcutLocation = "desktop" | "start_menu";
export type RegistryValueType =
  | "REG_SZ"
  | "REG_DWORD"
  | "REG_QWORD"
  | "REG_EXPAND_SZ"
  | "REG_MULTI_SZ";

// ─── Install Recipe ──────────────────────────────────────────────

export interface ExeInstallerOptions {
  silent_args: string[];
  install_dir_arg?: string;
}

export interface MsiInstallerOptions {
  properties: Record<string, string>;
}

export interface ZipInstallerOptions {
  extract_to: string;
  strip_root: boolean;
}

export interface PortableInstallerOptions {
  copy_to: string;
  executable: string;
}

export interface InstallerSpec {
  type: InstallerType;
  url: string;
  sha256: string;
  size_bytes?: number;
  exe?: ExeInstallerOptions;
  msi?: MsiInstallerOptions;
  zip?: ZipInstallerOptions;
  portable?: PortableInstallerOptions;
}

export interface RegistryEntry {
  key: string;
  value_name: string;
  value_data: string;
  value_type: RegistryValueType;
}

export interface ShortcutEntry {
  name: string;
  target: string;
  location: ShortcutLocation;
}

export interface SideEffectsSpec {
  path?: {
    add: string[];
  };
  env?: {
    set: Record<string, string>;
  };
  registry?: RegistryEntry[];
  shortcuts?: ShortcutEntry[];
}

export interface RecipeRequirements {
  os: string;
  arch: Architecture;
  admin: boolean;
  dependencies: string[];
}

export interface RecipeMetadata {
  categories: string[];
  tags: string[];
  maintainer: string;
  updated: string;
}

export interface InstallRecipe {
  id: string;
  name: string;
  description: string;
  homepage: string;
  license: string;
  version: string;
  version_cmd: string;
  version_regex: string;
  installer: InstallerSpec;
  side_effects?: SideEffectsSpec;
  metadata: RecipeMetadata;
  requirements: RecipeRequirements;
}

// ─── Profile ─────────────────────────────────────────────────────

export interface ProfileApp {
  id: string;
  version: string;
  optional: boolean;
  config?: Record<string, unknown>;
}

export interface ProfileMetadata {
  created: string;
  updated: string;
  tags: string[];
  platform: string;
  min_uas_version: string;
}

export interface Profile {
  name: string;
  id: string;
  description: string;
  author: string;
  version: string;
  schema_version: string;
  apps: ProfileApp[];
  metadata: ProfileMetadata;
}

// ─── Execution Lifecycle ─────────────────────────────────────────

export type ExecutionState =
  | "PENDING"
  | "VALIDATING"
  | "RESOLVING"
  | "DOWNLOADING"
  | "VERIFYING"
  | "EXECUTING"
  | "SIDE_EFFECTS"
  | "CONFIRMING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLING_BACK"
  | "ROLLED_BACK";

export type ErrorCategory =
  | "VALIDATION_ERROR"
  | "REQUIREMENT_ERROR"
  | "NETWORK_ERROR"
  | "INTEGRITY_ERROR"
  | "EXECUTION_ERROR"
  | "PERMISSION_ERROR"
  | "VERIFICATION_ERROR"
  | "ROLLBACK_ERROR";

export interface ExecutionError {
  category: ErrorCategory;
  message: string;
  state: ExecutionState;
  details?: Record<string, unknown>;
}

export interface ExecutionProgress {
  execution_id: string;
  app_id: string;
  state: ExecutionState;
  progress_percent?: number;
  bytes_downloaded?: number;
  bytes_total?: number;
  message?: string;
}

export interface ExecutionResult {
  execution_id: string;
  app_id: string;
  version: string;
  final_state: ExecutionState;
  started_at: string;
  finished_at: string;
  dry_run: boolean;
  error?: ExecutionError;
  side_effects_applied: AppliedSideEffect[];
  side_effects_rolled_back: AppliedSideEffect[];
}

// ─── State Tracking ──────────────────────────────────────────────

export interface InstalledApp {
  app_id: string;
  version: string;
  installed_at: string;
  install_dir?: string;
  recipe_hash: string;
  side_effects: AppliedSideEffect[];
}

export type SideEffectType =
  | "path_add"
  | "env_set"
  | "registry_write"
  | "shortcut_create"
  | "file_write";

export interface AppliedSideEffect {
  type: SideEffectType;
  /** What was changed — enough detail to reverse it */
  target: string;
  /** The value that was set (or path that was created) */
  value: string;
  /** The previous value, if any (for rollback) */
  previous_value?: string;
  /** Whether this side effect was successfully applied */
  applied: boolean;
  /** Timestamp */
  applied_at: string;
}

// ─── Engine Options ──────────────────────────────────────────────

export interface EngineOptions {
  /** Path to the state database file */
  state_db_path: string;
  /** Path to the local catalog directory */
  catalog_path: string;
  /** Temporary download directory */
  download_dir: string;
  /** Enable dry-run mode globally */
  dry_run: boolean;
  /** Enable verbose logging */
  verbose: boolean;
}

export interface InstallOptions {
  /** Override dry-run for this operation */
  dry_run?: boolean;
  /** Skip confirmation prompt */
  force?: boolean;
  /** Override install directory */
  install_dir?: string;
}

// ─── Engine Events ───────────────────────────────────────────────

export type EngineEventType =
  | "state_change"
  | "progress"
  | "log"
  | "error"
  | "elevation_required";

export interface EngineEvent {
  type: EngineEventType;
  timestamp: string;
  data: ExecutionProgress | ExecutionError | { message: string; level: string };
}

export type EngineEventHandler = (event: EngineEvent) => void;
