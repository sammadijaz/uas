#!/usr/bin/env node

/**
 * Bundle script for UAS CLI
 *
 * Uses esbuild to produce a single-file CommonJS bundle that inlines
 * @uas/engine and every pure-JS dependency so the published npm package
 * is fully self-contained.
 *
 * Dependencies that ship native / WASM artefacts are kept external so
 * npm installs them normally on the consumer's machine.
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

// The source index.ts already has #!/usr/bin/env node — tell esbuild NOT to
// duplicate it.  We'll ensure exactly one shebang in a post-build step.
// Deps that must remain external (native addons, WASM, or heavy binary)
const EXTERNAL = [
  "sql.js", // ships a .wasm file
];

async function bundle() {
  const outdir = path.resolve(__dirname, "..", "publish", "dist");

  // Clean previous build
  fs.rmSync(path.resolve(__dirname, "..", "publish"), {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(outdir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "..", "src", "index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: path.join(outdir, "index.js"),
    external: EXTERNAL,
    sourcemap: true,
    // Minify identifiers only; keep code readable for debugging
    minifySyntax: true,
    // Tree-shake unused engine exports
    treeShaking: true,
    logLevel: "info",
  });

  // ── Ensure exactly one shebang at the top ─────────────────────
  const outFile = path.join(outdir, "index.js");
  let code = fs.readFileSync(outFile, "utf8");
  // Strip any existing shebangs
  code = code.replace(/^#!.*\r?\n/gm, "");
  code = "#!/usr/bin/env node\n" + code;
  fs.writeFileSync(outFile, code);

  // ── Copy static assets into publish/ ──────────────────────────
  const publishDir = path.resolve(__dirname, "..", "publish");

  // Copy README
  const readme = path.resolve(__dirname, "..", "README.md");
  if (fs.existsSync(readme)) {
    fs.copyFileSync(readme, path.join(publishDir, "README.md"));
  }

  // Copy LICENSE from repo root (if present)
  const license =
    path.resolve(__dirname, "..", "LICENSE") ||
    path.resolve(__dirname, "..", "..", "LICENSE");
  for (const l of [
    path.resolve(__dirname, "..", "LICENSE"),
    path.resolve(__dirname, "..", "..", "LICENSE"),
  ]) {
    if (fs.existsSync(l)) {
      fs.copyFileSync(l, path.join(publishDir, "LICENSE"));
      break;
    }
  }

  // Build a clean package.json for publishing
  const srcPkg = require(path.resolve(__dirname, "..", "package.json"));

  // Only keep the external deps as real dependencies
  const deps = {};
  for (const ext of EXTERNAL) {
    // Look in engine deps first, then CLI deps
    const enginePkg = require(
      path.resolve(__dirname, "..", "..", "engine", "package.json"),
    );
    const version =
      (enginePkg.dependencies && enginePkg.dependencies[ext]) ||
      (srcPkg.dependencies && srcPkg.dependencies[ext]) ||
      "*";
    deps[ext] = version;
  }

  const publishPkg = {
    name: srcPkg.name,
    version: srcPkg.version,
    description: srcPkg.description,
    main: "dist/index.js",
    types: undefined, // no types in bundled publish
    bin: {
      uas: "dist/index.js",
    },
    files: ["dist/", "README.md", "LICENSE"],
    keywords: srcPkg.keywords,
    author: srcPkg.author,
    license: srcPkg.license,
    repository: srcPkg.repository,
    homepage: srcPkg.homepage,
    bugs: srcPkg.bugs,
    dependencies: deps,
    engines: srcPkg.engines,
  };

  fs.writeFileSync(
    path.join(publishDir, "package.json"),
    JSON.stringify(publishPkg, null, 2) + "\n",
  );

  console.log("\n✔ Publish folder ready at cli/publish/");
  console.log("  To publish: cd publish && npm publish --access public");
}

bundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
