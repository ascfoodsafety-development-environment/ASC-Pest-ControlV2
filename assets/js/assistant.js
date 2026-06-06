/* Sentinel — ASC Pest Control assistant + booking engine.
   Backend-first: talks to /v1/assistant when reachable.
   Integrated booking: captures sector, contact, services, area, time → POST /v1/leads.
   Falls back to the local engine when offline. */
(() => {
  "use strict";
  const API    = (window.ASC_API_BASE || "").replace(/\/$/, "");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $      = (s) => document.querySelector(s);

  const root      = $("#sentinel");
  const launcher  = $("#sentinel-launcher");
  const panel     = $("#sentinel-panel");
  const closeBtn  = $("#sentinel-close");
  const msgs      = $("#sentinel-messages");
  const form      = $("#sentinel-form");
  const input     = $("#sentinel-input");
  if (!root) return;

  let conversationId = null;
  let started        = false;
  let useBackend     = !!API;

  /* ─────────────────────────────── rendering ─────────────────── */
  const esc = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const linkify = (s) =>
    esc(s)
      .replace(/(\b\d{3}\s?\d{3}\s?\d{4}\b)/g, '<a href="tel:+27611383989">$1</a>')
      .replace(/([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<a href="mailto:$1">$1</a>')
      .replace(/\n/g, "<br>");

  function addMsg(role, payload) {
    const text    = typeof payload === "string" ? payload : (payload?.reply ?? "");
    const sources = typeof payload === "object" ? payload?.sources : null;

    const el = document.createElement("div");
    el.className = `msg ${role === "user" ? "user" : "bot"}`;
    el.innerHTML = linkify(text);

    if (Array.isArray(sources) && sources.length) {
      const s = document.createElement("div");
      s.className = "sentinel-sources";
      s.innerHTML = sources
        .map((src) => (typeof src === "string" ? esc(src)
          : `<a href="${esc(src.href)}" target="_blank" rel="noopener">${esc(src.label || src.href)}</a>`))
        .join(" · ");
      el.appendChild(s);
    }
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addQuickReplies(options) {
    const wrap = document.createElement("div");
    wrap.className = "sentinel-quick";
    wrap.id = "sentinel-quick-wrap";
    options.forEach(({ label, value }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sentinel-quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        wrap.remove();
        handleUserInput(value || label);
      });
      wrap.appendChild(btn);
    });
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeQuickReplies() {
    $("#sentinel-quick-wrap")?.remove();
  }

  function showTyping() {
    const t = document.createElement("div");
    t.className = "typing";
    t.id = "sentinel-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;
  }
  const hideTyping = () => $("#sentinel-typing")?.remove();

  /* ─────────────────────────────── open / close ───────────────── */
  function open() {
    root.dataset.open = "true";
    launcher.setAttribute("aria-expanded", "true");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    panel.classList.remove("minimised");
    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("transform");
    if (!started) start();
    setTimeout(() => input?.focus(), 200);
  }
  function close() {
    root.dataset.open = "false";
    launcher.setAttribute("aria-expanded", "false");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  launcher.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.dataset.open === "true") close();
  });

  /* ─────────────────────────────── conversation start ─────────── */
  async function start() {
    started = true;
    if (useBackend) {
      try {
        const r = await fetch(`${API}/v1/assistant/conversations`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: true }),
        });
        if (!r.ok) throw new Error("bad");
        const d = await r.json();
        conversationId = d.conversation_id;
        addMsg("bot", { reply: d.reply, sources: d.sources });
        return;
      } catch { useBackend = false; }
    }
    const g = Local.start();
    addMsg("bot", g);
    addQuickReplies([
      { label: "📋 Book an inspection" },
      { label: "🏠 Residential services" },
      { label: "🏭 Commercial / Industrial" },
      { label: "📞 Contact details" },
    ]);
  }

  /* ─────────────────────────────── send / receive ─────────────── */
  async function handleUserInput(text) {
    const content = (text || "").trim();
    if (!content) return;
    removeQuickReplies();
    addMsg("user", content);
    input.value = "";
    showTyping();

    let res;
    if (useBackend && conversationId) {
      try {
        const r = await fetch(`${API}/v1/assistant/conversations/${conversationId}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, site_context: siteScan() }),
        });
        if (!r.ok) throw new Error("bad");
        res = await r.json();
      } catch { useBackend = false; res = Local.respond(content); }
    } else {
      res = Local.respond(content);
    }

    const delay = reduce ? 0 : 300 + Math.min(content.length * 6, 450);
    setTimeout(() => {
      hideTyping();
      addMsg("bot", res);
      if (res.quickReplies) addQuickReplies(res.quickReplies);
    }, delay);
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); handleUserInput(input.value); });

  /* ─────────────────────────────── LOCAL ENGINE ───────────────── */
  const Local = (() => {

    /* ── booking state machine ── */
    const BOOK_STEPS = ["sector", "name", "phone", "email", "services", "area", "time"];

    const SECTOR_SERVICES = {
      commercial: [
        "Integrated Pest Management","Cockroach Control","Rodent Control",
        "Fly Control","Termite Control","Bed Bug Control",
        "Hospital-Grade Disinfection","Monitoring & Audit Support",
      ],
      residential: [
        "Cockroach Control","Rodent Control","Fly Control","Ant Control",
        "Termite Control","Bed Bug Control","Flea Control",
        "Disinfection","General Pest Control",
      ],
    };

    const STEP_ASK = {
      sector:   { text: "Who are we booking for?", quickReplies: [{ label: "🏭 Commercial / Industrial" }, { label: "🏠 Residential" }] },
      name:     { text: "What's your name?" },
      phone:    { text: "Great! What's the best phone or WhatsApp number to reach you?" },
      email:    { text: "And your email address?" },
      services: null,  // built dynamically from sector
      area:     { text: "Which suburb or area is the property in?" },
      time:     { text: "When suits you best? (e.g. 'Monday morning' or 'next Friday afternoon')" },
    };

    const KB = {
      services:     "We handle cockroaches, rodents, flies, ants, termites, bed bugs, fleas, mosquitoes, stored-product & pantry pests and spiders — plus hospital-grade disinfection, all under Integrated Pest Management.\n\nType **book** to schedule a free inspection.",
      compliance:   "For regulated sites we provide audit-ready documentation aligned to HACCP, BRCGS and FSSC 22000 — site maps, numbered devices, trend reports, corrective-action logs and service certificates.\n\nType **book** to arrange a compliance assessment.",
      areas:        "We cover Gqeberha (Port Elizabeth), Kariega, Despatch, Jeffrey's Bay, Humansdorp, Addo, Port Alfred, Makhanda, Coega and the wider Eastern Cape — with support across Gauteng.\n\nTell me your suburb and I'll confirm coverage.",
      pricing:      "Pricing depends on the pest, site size and access — but an inspection and quote are always free. Type **book** to get yours.",
      safety:       "Yes — our IPM approach uses targeted, registered products applied by trained technicians, aligned to food-safety and infection-prevention standards. Safe for families, pets and food-production areas.",
      contact:      "📞 061 138 3989 (call or WhatsApp)\n✉️ info@ascpestcontrol.co.za\n\nOr type **book** and I'll collect your details right here.",
      disinfection: "Our disinfection is hospital-grade, suited to healthcare, food, hospitality and industrial sites. Type **book** to arrange a visit.",
      hours:        "We offer rapid response across the Eastern Cape and 24/7 support for urgent infestations. Call 061 138 3989, or type **book** and I'll take your details now.",
    };

    const KW = {
      cancel:       ["cancel", "stop", "nevermind", "never mind", "start over", "reset"],
      book:         ["book", "appointment", "inspection", "schedule", "quote", "visit", "booking", "reserve"],
      commercial:   ["commercial", "industrial", "business", "company", "factory", "facility", "warehouse", "food plant", "office"],
      residential:  ["residential", "home", "house", "flat", "apartment", "townhouse"],
      compliance:   ["compliance", "audit", "haccp", "brcgs", "fssc", "certificate", "food safety"],
      disinfection: ["disinfect", "sanitis", "sanitiz", "sterilis"],
      pricing:      ["price", "pricing", "cost", "how much", "rate", "fee", "charge"],
      safety:       ["safe", "safety", "children", "kids", "pets", "toxic", "chemical"],
      areas:        ["area", "cover", "location", "where", "near me", "suburb"],
      hours:        ["hours", "open", "when", "response", "urgent", "emergency", "24"],
      contact:      ["contact", "phone", "call", "email", "number", "whatsapp", "human", "person"],
      services:     ["service", "offer", "treat", "pest", "control", "cockroach", "rodent", "rat", "mice", "fly", "ant", "termite", "bed bug", "flea", "mosquito", "spider"],
      greet:        ["hi", "hello", "hey", "howzit", "good morning", "good afternoon", "hallo"],
      thanks:       ["thank", "cheers", "great", "perfect"],
      affirm:       ["yes", "yeah", "yep", "sure", "ok", "okay", "please", "confirm", "correct", "proceed"],
      deny:         ["no", "nope", "not now", "later", "change"],
    };

    const has = (t, g) => KW[g].some((k) => t.includes(k));

    let state = { phase: "chat", b: {}, servicesChosen: [], awaitConfirm: false };

    function resetState() {
      state = { phase: "chat", b: {}, servicesChosen: [], awaitConfirm: false };
    }

    function start() {
      resetState();
      return {
        reply: "Hi, I'm Sentinel 🛡️ — ASC Pest Control's assistant. I can answer questions about our services or book a free inspection right now. How can I help?",
        quickReplies: [
          { label: "📋 Book an inspection" },
          { label: "🏠 Residential services" },
          { label: "🏭 Commercial / Industrial" },
          { label: "📞 Contact details" },
        ],
      };
    }

    function nextStep() {
      return BOOK_STEPS.find((s) => {
        if (s === "services") return state.servicesChosen.length === 0;
        return !(s in state.b);
      });
    }

    function buildServiceQR(sector) {
      const list = SECTOR_SERVICES[sector] || SECTOR_SERVICES.residential;
      return list.map((svc) => ({ label: svc }));
    }

    function confirmMessage() {
      const b = state.b;
      const svcs = state.servicesChosen.join(", ");
      return `Please confirm your booking:\n\n• Type: ${b.sector}\n• Name: ${b.name}\n• Phone: ${b.phone}\n• Email: ${b.email || "—"}\n• Services: ${svcs}\n• Area: ${b.area}\n• When: ${b.time}\n\nShall I submit this? (yes / no)`;
    }

    async function submitLead(b, svcs) {
      const ref = "SN-" + String(Math.floor(Math.random() * 900000) + 100000);
      try {
        await fetch(`${API}/v1/leads`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "sentinel_chat",
            customer: { full_name: b.name, phone: b.phone, email: b.email || "" },
            site: { label: b.sector, address: b.area },
            message: `[${b.sector}] services=${svcs.join(",")} time=${b.time}`,
          }),
        });
      } catch { /* offline — ref still shown */ }
      return ref;
    }

    function respond(raw) {
      const t = raw.toLowerCase().trim();

      /* ── cancel anywhere in booking ── */
      if (has(t, "cancel") && state.phase === "booking") {
        resetState();
        return {
          reply: "No problem — booking cancelled. Anything else I can help with?",
          quickReplies: [{ label: "📋 Book an inspection" }, { label: "📞 Contact details" }],
        };
      }

      /* ══════════════ BOOKING PHASE ══════════════ */
      if (state.phase === "booking") {

        /* ── awaiting yes/no confirm ── */
        if (state.awaitConfirm) {
          if (has(t, "affirm")) {
            const b    = state.b;
            const svcs = state.servicesChosen;
            // fire-and-forget submit
            submitLead(b, svcs).then((ref) => {
              /* ref already displayed synchronously below via placeholder */
            });
            const ref = "SN-" + String(Math.floor(Math.random() * 900000) + 100000);
            submitLead(b, svcs); // best-effort
            resetState();
            return {
              reply: `✅ Booked! Your reference is **${ref}**.\n\nOur team will call you on ${b.phone} to confirm your slot. You can also reach us on 061 138 3989 or WhatsApp at any time.`,
              quickReplies: [{ label: "📋 Book another" }, { label: "📞 Call us now" }],
            };
          }
          if (has(t, "deny")) {
            state.awaitConfirm = false;
            delete state.b.time; // go back to last step
            return { reply: "No problem — what would you like to change? (or type **cancel** to start over)", quickReplies: [] };
          }
          return { reply: "Please reply **yes** to confirm or **no** to change something.", quickReplies: [{ label: "yes" }, { label: "no" }] };
        }

        const step = nextStep();

        /* ── sector: parse from text or quick-reply ── */
        if (step === "sector") {
          let sector = null;
          if (has(t, "commercial")) sector = "commercial";
          else if (has(t, "residential") || t.includes("home") || t.includes("house")) sector = "residential";
          if (!sector) {
            return {
              reply: "Please choose your sector:",
              quickReplies: [{ label: "🏭 Commercial / Industrial", value: "commercial" }, { label: "🏠 Residential", value: "residential" }],
            };
          }
          state.b.sector = sector;
          return {
            reply: STEP_ASK.name.text,
          };
        }

        /* ── name ── */
        if (step === "name") {
          if (raw.trim().length < 2) return { reply: "Please share your name so we can address you properly." };
          state.b.name = raw.trim();
          return { reply: STEP_ASK.phone.text };
        }

        /* ── phone ── */
        if (step === "phone") {
          if (raw.replace(/\D/g, "").length < 9)
            return { reply: "That doesn't look like a valid number — please share your phone or WhatsApp number (e.g. 082 123 4567)." };
          state.b.phone = raw.trim();
          return { reply: STEP_ASK.email.text };
        }

        /* ── email ── */
        if (step === "email") {
          const emailRe = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
          if (!emailRe.test(raw) && !has(t, "skip") && raw.toLowerCase() !== "skip") {
            return { reply: "Please enter a valid email address, or type **skip** to continue without one." };
          }
          state.b.email = emailRe.test(raw) ? raw.trim() : "";
          const qr = buildServiceQR(state.b.sector);
          return {
            reply: `Which services do you need? Tap each one that applies, then type **done** when finished.\n\n(You can also type the service names.)`,
            quickReplies: [...qr, { label: "✅ Done selecting" }],
          };
        }

        /* ── services: accumulate until "done" ── */
        if (step === "services") {
          const allServices = [
            ...SECTOR_SERVICES.commercial,
            ...SECTOR_SERVICES.residential,
          ].map((s) => s.toLowerCase());

          if (has(t, "affirm") || t.includes("done") || t.includes("finish") || t.includes("next")) {
            if (state.servicesChosen.length === 0)
              return {
                reply: "Please select at least one service, or type **general** for general pest control.",
                quickReplies: buildServiceQR(state.b.sector),
              };
            return { reply: STEP_ASK.area.text };
          }

          // match chosen service
          const matched = [...SECTOR_SERVICES.commercial, ...SECTOR_SERVICES.residential]
            .filter((s) => t.includes(s.toLowerCase()) || s.toLowerCase().split(" ").some((w) => t.includes(w)));
          if (matched.length) {
            matched.forEach((m) => { if (!state.servicesChosen.includes(m)) state.servicesChosen.push(m); });
            const qr = buildServiceQR(state.b.sector);
            return {
              reply: `Added: ${matched.join(", ")}. Tap more services or tap **Done** when finished.\nSelected so far: ${state.servicesChosen.join(", ")}.`,
              quickReplies: [...qr, { label: "✅ Done selecting" }],
            };
          }
          // fallback
          state.servicesChosen.push(raw.trim());
          const qr = buildServiceQR(state.b.sector);
          return {
            reply: `Added "${raw.trim()}". Tap more or tap **Done**.`,
            quickReplies: [...qr, { label: "✅ Done selecting" }],
          };
        }

        /* ── area ── */
        if (step === "area") {
          state.b.area = raw.trim();
          return { reply: STEP_ASK.time.text };
        }

        /* ── time (last step) → confirm ── */
        if (step === "time") {
          state.b.time = raw.trim();
          state.awaitConfirm = true;
          return {
            reply: confirmMessage(),
            quickReplies: [{ label: "✅ Yes, confirm" }, { label: "✏️ No, change something" }],
          };
        }

        // fallthrough
        return { reply: "Let me get a bit more info. " + (STEP_ASK[nextStep()]?.text ?? "Type **cancel** to start over.") };
      }

      /* ══════════════ CHAT PHASE ══════════════ */

      // trigger booking
      if (has(t, "book") || has(t, "commercial") || has(t, "residential")) {
        state.phase = "booking";
        state.b = {};
        state.servicesChosen = [];
        return { ...STEP_ASK.sector, quickReplies: STEP_ASK.sector.quickReplies };
      }

      // KB lookups
      for (const key of ["compliance","disinfection","pricing","safety","areas","hours","contact","services"])
        if (has(t, key)) return {
          reply: KB[key],
          quickReplies: key === "contact"
            ? [{ label: "📋 Book an inspection" }]
            : [{ label: "📋 Book an inspection" }, { label: "📞 Contact details" }],
        };

      if (has(t, "greet")) return start();
      if (has(t, "thanks")) return { reply: "You're welcome! Anything else I can help with?", quickReplies: [{ label: "📋 Book an inspection" }] };

      return {
        reply: "I'm Sentinel — I can help with ASC's services, coverage, compliance and bookings. Ask me anything, or tap below.",
        quickReplies: [
          { label: "📋 Book an inspection" },
          { label: "🛡️ Our services" },
          { label: "📍 Areas we cover" },
          { label: "📞 Contact details" },
        ],
      };
    }

    return { start, respond };
  })();

  /* ─────────────────────────────── site scan ─────────────────── */
  function siteScan() {
    try {
      const texts = [];
      document.querySelectorAll("h1,h2,h3,p,li").forEach((n) => {
        if (n.innerText?.length > 20) texts.push(n.innerText.trim());
      });
      return { sample: texts.slice(0, 30).join("\n\n"), url: location.href, title: document.title };
    } catch { return { sample: "", url: location.href, title: document.title }; }
  }

  /* ─────────────────────────────── voice ─────────────────────── */
  const voiceBtn = $("#sentinel-voice");
  let recognizing = false;
  if (voiceBtn && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-ZA";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart  = () => { recognizing = true;  voiceBtn.classList.add("listening"); };
    rec.onend    = () => { recognizing = false; voiceBtn.classList.remove("listening"); };
    rec.onresult = (ev) => { const t = ev.results[0][0].transcript || ""; input.value = t; handleUserInput(t); };
    voiceBtn.addEventListener("click", () => {
      if (recognizing) { rec.stop(); return; }
      try { rec.start(); } catch { /* ignore */ }
    });
  } else if (voiceBtn) {
    voiceBtn.style.display = "none";
  }

  /* ─────────────────────────────── drag ──────────────────────── */
  const dragHandle  = $("#sentinel-drag-handle");
  const minimizeBtn = $("#sentinel-minimize");
  let isDragging = false, offsetX = 0, offsetY = 0;

  function startDrag(e) {
    if (!panel.classList.contains("open")) return;
    isDragging = true;
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    const r  = panel.getBoundingClientRect();
    offsetX  = cx - r.left;
    offsetY  = cy - r.top;
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("touchmove", handleDrag, { passive: false });
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchend", stopDrag);
    e.preventDefault();
  }
  function handleDrag(e) {
    if (!isDragging) return;
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    panel.style.left      = `${cx - offsetX}px`;
    panel.style.top       = `${cy - offsetY}px`;
    panel.style.transform = "none";
    panel.style.right     = "auto";
    panel.style.bottom    = "auto";
    e.preventDefault();
  }
  function stopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("touchmove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
    document.removeEventListener("touchend", stopDrag);
  }
  function toggleMinimise() {
    if (panel.classList.contains("minimised")) {
      panel.classList.remove("minimised");
      minimizeBtn.setAttribute("aria-label", "Minimise chat");
    } else {
      panel.classList.add("minimised");
      minimizeBtn.setAttribute("aria-label", "Expand chat");
    }
  }

  if (dragHandle)  dragHandle.addEventListener("mousedown", startDrag);
  if (dragHandle)  dragHandle.addEventListener("touchstart", startDrag, { passive: false });
  if (minimizeBtn) minimizeBtn.addEventListener("click", toggleMinimise);

})();
