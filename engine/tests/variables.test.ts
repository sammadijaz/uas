/**
 * UAS Engine — Path Variable Tests
 */

import { describe, it, expect } from "vitest";
import {
  resolveVariables,
  validateVariables,
  getResolvedVariables,
} from "../src/utils/variables";

describe("resolveVariables", () => {
  it("resolves ${LOCALAPPDATA} to a real path", () => {
    const result = resolveVariables("${LOCALAPPDATA}\\uas\\apps");
    expect(result).not.toContain("${");
    expect(result).toContain("AppData");
  });

  it("resolves ${USERPROFILE} to home directory", () => {
    const result = resolveVariables("${USERPROFILE}\\.config");
    expect(result).not.toContain("${");
    expect(result).toMatch(/^[A-Z]:\\/i);
  });

  it("resolves multiple variables in one string", () => {
    const result = resolveVariables("${LOCALAPPDATA}\\uas\\${TEMP}");
    expect(result).not.toContain("${");
  });

  it("throws on unknown variable", () => {
    expect(() => resolveVariables("${UNKNOWN_VAR}\\test")).toThrow(
      "Unknown path variable",
    );
  });

  it("returns string unchanged if no variables present", () => {
    expect(resolveVariables("C:\\plain\\path")).toBe("C:\\plain\\path");
  });

  it("resolves ${UAS_APPS} to the managed apps directory", () => {
    const result = resolveVariables("${UAS_APPS}\\node");
    expect(result).toContain("uas");
    expect(result).toContain("apps");
    expect(result).toContain("node");
  });
});

describe("validateVariables", () => {
  it("returns empty array for valid variables", () => {
    expect(validateVariables("${LOCALAPPDATA}\\test")).toEqual([]);
  });

  it("returns errors for unknown variables", () => {
    const errors = validateVariables("${BOGUS}\\test");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("BOGUS");
  });

  it("returns empty for no variables", () => {
    expect(validateVariables("C:\\plain\\path")).toEqual([]);
  });
});

describe("getResolvedVariables", () => {
  it("returns all supported variables", () => {
    const vars = getResolvedVariables();
    expect(vars).toHaveProperty("LOCALAPPDATA");
    expect(vars).toHaveProperty("APPDATA");
    expect(vars).toHaveProperty("USERPROFILE");
    expect(vars).toHaveProperty("PROGRAMFILES");
    expect(vars).toHaveProperty("PROGRAMFILES_X86");
    expect(vars).toHaveProperty("TEMP");
    expect(vars).toHaveProperty("UAS_APPS");
  });
});
