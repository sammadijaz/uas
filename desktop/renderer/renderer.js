/**
 * UAS Desktop — Renderer Script
 *
 * Handles UI interactions through the safe window.uas API exposed by preload.
 * No direct Node.js access — all data flows through IPC.
 */

// @ts-check
/// <reference path="../src/main/preload.ts" />

/** @type {typeof window & { uas: import('../src/main/preload').UasApi }} */
const win = /** @type {any} */ (window);
const uas = win.uas;

// ─── Navigation ──────────────────────────────────────────────

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Update nav active state
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Show the matching view
    const viewName = btn.getAttribute("data-view");
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    const target = document.getElementById("view-" + viewName);
    if (target) target.classList.add("active");

    // Load data for the view
    if (viewName === "catalog") loadCatalog();
    if (viewName === "profiles") loadProfiles();
    if (viewName === "settings") loadSettings();
  });
});

// ─── Catalog ─────────────────────────────────────────────────

let allApps = [];

async function loadCatalog() {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;

  try {
    allApps = await uas.catalog.list();
    renderCatalog(allApps);
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Failed to load catalog.</p>';
  }
}

function renderCatalog(apps) {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;

  if (apps.length === 0) {
    grid.innerHTML = '<p class="empty-state">No apps found.</p>';
    return;
  }

  grid.innerHTML = apps
    .map(
      (app) => `
    <div class="app-card" data-app-id="${app.id}">
      <div class="app-card-header">
        <span class="app-card-name">${escapeHtml(app.name)}</span>
        <span class="app-card-version">v${escapeHtml(app.version)}</span>
      </div>
      <p class="app-card-desc">${escapeHtml(app.description)}</p>
      <div class="app-card-tags">
        ${(app.tags || [])
          .slice(0, 4)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("")}
      </div>
    </div>
  `,
    )
    .join("");

  // Attach click handlers
  grid.querySelectorAll(".app-card").forEach((card) => {
    card.addEventListener("click", () => {
      const appId = card.getAttribute("data-app-id");
      if (appId) showAppDetail(appId);
    });
  });
}

// ─── Search ──────────────────────────────────────────────────

const searchInput = document.getElementById("search-input");
let searchTimeout = null;

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const query = searchInput.value.trim();
      if (query.length === 0) {
        renderCatalog(allApps);
      } else {
        const results = await uas.catalog.search(query);
        renderCatalog(results);
      }
    }, 200);
  });
}

// ─── Category Filter ─────────────────────────────────────────

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const filter = btn.getAttribute("data-filter");
    if (filter === "all") {
      renderCatalog(allApps);
    } else {
      const results = await uas.catalog.filterByCategory(filter);
      renderCatalog(results);
    }
  });
});

// ─── App Detail Modal ────────────────────────────────────────

async function showAppDetail(appId) {
  const modal = document.getElementById("app-modal");
  const body = document.getElementById("modal-body");
  if (!modal || !body) return;

  const recipe = await uas.catalog.get(appId);
  if (!recipe) return;

  const installer = recipe.installer || {};
  const requirements = recipe.requirements || {};
  const metadata = recipe.metadata || {};
  const sideEffects = recipe.side_effects || {};

  body.innerHTML = `
    <div class="detail-name">${escapeHtml(recipe.name)}</div>
    <div class="detail-version">v${escapeHtml(recipe.version)} · ${escapeHtml(recipe.license)}</div>
    <p class="detail-desc">${escapeHtml(recipe.description)}</p>

    <div class="detail-section">
      <h4>Installer</h4>
      <div class="detail-row"><span class="detail-key">Type</span><span class="detail-value">${escapeHtml(installer.type)}</span></div>
      <div class="detail-row"><span class="detail-key">Architecture</span><span class="detail-value">${escapeHtml(requirements.arch)}</span></div>
      <div class="detail-row"><span class="detail-key">Admin Required</span><span class="detail-value">${requirements.admin ? "Yes" : "No"}</span></div>
      ${installer.size_bytes ? `<div class="detail-row"><span class="detail-key">Size</span><span class="detail-value">${formatBytes(installer.size_bytes)}</span></div>` : ""}
    </div>

    <div class="detail-section">
      <h4>Side Effects</h4>
      ${
        sideEffects.path?.add
          ? `<div class="detail-row"><span class="detail-key">PATH additions</span><span class="detail-value">${sideEffects.path.add.length}</span></div>`
          : ""
      }
      ${
        sideEffects.env?.set
          ? `<div class="detail-row"><span class="detail-key">Environment variables</span><span class="detail-value">${Object.keys(sideEffects.env.set).length}</span></div>`
          : ""
      }
      ${
        sideEffects.shortcuts
          ? `<div class="detail-row"><span class="detail-key">Shortcuts</span><span class="detail-value">${sideEffects.shortcuts.length}</span></div>`
          : ""
      }
    </div>

    <div class="detail-section">
      <h4>Metadata</h4>
      <div class="detail-row"><span class="detail-key">Categories</span><span class="detail-value">${(metadata.categories || []).join(", ")}</span></div>
      <div class="detail-row"><span class="detail-key">Maintainer</span><span class="detail-value">${escapeHtml(metadata.maintainer || "unknown")}</span></div>
      <div class="detail-row"><span class="detail-key">Updated</span><span class="detail-value">${escapeHtml(metadata.updated || "unknown")}</span></div>
    </div>

    <div class="detail-section">
      <h4>Dependencies</h4>
      <div class="detail-row">
        <span class="detail-value">${(requirements.dependencies || []).length === 0 ? "None" : requirements.dependencies.join(", ")}</span>
      </div>
    </div>

    <button class="btn-primary" onclick="alert('Install coming in a future update')">Install ${escapeHtml(recipe.name)}</button>
  `;

  modal.classList.remove("hidden");
}

