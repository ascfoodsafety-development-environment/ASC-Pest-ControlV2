/**
 * ASC Pest Control Hub — hub.js
 * Auth flow, API client, RBAC routing, dashboard data loading.
 * Requires permissions.js loaded first.
 */
(() => {
  "use strict";

  /* ─────────────── Config ─────────────── */
  const API = (
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.port === "5500" ||
    location.port === "8080"
      ? "http://127.0.0.1:8000"
      : window.ASC_API_BASE || location.origin
  ).replace(/\/$/, "");

  /* ─────────────── Token store ─────────────── */
  const Store = {
    set(token, role, branchId, userId) {
      sessionStorage.setItem("asc_token",     token);
      sessionStorage.setItem("asc_role",      role);
      sessionStorage.setItem("asc_branch_id", branchId || "");
      sessionStorage.setItem("asc_user_id",   userId   || "");
    },
    clear() { ["asc_token","asc_role","asc_branch_id","asc_user_id"].forEach(k => sessionStorage.removeItem(k)); },
    get token()    { return sessionStorage.getItem("asc_token")     || ""; },
    get role()     { return sessionStorage.getItem("asc_role")      || ""; },
    get branchId() { return sessionStorage.getItem("asc_branch_id") || null; },
    get userId()   { return sessionStorage.getItem("asc_user_id")   || ""; },
    get principal() { return { user_id: this.userId, role: this.role, branch_id: this.branchId }; },
    get isAuthed() { return !!this.token && !!this.role; },
  };

  /* ─────────────── HTTP client ─────────────── */
  async function api(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (Store.token) headers["Authorization"] = `Bearer ${Store.token}`;
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw Object.assign(new Error(err.detail || res.statusText), { status: res.status });
    }
    return res.status === 204 ? null : res.json();
  }
  const GET  = (p)    => api("GET",  p);
  const POST = (p, b) => api("POST", p, b);
  const PUT  = (p, b) => api("PUT",  p, b);

  /* ─────────────── DOM helpers ─────────────── */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const show  = el => el && (el.style.display = "");
  const hide  = el => el && (el.style.display = "none");
  const text  = (el, t) => el && (el.textContent = t);
  const html  = (el, h) => el && (el.innerHTML  = h);
  const cents = n => `R ${(n / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")}`;
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-ZA", { day:"2-digit", month:"short", year:"numeric" }) : "—";

  function badge(label, type) {
    const map = { green:"b-green", amber:"b-amber", red:"b-red", blue:"b-blue", grey:"b-grey" };
    return `<span class="badge ${map[type]||"b-grey"}">${label}</span>`;
  }
  function statusBadge(s) {
    const m = {
      new:"blue", qualifying:"amber", quoted:"amber", won:"green", lost:"red",
      draft:"grey", scheduled:"blue", en_route:"amber", in_progress:"amber",
      completed:"green", cancelled:"red", issued:"blue", paid:"green", overdue:"red",
    };
    return badge(s.replace(/_/g," "), m[s]||"grey");
  }

  /* ─────────────── Auth screens ─────────────── */
  let otpIdentifier = "";

  function showAuth(step) {
    $$(".auth-step").forEach(el => el.classList.remove("on"));
    const el = $(`#auth-step-${step}`);
    if (el) el.classList.add("on");
  }

  async function handleRequestOtp() {
    const identifierEl = $(".auth-identifier");
    if (!identifierEl) return;
    otpIdentifier = identifierEl.value.trim();
    if (!otpIdentifier) { identifierEl.focus(); return; }
    try {
      setAuthLoading(true);
      const res = await POST("/v1/auth/otp/request", { identifier: otpIdentifier });
      showAuth("otp");
      // dev: pre-fill code if server exposes it
      if (res.dev_code) {
        $$(".otp-box").forEach((b, i) => { b.value = res.dev_code[i] || ""; });
      }
    } catch (e) {
      showAuthError(e.message);
    } finally { setAuthLoading(false); }
  }

  async function handleVerifyOtp() {
    const code = $$(".otp-box").map(b => b.value).join("").trim();
    if (code.length < 6) { $(".otp-box")?.focus(); return; }
    try {
      setAuthLoading(true);
      const res = await POST("/v1/auth/otp/verify", { identifier: otpIdentifier, code });
      Store.set(res.access_token, res.role, res.branch_id, res.user_id);
      enterHub();
    } catch (e) {
      showAuthError(e.message);
    } finally { setAuthLoading(false); }
  }

  function setAuthLoading(on) {
    $$(".auth-btn").forEach(b => { b.disabled = on; b.textContent = on ? "Please wait…" : b.dataset.label; });
  }
  function showAuthError(msg) {
    const el = $(".auth-error");
    if (el) { el.textContent = msg; show(el); setTimeout(() => hide(el), 5000); }
  }

  /* OTP box auto-advance */
  document.addEventListener("input", e => {
    if (e.target.classList.contains("otp-box")) {
      const boxes = $$(".otp-box");
      const idx = boxes.indexOf(e.target);
      if (e.target.value && idx < boxes.length - 1) boxes[idx + 1].focus();
    }
  });

  /* ─────────────── Hub entry / routing ─────────────── */
  function enterHub() {
    hide($("#auth-overlay"));
    const view = ROLE_DASHBOARD[Store.role] || "client";
    showDashboard(view);
    updateNavBadge();
    loadDashboard(view);
  }

  function showDashboard(view) {
    $$(".screen").forEach(el => el.classList.remove("active"));
    const el = $(`#screen-${view}`);
    if (el) el.classList.add("active");
    // update sidebar active item
    $$(".nav-item").forEach(n => n.classList.remove("on"));
    $$(`[data-view="${view}"]`).forEach(n => n.classList.add("on"));
    updateSidebarUser();
  }

  function updateSidebarUser() {
    const role = Store.role;
    $$(".sidebar-role-label").forEach(el => { el.textContent = role.replace(/_/g, " "); });
    $$(".sidebar-user-initials").forEach(el => {
      el.textContent = role === "customer" ? "C" : role.substring(0,2).toUpperCase();
    });
  }

  function updateNavBadge() {
    // signal to home-v2 page (opened in another tab/window) via localStorage
    try { localStorage.setItem("asc_role", Store.role); } catch {}
  }

  /* ─────────────── Dashboard loaders ─────────────── */
  async function loadDashboard(view) {
    try {
      if (view === "client")     await loadClientDash();
      if (view === "admin")      await loadAdminDash();
      if (view === "technician") await loadTechDash();
      if (view === "org")        await loadOrgDash();
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
  }

  /* ── Client dashboard ── */
  async function loadClientDash() {
    if (!can(Store.role, "bookings_view_own") && !can(Store.role, "quotes_view")) return;

    // Load invoices
    try {
      const invoices = await GET("/v1/billing/invoices");
      renderClientInvoices(invoices);
    } catch {}

    // Load jobs
    try {
      const jobs = await GET("/v1/scheduling/jobs");
      renderClientJobs(jobs);
    } catch {}
  }

  function renderClientInvoices(invoices) {
    const tbody = $("#client-invoices-tbody");
    if (!tbody) return;
    if (!invoices?.length) { html(tbody, `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px">No invoices yet</td></tr>`); return; }
    html(tbody, invoices.slice(0, 5).map(inv => `
      <tr>
        <td class="t-strong">${inv.number}</td>
        <td class="t-sub">${fmtDate(inv.created_at)}</td>
        <td class="t-strong">${cents(inv.total_cents)}</td>
        <td>${statusBadge(inv.status)}</td>
      </tr>`).join(""));
    // total outstanding
    const due = invoices.filter(i => i.status === "issued" || i.status === "overdue")
                        .reduce((s, i) => s + i.total_cents, 0);
    text($("#client-outstanding"), cents(due));
  }

  function renderClientJobs(jobs) {
    const el = $("#client-next-service");
    if (!el || !jobs?.length) return;
    const next = jobs.find(j => ["scheduled","en_route"].includes(j.status));
    if (next) {
      text(el, fmtDate(next.scheduled_start));
      text($("#client-next-service-note"), next.status.replace("_"," "));
    }
    const last = jobs.filter(j => j.status === "completed").sort((a,b) =>
      new Date(b.completed_at) - new Date(a.completed_at))[0];
    if (last) text($("#client-last-service"), fmtDate(last.completed_at));
  }

  /* ── Admin dashboard ── */
  async function loadAdminDash() {
    if (!can(Store.role, "analytics_view")) return;
    try {
      const data = await GET("/v1/analytics/summary");
      renderAdminStats(data);
      renderAdminLeadsPipeline(data.recent_leads);
    } catch {}
    try {
      const jobs = await GET("/v1/scheduling/jobs");
      renderAdminSchedule(jobs);
    } catch {}
    try {
      const invoices = await GET("/v1/billing/invoices");
      renderAdminInvoices(invoices);
    } catch {}
  }

  function renderAdminStats(data) {
    text($("#admin-stat-leads"),      data.total_leads      ?? "—");
    text($("#admin-stat-new-leads"),  data.new_leads        ?? "—");
    text($("#admin-stat-conversion"), `${((data.conversion_rate || 0)*100).toFixed(0)}%`);
    text($("#admin-stat-quotes"),     data.total_quotes     ?? "—");
  }

  function renderAdminLeadsPipeline(leads) {
    const el = $("#admin-leads-table");
    if (!el || !leads?.length) return;
    html(el, `<table><thead><tr><th>Reference</th><th>Source</th><th>Services</th><th>Date</th><th>Status</th></tr></thead><tbody>
      ${leads.slice(0,8).map(l => `<tr>
        <td class="t-strong">${l.reference}</td>
        <td>${l.source}</td>
        <td class="t-sub">${(l.service_interest||[]).join(", ")||"—"}</td>
        <td class="t-sub">${fmtDate(l.created_at)}</td>
        <td>${statusBadge(l.status)}</td>
      </tr>`).join("")}
      </tbody></table>`);
  }

  function renderAdminSchedule(jobs) {
    const el = $("#admin-schedule-tbody");
    if (!el) return;
    const today = jobs?.filter(j => j.scheduled_start?.startsWith(new Date().toISOString().slice(0,10))) || [];
    if (!today.length) { html(el, `<tr><td colspan="4" style="text-align:center;padding:14px;color:var(--muted)">No jobs scheduled today</td></tr>`); return; }
    html(el, today.slice(0,8).map(j => `
      <tr>
        <td class="t-strong">${j.scheduled_start ? new Date(j.scheduled_start).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"}) : "—"}</td>
        <td><div class="t-strong">${j.id.slice(-8)}</div><div class="t-sub">${j.branch_id}</div></td>
        <td>${j.technician_id ? j.technician_id.slice(-6) : "Unassigned"}</td>
        <td>${statusBadge(j.status)}</td>
      </tr>`).join(""));
  }

  function renderAdminInvoices(invoices) {
    const el = $("#admin-invoices-tbody");
    if (!el) return;
    if (!invoices?.length) { html(el, `<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--muted)">No invoices</td></tr>`); return; }
    html(el, invoices.slice(0,6).map(inv => `
      <tr>
        <td class="t-strong">${inv.number}</td>
        <td>${inv.customer_id.slice(-8)}</td>
        <td class="t-strong">${cents(inv.total_cents)}</td>
        <td class="t-sub">${fmtDate(inv.created_at)}</td>
        <td>${statusBadge(inv.status)}</td>
      </tr>`).join(""));

    // Outstanding metric
    const overdue = invoices.filter(i => i.status === "overdue").reduce((s,i) => s+i.total_cents, 0);
    text($("#admin-stat-overdue"), cents(overdue));
  }

  /* ── Technician dashboard ── */
  async function loadTechDash() {
    if (!can(Store.role, "scheduling_view")) return;
    try {
      const jobs = await GET("/v1/scheduling/jobs");
      renderTechJobs(jobs);
    } catch {}
  }

  function renderTechJobs(jobs) {
    const el = $("#tech-jobs-list");
    if (!el) return;
    const today = new Date().toISOString().slice(0,10);
    const mine  = jobs?.filter(j => j.scheduled_start?.startsWith(today)) || [];
    if (!mine.length) { html(el, `<div class="job-empty">No jobs scheduled today</div>`); return; }
    html(el, mine.map(j => {
      const isActive = ["en_route","in_progress"].includes(j.status);
      return `<div class="jobcard${isActive?" cur":""}">
        <div class="tm">${j.scheduled_start ? new Date(j.scheduled_start).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"}) : "—"}</div>
        <div class="jb">
          <div class="jn">Job ${j.id.slice(-8)}</div>
          <div class="js">${j.branch_id}</div>
        </div>
        ${statusBadge(j.status)}
        ${can(Store.role,"jobs_transition") && j.status==="scheduled"
          ? `<button class="btn primary" style="font-size:12px;padding:7px 12px" onclick="hubTransitionJob('${j.id}','en_route')">Start →</button>` : ""}
        ${can(Store.role,"jobs_transition") && j.status==="en_route"
          ? `<button class="btn primary" style="font-size:12px;padding:7px 12px" onclick="hubTransitionJob('${j.id}','in_progress')">Arrived</button>` : ""}
        ${can(Store.role,"jobs_transition") && j.status==="in_progress"
          ? `<button class="btn primary" style="font-size:12px;padding:7px 12px" onclick="hubTransitionJob('${j.id}','completed')">Complete</button>` : ""}
      </div>`;
    }).join(""));
  }

  /* ── Org dashboard ── */
  async function loadOrgDash() {
    // Same as admin but scoped to customer's sites
    await loadAdminDash();
  }

  /* ─────────────── Job transition ─────────────── */
  window.hubTransitionJob = async function(jobId, to) {
    if (!can(Store.role, "jobs_transition")) return;
    try {
      await PUT(`/v1/scheduling/jobs/${jobId}/transition`, { to });
      await loadDashboard(ROLE_DASHBOARD[Store.role]);
    } catch (e) { alert(e.message); }
  };

  /* ─────────────── New booking (from hub) ─────────────── */
  window.hubNewBooking = function() {
    // Delegates to the modal system on the parent landing page if in iframe,
    // otherwise opens the contact section
    if (window.opener) window.opener.document.querySelector("#contact")?.scrollIntoView({behavior:"smooth"});
    else window.open("../home-v2.html#contact", "_blank");
  };

  /* ─────────────── Sign out ─────────────── */
  window.hubSignOut = function() {
    Store.clear();
    try { localStorage.removeItem("asc_role"); } catch {}
    show($("#auth-overlay"));
    showAuth("login");
  };

  /* ─────────────── Auth form wiring ─────────────── */
  window.hubShowAuth = showAuth;

  window.hubRequestOtp = handleRequestOtp;
  window.hubVerifyOtp  = handleVerifyOtp;

  /* ─────────────── Boot ─────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    // Restore session if token still valid
    if (Store.isAuthed) {
      // Silently verify token still good
      GET("/v1/auth/me").then(me => {
        Store.set(Store.token, me.role, me.branch_id, me.user_id);
        enterHub();
      }).catch(() => {
        Store.clear();
        show($("#auth-overlay"));
        showAuth("login");
      });
    } else {
      show($("#auth-overlay"));
      showAuth("login");
    }

    // Wire auth buttons
    $$("#hub-btn-request-otp").forEach(b => b.addEventListener("click", handleRequestOtp));
    $$("#hub-btn-verify-otp") .forEach(b => b.addEventListener("click", handleVerifyOtp));
    $$("#hub-btn-signout")    .forEach(b => b.addEventListener("click", hubSignOut));

    // Enter on OTP input
    document.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        if ($(".auth-step.on")?.id === "auth-step-login")   handleRequestOtp();
        if ($(".auth-step.on")?.id === "auth-step-otp")     handleVerifyOtp();
      }
    });

    // Nav items
    $$("[data-nav-view]").forEach(el => {
      el.addEventListener("click", () => {
        const v = el.dataset.navView;
        showDashboard(v);
        loadDashboard(v);
      });
    });
  });

})();
