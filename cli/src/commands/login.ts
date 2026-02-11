/**
 * UAS CLI — Login / Logout Commands
 *
 * Authenticates with the UAS backend for cloud sync features.
 *
 * Usage:
 *   uas login               Interactive login prompt
 *   uas login --token <t>   Login with API token
 *   uas logout              Clear stored credentials
 */

import { Command } from "commander";
import * as fs from "fs";
import * as readline from "readline";
import { paths, ensureDirectories } from "../config";
import { printSuccess, printError, printInfo, colors } from "../output";

/** Stored auth credentials */
interface AuthFile {
  token: string;
  user: { id: number; username: string; email: string };
  server: string;
}

const DEFAULT_SERVER = process.env.UAS_SERVER || "http://localhost:3000";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Authenticate with the UAS backend")
    .option("--token <token>", "Use an API token instead of interactive login")
    .option("-s, --server <url>", "Backend server URL", DEFAULT_SERVER)
    .action(async (opts: { token?: string; server: string }) => {
      ensureDirectories();

      if (opts.token) {
        // Validate token against the server
        try {
          const res = await fetch(`${opts.server}/api/auth/me`, {
            headers: { Authorization: `Bearer ${opts.token}` },
          });
          if (!res.ok) {
            printError("Invalid token. Please check and try again.");
            process.exit(1);
          }
          const data = (await res.json()) as { user: AuthFile["user"] };
          saveAuth({ token: opts.token, user: data.user, server: opts.server });
          printSuccess(`Logged in as ${colors.bold(data.user.username)}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          printError(`Could not reach server: ${msg}`);
          printInfo(`Is your backend running at ${opts.server}?`);
          process.exit(1);
        }
        return;
      }

      // Interactive login
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const ask = (q: string): Promise<string> =>
        new Promise((res) => rl.question(q, res));

      try {
        const username = await ask("Username: ");
        const password = await ask("Password: ");
        rl.close();

        const res = await fetch(`${opts.server}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          printError(body.error || "Login failed. Check your credentials.");
          process.exit(1);
        }

        const data = (await res.json()) as {
          user: AuthFile["user"];
          token: string;
        };
        saveAuth({ token: data.token, user: data.user, server: opts.server });
        printSuccess(`Logged in as ${colors.bold(data.user.username)}`);
      } catch (err: unknown) {
        rl.close();
        const msg = err instanceof Error ? err.message : String(err);
        printError(`Login failed: ${msg}`);
        process.exit(1);
      }
    });

  program
    .command("logout")
    .description("Clear stored authentication credentials")
    .action(async () => {
      if (fs.existsSync(paths.authToken)) {
        fs.unlinkSync(paths.authToken);
        printSuccess("Logged out. Credentials cleared.");
      } else {
        printInfo("Not currently logged in.");
      }
    });
}

// ─── Auth helpers (exported for sync command) ────────────────

export function loadAuth(): AuthFile | null {
  if (!fs.existsSync(paths.authToken)) return null;
  try {
    return JSON.parse(fs.readFileSync(paths.authToken, "utf-8"));
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthFile): void {
  fs.writeFileSync(paths.authToken, JSON.stringify(auth, null, 2), "utf-8");
}
