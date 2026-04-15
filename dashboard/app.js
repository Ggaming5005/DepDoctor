// ============================================================
// depdoctor Dashboard — Vanilla JS
// ============================================================

(function () {
  "use strict";

  // ---- State ----
  let analysisData = null;
  let currentSort = { key: "score", asc: true };

  // ---- DOM Refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    btnAnalyze: $("#btn-analyze"),
    btnMigrate: $("#btn-migrate"),
    btnBadge: $("#btn-badge"),
    chkDepcheck: $("#chk-depcheck"),
    themeToggle: $("#theme-toggle"),
    scoreSection: $("#score-section"),
    scoreValue: $("#score-value"),
    scoreRingFill: $("#score-ring-fill"),
    scoreMeta: $("#score-meta"),
    issuesSection: $("#issues-section"),
    issuesList: $("#issues-list"),
    tableControls: $("#table-controls"),
    tableSection: $("#table-section"),
    resultsBody: $("#results-body"),
    searchInput: $("#search-input"),
    filterSelect: $("#filter-select"),
    migrateSection: $("#migrate-section"),
    migrateList: $("#migrate-list"),
    badgeSection: $("#badge-section"),
    badgeContent: $("#badge-content"),
    loading: $("#loading"),
    loadingText: $("#loading-text"),
    toastContainer: $("#toast-container"),
  };

  // ---- API Client ----
  async function api(path, body = {}) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ---- Theme Manager ----
  function initTheme() {
    const saved = localStorage.getItem("depdoctor-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);

    els.themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("depdoctor-theme", next);
    });
  }

  // ---- Loading ----
  function showLoading(text) {
    els.loadingText.textContent = text;
    els.loading.classList.remove("hidden");
  }

  function hideLoading() {
    els.loading.classList.add("hidden");
  }

  // ---- Toast ----
  function toast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    els.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ---- Score Gauge ----
  function updateScore(score, meta) {
    els.scoreSection.classList.remove("hidden");
    els.scoreValue.textContent = score;

    // Ring animation
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (score / 100) * circumference;
    els.scoreRingFill.style.strokeDashoffset = offset;

    // Color based on score
    let color;
    if (score >= 75) color = "var(--green)";
    else if (score >= 50) color = "var(--yellow)";
    else color = "var(--red)";
    els.scoreRingFill.style.stroke = color;
    els.scoreValue.style.color = color;

    // Meta info
    if (meta) {
      els.scoreMeta.textContent = `${meta.packageCount} packages \u00B7 ${(meta.durationMs / 1000).toFixed(1)}s`;
    }
  }

  // ---- Issues ----
  function updateIssues(packages, audit) {
    const deprecated = packages.filter((p) => p.deprecated);
    const vulnCount = audit.count;
    const unused = packages.filter((p) => p.unused);
    const outdated = packages.filter(
      (p) => p.latest && p.installed && p.latest !== p.installed
    );

    const badges = [];

    if (deprecated.length > 0)
      badges.push({ text: `${deprecated.length} deprecated`, cls: "red" });
    if (vulnCount > 0)
      badges.push({ text: `${vulnCount} vulnerabilities`, cls: "red" });
    if (outdated.length > 0)
      badges.push({ text: `${outdated.length} outdated`, cls: "yellow" });
    if (unused.length > 0)
      badges.push({ text: `${unused.length} unused`, cls: "yellow" });

    if (badges.length === 0)
      badges.push({ text: "No issues found", cls: "green" });

    els.issuesList.innerHTML = badges
      .map((b) => `<span class="issue-badge ${b.cls}">${b.text}</span>`)
      .join("");
    els.issuesSection.classList.remove("hidden");
  }

  // ---- Table ----
  function formatBytes(bytes) {
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + " KB";
    return bytes + " B";
  }

  function formatDownloads(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function scoreClass(score) {
    if (score >= 75) return "score-high";
    if (score >= 50) return "score-mid";
    return "score-low";
  }

  function renderTable(packages) {
    // Apply filter
    const filter = els.filterSelect.value;
    const search = els.searchInput.value.toLowerCase();

    let filtered = packages;
    if (filter === "prod") filtered = filtered.filter((p) => !p.isDev);
    else if (filter === "dev") filtered = filtered.filter((p) => p.isDev);
    else if (filter === "issues")
      filtered = filtered.filter(
        (p) => p.deprecated || p.unused || p.vulnerabilities.length > 0 || p.score < 50
      );

    if (search) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(search));
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const key = currentSort.key;
      let va, vb;

      switch (key) {
        case "name":
          va = a.name;
          vb = b.name;
          break;
        case "score":
          va = a.score;
          vb = b.score;
          break;
        case "vulns":
          va = a.vulnerabilities.length;
          vb = b.vulnerabilities.length;
          break;
        case "downloads":
          va = a.downloads || 0;
          vb = b.downloads || 0;
          break;
        case "size":
          va = a.size?.gzipBytes || 0;
          vb = b.size?.gzipBytes || 0;
          break;
        default:
          va = a[key] || "";
          vb = b[key] || "";
      }

      if (typeof va === "string") {
        return currentSort.asc
          ? va.localeCompare(vb)
          : vb.localeCompare(va);
      }
      return currentSort.asc ? va - vb : vb - va;
    });

    // Render rows
    els.resultsBody.innerHTML = sorted
      .map((pkg) => {
        const tags = [];
        if (pkg.deprecated) tags.push('<span class="tag tag-dep">dep</span>');
        if (pkg.unused) tags.push('<span class="tag tag-unused">unused</span>');
        if (pkg.isDev) tags.push('<span class="tag tag-dev">dev</span>');

        const vulnHtml =
          pkg.vulnerabilities.length > 0
            ? `<span class="vuln-count">${pkg.vulnerabilities.length}</span>`
            : '<span class="vuln-zero">0</span>';

        return `<tr>
          <td>
            <a href="https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}"
               target="_blank" rel="noopener" class="pkg-name">${escapeHtml(pkg.name)}</a>
            ${tags.join("")}
          </td>
          <td>${pkg.installed || '<span class="text-muted">?</span>'}</td>
          <td>${pkg.latest || '<span class="text-muted">?</span>'}</td>
          <td class="score-cell ${scoreClass(pkg.score)}">${pkg.score}</td>
          <td>${vulnHtml}</td>
          <td>${pkg.downloads != null ? formatDownloads(pkg.downloads) : '<span class="text-muted">?</span>'}</td>
          <td>${pkg.size ? formatBytes(pkg.size.gzipBytes) : '<span class="text-muted">?</span>'}</td>
        </tr>`;
      })
      .join("");

    els.tableControls.classList.remove("hidden");
    els.tableSection.classList.remove("hidden");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Column Sorting ----
  function initSorting() {
    $$(".results-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (currentSort.key === key) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort = { key, asc: true };
        }
        if (analysisData) renderTable(analysisData.result.packages);
      });
    });
  }

  // ---- Migration Renderer ----
  function renderMigrations(suggestions) {
    if (suggestions.length === 0) {
      els.migrateList.innerHTML =
        '<p style="color: var(--green);">No deprecated or stale packages found!</p>';
    } else {
      els.migrateList.innerHTML = suggestions
        .map((s) => {
          const riskTag =
            s.risk === "deprecated"
              ? '<span class="tag tag-dep">deprecated</span>'
              : '<span class="tag" style="background: rgba(210,153,34,0.15); color: var(--yellow);">stale</span>';

          const alts =
            s.alternatives.length > 0
              ? `Alternatives: ${s.alternatives.map((a) => `<code>${escapeHtml(a)}</code>`).join(", ")}`
              : "No known alternatives";

          return `<div class="migrate-card">
            <div class="migrate-card-header">
              <strong>${escapeHtml(s.name)}</strong>
              ${riskTag}
            </div>
            ${s.reason ? `<div class="migrate-reason">${escapeHtml(s.reason)}</div>` : ""}
            <div class="migrate-alternatives">${alts}</div>
          </div>`;
        })
        .join("");
    }
    els.migrateSection.classList.remove("hidden");
  }

  // ---- Event Handlers ----
  async function handleAnalyze() {
    showLoading("Analyzing dependencies...");
    hideAllSections();

    try {
      const data = await api("/api/analyze", {
        options: { depcheck: els.chkDepcheck.checked },
      });

      analysisData = data;
      updateScore(data.result.projectScore, data.result.meta);
      updateIssues(data.result.packages, data.result.audit);
      renderTable(data.result.packages);
      toast("Analysis complete");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      hideLoading();
    }
  }

  async function handleMigrate() {
    showLoading("Checking for deprecated packages...");
    hideAllSections();

    try {
      const data = await api("/api/migrate");
      renderMigrations(data.suggestions);
      toast(`Found ${data.suggestions.length} migration suggestions`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      hideLoading();
    }
  }

  async function handleBadge() {
    showLoading("Generating badge...");

    try {
      const data = await api("/api/badge");
      const markdown = `![depdoctor score](${data.url})`;

      els.badgeContent.innerHTML = `
        <img src="${data.url}" alt="depdoctor score: ${data.score}" />
        <p style="margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);">Markdown:</p>
        <code>${escapeHtml(markdown)}</code>
      `;
      els.badgeSection.classList.remove("hidden");
      toast("Badge generated");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      hideLoading();
    }
  }

  function hideAllSections() {
    els.scoreSection.classList.add("hidden");
    els.issuesSection.classList.add("hidden");
    els.tableControls.classList.add("hidden");
    els.tableSection.classList.add("hidden");
    els.migrateSection.classList.add("hidden");
    els.badgeSection.classList.add("hidden");
  }

  // ---- Init ----
  function init() {
    initTheme();
    initSorting();

    els.btnAnalyze.addEventListener("click", handleAnalyze);
    els.btnMigrate.addEventListener("click", handleMigrate);
    els.btnBadge.addEventListener("click", handleBadge);

    // Live filtering
    els.searchInput.addEventListener("input", () => {
      if (analysisData) renderTable(analysisData.result.packages);
    });
    els.filterSelect.addEventListener("change", () => {
      if (analysisData) renderTable(analysisData.result.packages);
    });
  }

  init();
})();
