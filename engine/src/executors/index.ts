/**
 * UAS Engine — Executor Registry
 *
 * Maps installer types to their executor implementations.
 * This is the only place where executor types are registered.
 */

import { InstallerType } from "../types";
import { BaseExecutor } from "./base-executor";
import { ExeExecutor } from "./exe-executor";
import { MsiExecutor } from "./msi-executor";
import { ZipExecutor } from "./zip-executor";
import { PortableExecutor } from "./portable-executor";

export { BaseExecutor, ExecutorContext, ExecutorResult } from "./base-executor";

const executors: Map<InstallerType, BaseExecutor> = new Map();

// Register all built-in executors
executors.set("exe", new ExeExecutor());
executors.set("msi", new MsiExecutor());
executors.set("zip", new ZipExecutor());
executors.set("portable", new PortableExecutor());

/**
 * Get the executor for a given installer type.
 *
 * @throws Error if no executor is registered for the type
 */
export function getExecutor(type: InstallerType): BaseExecutor {
  const executor = executors.get(type);
  if (!executor) {
    throw new Error(
      `No executor registered for installer type "${type}". ` +
        `Supported types: ${Array.from(executors.keys()).join(", ")}`,
    );
  }
  return executor;
}

/**
 * Get all supported installer types.
 */
export function getSupportedTypes(): InstallerType[] {
  return Array.from(executors.keys());
}
