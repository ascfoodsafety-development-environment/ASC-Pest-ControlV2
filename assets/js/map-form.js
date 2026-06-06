/* ============================================================================
   ASC Pest Control — Centered modals + Leaflet maps (commercial & residential)
   Handles: modal open/close, lazy map init, manual address (forward geocode),
   current location + click-to-pin (reverse geocode), file list, validation, submit.
   ============================================================================ */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const API = (window.ASC_API_BASE || "").replace(/\/$/, "");
  const PE = [-33.9608, 25.6022]; // Gqeberha default centre

  /* ----------------------------------------------------------- maps (defined first — openModal references MAPS) */
  const MAPS = {
    commercial: { mapId: "mapCommercial", addr: "commAddress", lat: "commLat", lng: "commLng", map: null, marker: null },
    residential: { mapId: "mapResidential", addr: "resAddress", lat: "resLat", lng: "resLng", map: null, marker: null },
  };

  /* ----------------------------------------------------------- modal control */
  let lastFocus = null;
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add("open"));
    document.body.style.overflow = "hidden";
    const map = MAPS[id === "commercialModal" ? "commercial" : "residential"];
    if (map) setTimeout(() => ensureMap(map), 80);
    setTimeout(() => { const f = m.querySelector("input, select, button"); f && f.focus(); }, 120);
  }
  function closeModal(m) {
    m.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { m.hidden = true; }, 220);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  /* expose globally so inline onclick and other scripts can call it */
  window.ascOpenModal = openModal;
  window.ascCloseModal = closeModal;

  $$("[data-open-modal]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.openModal)));
  $$(".amodal").forEach((m) => {
    $$("[data-close-modal]", m).forEach((b) => b.addEventListener("click", () => closeModal(m)));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { const o = $(".amodal.open"); if (o) closeModal(o); }
  });
  // CTA links that point at #quote open the commercial modal
  $$('a[href="#quote"]').forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); openModal("commercialModal"); }));

  /* ----------------------------------------------------------- map helpers */
  function ensureMap(cfg) {
    if (cfg.map) { cfg.map.invalidateSize(); return; }
    if (typeof L === "undefined") return;
    cfg.map = L.map(cfg.mapId, { scrollWheelZoom: false }).setView(PE, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(cfg.map);
    cfg.map.on("click", (e) => setPin(cfg, e.latlng.lat, e.latlng.lng, true));
    setTimeout(() => cfg.map.invalidateSize(), 60);
  }

  function setPin(cfg, lat, lng, reverse) {
    if (cfg.marker) cfg.map.removeLayer(cfg.marker);
    cfg.marker = L.marker([lat, lng]).addTo(cfg.map);
    document.getElementById(cfg.lat).value = lat.toFixed(6);
    document.getElementById(cfg.lng).value = lng.toFixed(6);
    cfg.map.flyTo([lat, lng], 16);
    if (reverse) {
      const addr = document.getElementById(cfg.addr);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then((r) => r.json())
        .then((d) => { if (d.display_name) addr.value = d.display_name; })
        .catch(() => {});
    }
  }

  // forward geocode (manual address → map)
  function geocode(key) {
    const cfg = MAPS[key];
    const q = document.getElementById(cfg.addr).value.trim();
    if (!q) return;
    ensureMap(cfg);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", South Africa")}`)
      .then((r) => r.json())
      .then((list) => {
        if (list && list[0]) setPin(cfg, parseFloat(list[0].lat), parseFloat(list[0].lon), false);
        else alert("Address not found — try refining it, or drop a pin on the map.");
      })
      .catch(() => {});
  }
  $$("[data-geocode]").forEach((b) => b.addEventListener("click", () => geocode(b.dataset.geocode)));
  $$("[data-locate]").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.locate, cfg = MAPS[key];
      const label = b.querySelector(".loc-label") || b;
      ensureMap(cfg);
      if (!("geolocation" in navigator)) { alert("Geolocation not supported — type your address or drop a pin."); return; }
      const prev = label.textContent; label.textContent = "Locating…"; b.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (p) => { setPin(cfg, p.coords.latitude, p.coords.longitude, true); label.textContent = prev; b.disabled = false; },
        () => { alert("Couldn't get your location — type your address or drop a pin."); label.textContent = prev; b.disabled = false; }
      );
    }));

  /* ----------------------------------------------------------- residential file upload */
  const resFiles = $("#resFiles"), resList = $("#resFileList"), resDrop = $("#resDrop");
  if (resFiles && resList) {
    const render = () => {
      resList.innerHTML = "";
      [...resFiles.files].forEach((f) => {
        const li = document.createElement("li");
        li.textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
        resList.appendChild(li);
      });
    };
    resFiles.addEventListener("change", render);
    if (resDrop) {
      ["dragover", "dragenter"].forEach((ev) => resDrop.addEventListener(ev, (e) => { e.preventDefault(); resDrop.classList.add("drag"); }));
      ["dragleave", "drop"].forEach((ev) => resDrop.addEventListener(ev, (e) => { e.preventDefault(); resDrop.classList.remove("drag"); }));
      resDrop.addEventListener("drop", (e) => { if (e.dataTransfer?.files) { resFiles.files = e.dataTransfer.files; render(); } });
    }
  }

  /* ----------------------------------------------------------- submit */
  function done(form) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.textContent = "Thank you — we'll be in touch!"; btn.style.background = "var(--success)"; btn.disabled = true; }
    setTimeout(() => { const m = form.closest(".amodal"); if (m) closeModal(m); }, 1600);
  }

  function handleSubmit(form, opts) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      $$("input[required], select[required], textarea[required]", form).forEach((el) => {
        const bad = !el.value.trim(); el.style.borderColor = bad ? "var(--danger)" : ""; if (bad) ok = false;
      });
      const services = $$('input[name="services"]:checked', form);
      if (services.length === 0) { ok = false; alert("Please tick at least one service."); }
      if (opts.clientType && !form.querySelector('input[name="clientType"]:checked')) { ok = false; alert("Please select Commercial or Industrial."); }
      const lat = form.querySelector('input[name="latitude"]')?.value || '';
      const addr = form.querySelector('input[name="address"]')?.value?.trim() || '';
      if (!lat && !addr) { ok = false; alert("Please enter your address, or drop a pin on the map."); }
      if (!ok) return;

      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      data.services = services.map((c) => c.value);
      try {
        fetch(`${API}/v1/leads`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "web_form",
            customer: { full_name: data.contactName || `${data.firstName || ""} ${data.lastName || ""}`.trim(), phone: data.contactPhone || data.phone, email: data.contactEmail || data.email },
            site: { label: opts.kind, address: data.address || "" },
            message: `[${opts.kind}] services=${data.services.join(",")} ${data.date ? "date=" + data.date + " " + (data.time || "") : ""}`,
          }),
        }).catch(() => {});
      } catch { /* offline */ }
      console.log(`${opts.kind} submitted:`, data);
      done(form);
    });
  }
  const commForm = $("#commercialForm");
  const resForm = $("#residentialForm");
  if (commForm) handleSubmit(commForm, { kind: "commercial", clientType: true });
  if (resForm) handleSubmit(resForm, { kind: "residential" });
})();
