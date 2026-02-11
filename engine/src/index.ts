/**
 * UAS Engine — Public API
 *
 * This is the single entry point for the engine package.
 * CLI and Desktop import from here — never from internal modules.
 */

// Main engine class
export { UASEngine } from "./engine";

// All types
export type {
  // Recipe types
  InstallRecipe,
  InstallerSpec,
  InstallerType,
  Architecture,
  ExeInstallerOptions,
  MsiInstallerOptions,
  ZipInstallerOptions,
  PortableInstallerOptions,
  SideEffectsSpec,
  RegistryEntry,
  ShortcutEntry,
  ShortcutLocation,
  RegistryValueType,
  RecipeRequirements,
  RecipeMetadata,

  // Profile types
  Profile,
  ProfileApp,
  ProfileMetadata,

  // Execution types
  ExecutionState,
  ExecutionResult,
  ExecutionError,
  ExecutionProgress,
  ErrorCategory,

  // State types
  InstalledApp,
  AppliedSideEffect,
  SideEffectType,

  // Engine config types
  EngineOptions,
  InstallOptions,
  EngineEvent,
  EngineEventType,
  EngineEventHandler,
} from "./types";

// Utilities (exposed for CLI/GUI use)
export {
  resolveVariables,
  getResolvedVariables,
  validateVariables,
} from "./utils/variables";
export { createLogger } from "./utils/logger";
export type { Logger } from "./utils/logger";