// Close modal
document
  .querySelector(".modal-backdrop")
  ?.addEventListener("click", closeModal);
document.querySelector(".modal-close")?.addEventListener("click", closeModal);

function closeModal() {
  document.getElementById("app-modal")?.classList.add("hidden");
}

// ─── Profiles ────────────────────────────────────────────────

async function loadProfiles() {
  const container = document.getElementById("profiles-list");
  if (!container) return;

  try {
    const profileNames = await uas.profile.list();

    if (profileNames.length === 0) {
      container.innerHTML = '<p class="empty-state">No profiles available.</p>';
      return;
    }

    const profiles = [];
    for (const name of profileNames) {
      const data = await uas.profile.load(name);
      if (data) profiles.push(data);
    }

    container.innerHTML = profiles
      .map(
        (p) => `
      <div class="profile-card">
        <div class="profile-card-name">${escapeHtml(p.name || p.id)}</div>
        <p class="app-card-desc">${escapeHtml(p.description || "")}</p>
        <div class="profile-card-apps">
          ${(p.apps || []).map((a) => `<span class="tag">${escapeHtml(a.id)} ${a.version ? "v" + escapeHtml(a.version) : ""}</span>`).join(" ")}
        </div>
      </div>
    `,
      )
      .join("");
  } catch {
    container.innerHTML = '<p class="empty-state">Failed to load profiles.</p>';
  }
}

// ─── Settings ────────────────────────────────────────────────

async function loadSettings() {
  try {
    const info = await uas.system.info();
    const paths = await uas.system.paths();

    const infoEl = document.getElementById("system-info");
    if (infoEl) {
      infoEl.innerHTML = `
        <div class="info-row"><span class="info-label">Platform</span><span class="info-value">${info.platform}</span></div>
        <div class="info-row"><span class="info-label">Architecture</span><span class="info-value">${info.arch}</span></div>
        <div class="info-row"><span class="info-label">Node.js</span><span class="info-value">${info.nodeVersion}</span></div>
        <div class="info-row"><span class="info-label">Electron</span><span class="info-value">${info.electronVersion}</span></div>
        <div class="info-row"><span class="info-label">Home Directory</span><span class="info-value">${info.homedir}</span></div>
      `;
    }

    const pathsEl = document.getElementById("system-paths");
    if (pathsEl) {
      pathsEl.innerHTML = `
        <div class="info-row"><span class="info-label">UAS Home</span><span class="info-value">${paths.uasHome}</span></div>
        <div class="info-row"><span class="info-label">Catalog Directory</span><span class="info-value">${paths.catalogDir}</span></div>
        <div class="info-row"><span class="info-label">State Database</span><span class="info-value">${paths.dbPath}</span></div>
      `;
    }
  } catch {
    // Silently handle settings load failure
  }
}

// ─── Utility ─────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ─── Initial Load ────────────────────────────────────────────

loadCatalog();
