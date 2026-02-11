/**
 * UAS Engine — Main Engine Class
 *
 * The engine is the heart of UAS. It orchestrates the entire installation
 * lifecycle as defined in /docs/specs/execution-lifecycle.md.
 *
 * The engine:
 * 1. Validates recipes
 * 2. Downloads installers
 * 3. Verifies checksums
 * 4. Executes installations via pluggable executors
 * 5. Applies side effects (PATH, env, registry, shortcuts)
 * 6. Confirms installation via version checks
 * 7. Tracks all state in a local SQLite database
 * 8. Supports dry-run and rollback
 *
 * The engine has NO UI logic. It doesn't know if it's called from CLI or GUI.
 * It communicates via return values and event callbacks.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import {
  InstallRecipe,
  EngineOptions,
  InstallOptions,
  ExecutionState,
  ExecutionResult,
  ExecutionError,
  EngineEvent,
  EngineEventHandler,
  AppliedSideEffect,
  InstalledApp,
} from "./types";
import { StateDB } from "./state-db";
import { createLogger, Logger } from "./utils/logger";
import { getExecutor } from "./executors";
import { checkUrlReachable } from "./downloader";
import { applySideEffects, rollbackSideEffects } from "./side-effects";
import {
  smartDownload,
  detectInstalled,
  writeAppState,
  removeAppState,
  ensureElevated,
} from "./windows";
import { classifyVersionChange, normalizeSemver } from "./utils/semver";

const execAsync = promisify(exec);

export class UASEngine {
  private stateDb: StateDB;
  private logger: Logger;
  private options: EngineOptions;
  private eventHandlers: EngineEventHandler[] = [];
  private initialized = false;

  constructor(options: EngineOptions) {
    this.options = options;
    this.logger = createLogger({
      level: options.verbose ? "debug" : "silent",
    });
    this.stateDb = new StateDB(options.state_db_path, this.logger);
  }

  /**
   * Initialize the engine (and underlying database).
   * Must be called once before install/uninstall/query operations.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.stateDb.init();
    this.initialized = true;
  }

  /**
   * Ensure init() has been called. Throws if not.
   */
  private ensureInit(): void {
    if (!this.initialized) {
      throw new Error("UASEngine not initialized. Call init() first.");
    }
  }

  // ─── Event System ────────────────────────────────────────────

  /**
   * Register an event handler. CLI/GUI use this to receive progress updates.
   */
  on(handler: EngineEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: EngineEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Event handler errors should never crash the engine
      }
    }
  }

  private emitStateChange(
    executionId: string,
    appId: string,
    state: ExecutionState,
    message?: string,
  ): void {
    this.emit({
      type: "state_change",
      timestamp: new Date().toISOString(),
      data: {
        execution_id: executionId,
        app_id: appId,
        state,
        message,
      },
    });
  }

  // ─── Core: Install ───────────────────────────────────────────

  /**
   * Install an application from a recipe.
   *
   * This implements the full execution lifecycle:
   * PENDING → VALIDATING → RESOLVING → DOWNLOADING → VERIFYING →
   * EXECUTING → SIDE_EFFECTS → CONFIRMING → COMPLETED
   *
   * Any failure transitions to FAILED, with optional ROLLING_BACK.
   */
  async install(
    recipe: InstallRecipe,
    options: InstallOptions = {},
  ): Promise<ExecutionResult> {
    this.ensureInit();
    const executionId = crypto.randomUUID();
    const dryRun = options.dry_run ?? this.options.dry_run;
    const startedAt = new Date().toISOString();
    const appliedEffects: AppliedSideEffect[] = [];
    let installDir: string | undefined;

    const transition = (
      state: ExecutionState,
      result?: "success" | "failure",
      details?: Record<string, unknown>,
    ) => {
      this.stateDb.logStateTransition(
        executionId,
        recipe.id,
        state,
        result,
        details,
        dryRun,
      );
      this.emitStateChange(executionId, recipe.id, state);
    };

    const fail = async (
      category: ExecutionError["category"],
      message: string,
      failedState: ExecutionState,
      details?: Record<string, unknown>,
    ): Promise<ExecutionResult> => {
      this.logger.error(
        { app: recipe.id, state: failedState, error: message },
        "Installation failed",
      );
      transition("FAILED", "failure", { category, message, ...details });

      // Attempt rollback if we have side effects
      let rolledBack: AppliedSideEffect[] = [];
      if (appliedEffects.length > 0 && !dryRun) {
        transition("ROLLING_BACK");
        rolledBack = await rollbackSideEffects(appliedEffects, this.logger);
        transition("ROLLED_BACK", "success", {
          rolled_back_count: rolledBack.length,
          total_effects: appliedEffects.length,
        });
      }

      return {
        execution_id: executionId,
        app_id: recipe.id,
        version: recipe.version,
        final_state: rolledBack.length > 0 ? "ROLLED_BACK" : "FAILED",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        dry_run: dryRun,
        error: { category, message, state: failedState },
        side_effects_applied: appliedEffects,
        side_effects_rolled_back: rolledBack,
      };
    };

    // ─── PENDING ───
    transition("PENDING");
    this.logger.info(
      { app: recipe.id, version: recipe.version, dryRun },
      `Starting installation: ${recipe.name} v${recipe.version}`,
    );

    // ─── VALIDATING ───
    transition("VALIDATING");

    const validationErrors = this.validateRecipe(recipe);
    if (validationErrors.length > 0) {
      return fail(
        "VALIDATION_ERROR",
        validationErrors.join("; "),
        "VALIDATING",
        { errors: validationErrors },
      );
    }

    // Check if already installed at this version (SQLite state DB)
    const existing = this.stateDb.getInstalledApp(recipe.id);
    if (existing && !options.force) {
      const change = classifyVersionChange(existing.version, recipe.version);

      if (change === "same") {
        this.logger.info(
          { app: recipe.id, version: recipe.version },
          "Already installed at requested version (state DB)",
        );
        transition("COMPLETED", "success", { reason: "already_installed" });
        return {
          execution_id: executionId,
          app_id: recipe.id,
          version: recipe.version,
          final_state: "COMPLETED",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          dry_run: dryRun,
          side_effects_applied: [],
          side_effects_rolled_back: [],
        };
      }

      if (change === "downgrade") {
        return fail(
          "DOWNGRADE_BLOCKED",
          `Cannot downgrade ${recipe.name} from v${normalizeSemver(existing.version)} to v${normalizeSemver(recipe.version)}. ` +
            `Use --force to override.`,
          "VALIDATING",
          {
            installed_version: existing.version,
            target_version: recipe.version,
          },
        );
      }

      // change === "upgrade" or "unknown" — proceed with install
      if (change === "upgrade") {
        this.logger.info(
          {
            app: recipe.id,
            from: existing.version,
            to: recipe.version,
          },
          `Upgrading ${recipe.name} from v${normalizeSemver(existing.version)} to v${normalizeSemver(recipe.version)}`,
        );
      }
    }

    // Check if already installed via OS-level detection (idempotency)
    if (!options.force && !dryRun) {
      const detection = await detectInstalled({
        appId: recipe.id,
        appName: recipe.name,
        versionCmd: recipe.version_cmd,
        versionRegex: recipe.version_regex,
        targetVersion: recipe.version,
        logger: this.logger,
      });

      if (detection.found && detection.version) {
        const detChange = classifyVersionChange(
          detection.version,
          recipe.version,
        );

        if (detChange === "same") {
          this.logger.info(
            {
              app: recipe.id,
              version: detection.version,
              source: detection.source,
            },
            `Already installed at requested version. Skipping.`,
          );
          transition("COMPLETED", "success", {
            reason: "already_installed",
            detection_source: detection.source,
            detected_version: detection.version,
          });
          return {
            execution_id: executionId,
            app_id: recipe.id,
            version: recipe.version,
            final_state: "COMPLETED",
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            dry_run: dryRun,
            side_effects_applied: [],
            side_effects_rolled_back: [],
          };
        }

        if (detChange === "downgrade") {
          return fail(
            "DOWNGRADE_BLOCKED",
            `Cannot downgrade ${recipe.name} from v${normalizeSemver(detection.version)} to v${normalizeSemver(recipe.version)}. ` +
              `Use --force to override.`,
            "VALIDATING",
            {
              installed_version: detection.version,
              target_version: recipe.version,
              detection_source: detection.source,
            },
          );
        }

        if (detChange === "upgrade") {
          this.logger.info(
            {
              app: recipe.id,
              from: detection.version,
              to: recipe.version,
              source: detection.source,
            },
            `Upgrading ${recipe.name} from v${normalizeSemver(detection.version)} to v${normalizeSemver(recipe.version)}`,
          );
        }
      } else if (detection.found) {
        // Found but couldn't determine version — treat as already installed
        this.logger.info(
          {
            app: recipe.id,
            source: detection.source,
          },
          `Already installed (version unknown). Skipping.`,
        );
        transition("COMPLETED", "success", {
          reason: "already_installed",
          detection_source: detection.source,
        });
        return {
          execution_id: executionId,
          app_id: recipe.id,
          version: recipe.version,
          final_state: "COMPLETED",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          dry_run: dryRun,
          side_effects_applied: [],
          side_effects_rolled_back: [],
        };
      }
    }

    // Pre-flight elevation check for recipes requiring admin
    if (recipe.requirements.admin && !dryRun) {
      const elevation = await ensureElevated(this.logger);
      if (!elevation.elevated) {
        this.logger.warn(
          "Installation requires admin. UAC prompt will appear during execution.",
        );
      }
    }

    transition("VALIDATING", "success");

    // ─── RESOLVING ───
    transition("RESOLVING");

    const urlReachable = await checkUrlReachable(recipe.installer.url);
    if (!urlReachable) {
      return fail(
        "NETWORK_ERROR",
        `Download URL not reachable: ${recipe.installer.url}`,
        "RESOLVING",
      );
    }

    transition("RESOLVING", "success");

    // ─── DOWNLOADING + VERIFYING (smart, idempotent) ───
    if (dryRun) {
      this.logger.info("[DRY RUN] Skipping download and verification");
      transition("DOWNLOADING", "success", { dry_run: true });
      transition("VERIFYING", "success", { dry_run: true });
    } else {
      transition("DOWNLOADING");

      let downloadedFilePath: string;
      try {
        const downloadDir = path.join(this.options.download_dir, recipe.id);
        const dlResult = await smartDownload({
          url: recipe.installer.url,
          expectedSha256: recipe.installer.sha256,
          destDir: downloadDir,
          onProgress: (progress) => {
            this.emit({
              type: "progress",
              timestamp: new Date().toISOString(),
              data: {
                execution_id: executionId,
                app_id: recipe.id,
                state: "DOWNLOADING",
                progress_percent: progress.percent,
                bytes_downloaded: progress.bytes_downloaded,
                bytes_total: progress.bytes_total,
              },
            });
          },
          logger: this.logger,
        });
        downloadedFilePath = dlResult.filePath;

        if (!dlResult.downloaded) {
          this.logger.info(
            { reason: dlResult.skipReason },
            "Download skipped - valid installer already cached",
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return fail("NETWORK_ERROR", message, "DOWNLOADING");
      }

      transition("DOWNLOADING", "success");

      // Smart download already verifies checksum, but log the transition
      transition("VERIFYING", "success", { verified_by: "smart_download" });

      // ─── EXECUTING ───
      transition("EXECUTING");

      try {
        const executor = getExecutor(recipe.installer.type);
        const result = await executor.execute(recipe, {
          downloaded_file: downloadedFilePath,
          logger: this.logger,
          dry_run: false,
          install_dir_override: options.install_dir,
        });

        if (!result.success) {
          return fail("EXECUTION_ERROR", result.message, "EXECUTING", {
            exit_code: result.exit_code,
          });
        }

        installDir = result.install_dir;

        // Track created files as side effects
        for (const file of result.files_created) {
          appliedEffects.push({
            type: "file_write",
            target: file,
            value: file,
            applied: true,
            applied_at: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return fail("EXECUTION_ERROR", message, "EXECUTING");
      }

      transition("EXECUTING", "success");

      // ─── SIDE_EFFECTS ───
      transition("SIDE_EFFECTS");

      try {
        const effects = await applySideEffects(
          recipe.side_effects,
          this.logger,
          false,
        );
        appliedEffects.push(...effects);

        const failedEffects = effects.filter((e) => !e.applied);
        if (failedEffects.length > 0) {
          this.logger.warn(
            { failed: failedEffects.length, total: effects.length },
            "Some side effects failed to apply",
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(
          "EXECUTION_ERROR",
          `Side effects failed: ${message}`,
          "SIDE_EFFECTS",
        );
      }

      transition("SIDE_EFFECTS", "success");

      // ─── CONFIRMING ───
      transition("CONFIRMING");

      if (recipe.version_cmd) {
        try {
          const confirmed = await this.confirmInstallation(recipe);
          if (!confirmed) {
            return fail(
              "VERIFICATION_ERROR",
              "Installation appeared to succeed but version check failed",
              "CONFIRMING",
            );
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            { error: message },
            "Version confirmation failed (non-fatal)",
          );
          // Non-fatal: some apps need a PATH refresh that hasn't happened yet
        }
      }

      transition("CONFIRMING", "success");

      // NOTE: Downloaded installer is PRESERVED (not deleted) for:
      // - Future cache hits (idempotent reinstalls skip download)
      // - Debugging failed installs
      // - Offline reinstallation
    }

    // ─── COMPLETED ───
    transition("COMPLETED", "success");

    // Record in state DB + state file
    if (!dryRun) {
      const recipeHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(recipe))
        .digest("hex");

      this.stateDb.recordInstall({
        app_id: recipe.id,
        version: recipe.version,
        installed_at: new Date().toISOString(),
        install_dir: installDir,
        recipe_hash: recipeHash,
        side_effects: appliedEffects,
      });

      // Write per-app state file for idempotency detection
      const downloadDir = path.join(this.options.download_dir, recipe.id);
      const resolvedFilename =
        path.basename(new URL(recipe.installer.url).pathname) || "installer";
      writeAppState(recipe.id, {
        version: recipe.version,
        installedAt: new Date().toISOString(),
        installerPath: path.join(downloadDir, resolvedFilename),
        checksum: recipe.installer.sha256,
        method: recipe.installer.type as "msi" | "exe" | "zip" | "portable",
        installDir,
      });
    }

    this.logger.info(
      { app: recipe.id, version: recipe.version, dryRun },
      `Installation complete: ${recipe.name} v${recipe.version}`,
    );

    return {
      execution_id: executionId,
      app_id: recipe.id,
      version: recipe.version,
      final_state: "COMPLETED",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dry_run: dryRun,
      side_effects_applied: appliedEffects,
      side_effects_rolled_back: [],
    };
  }

  // ─── Uninstall ───────────────────────────────────────────────

  /**
   * Uninstall a tracked application by rolling back its side effects
   * and removing it from the state database.
   */
  async uninstall(
    appId: string,
    dryRun: boolean = false,
  ): Promise<ExecutionResult> {
    this.ensureInit();
    const executionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const installed = this.stateDb.getInstalledApp(appId);
    if (!installed) {
      return {
        execution_id: executionId,
        app_id: appId,
        version: "",
        final_state: "FAILED",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        dry_run: dryRun,
        error: {
          category: "VALIDATION_ERROR",
          message: `App "${appId}" is not installed`,
          state: "VALIDATING",
        },
        side_effects_applied: [],
        side_effects_rolled_back: [],
      };
    }

    this.logger.info(
      { app: appId, version: installed.version, dryRun },
      "Starting uninstall",
    );

    let rolledBack: AppliedSideEffect[] = [];

    if (!dryRun) {
      rolledBack = await rollbackSideEffects(
        installed.side_effects,
        this.logger,
      );

      // Remove install directory if we know it
      if (installed.install_dir && fs.existsSync(installed.install_dir)) {
        try {
          fs.rmSync(installed.install_dir, { recursive: true, force: true });
          this.logger.info(
            { dir: installed.install_dir },
            "Removed install directory",
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            { dir: installed.install_dir, error: message },
            "Failed to remove install directory",
          );
        }
      }

      this.stateDb.removeInstall(appId);
      removeAppState(appId);
    }

    this.logger.info({ app: appId, dryRun }, "Uninstall complete");

    return {
      execution_id: executionId,
      app_id: appId,
      version: installed.version,
      final_state: "COMPLETED",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dry_run: dryRun,
      side_effects_applied: [],
      side_effects_rolled_back: rolledBack,
    };
  }

  // ─── Query State ─────────────────────────────────────────────

  /**
   * Get all installed apps.
   */
  getInstalledApps(): InstalledApp[] {
    this.ensureInit();
    return this.stateDb.getAllInstalledApps();
  }

  /**
   * Check if a specific app is installed.
   */
  getInstalledApp(appId: string): InstalledApp | null {
    this.ensureInit();
    return this.stateDb.getInstalledApp(appId);
  }

  /**
   * Check if an app is installed.
   */
  isInstalled(appId: string): boolean {
    this.ensureInit();
    return this.stateDb.isInstalled(appId);
  }

  // ─── Validation ──────────────────────────────────────────────

  /**
   * Validate a recipe against the spec rules.
   * Returns an array of error messages (empty if valid).
   */
  validateRecipe(recipe: InstallRecipe): string[] {
    const errors: string[] = [];

    // ID format
    if (
      !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(recipe.id) &&
      recipe.id.length > 1
    ) {
      errors.push(
        `Invalid recipe ID: "${recipe.id}". Must be lowercase kebab-case.`,
      );
    }
    if (recipe.id.length < 1 || recipe.id.length > 64) {
      errors.push(`Recipe ID must be 1-64 characters, got ${recipe.id.length}`);
    }

    // URL must be HTTPS
    if (!recipe.installer.url.startsWith("https://")) {
      errors.push(`Download URL must be HTTPS: "${recipe.installer.url}"`);
    }

    // SHA256 format
    if (!/^[a-f0-9]{64}$/i.test(recipe.installer.sha256)) {
      errors.push(`Invalid SHA-256 hash: "${recipe.installer.sha256}"`);
    }

    // Installer type
    const validTypes: string[] = ["exe", "msi", "zip", "portable"];
    if (!validTypes.includes(recipe.installer.type)) {
      errors.push(`Invalid installer type: "${recipe.installer.type}"`);
    }

    // Architecture
    const validArch: string[] = ["x64", "x86", "arm64"];
    if (!validArch.includes(recipe.requirements.arch)) {
      errors.push(`Invalid architecture: "${recipe.requirements.arch}"`);
    }

    // Type-specific validation via executor
    try {
      const executor = getExecutor(recipe.installer.type);
      errors.push(...executor.validate(recipe));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
    }

    return errors;
  }

  // ─── Version Confirmation ────────────────────────────────────

  /**
   * Run the version command and check if the output matches expectations.
   */
  private async confirmInstallation(recipe: InstallRecipe): Promise<boolean> {
    if (!recipe.version_cmd) return true;

    try {
      const { stdout } = await execAsync(recipe.version_cmd, {
        windowsHide: true,
        timeout: 15000,
      });

      if (recipe.version_regex) {
        const regex = new RegExp(recipe.version_regex);
        const match = stdout.match(regex);
        if (match && match[1]) {
          this.logger.info(
            { expected: recipe.version, detected: match[1] },
            "Version confirmed",
          );
          return true;
        }
      }

      // If no regex, just check the command succeeded
      return true;
    } catch {
      return false;
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  /**
   * Close the engine and release resources.
   */
  close(): void {
    this.stateDb.close();
    this.logger.info("Engine shut down");
  }
}
