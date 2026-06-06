/* ASC Pest Control — landing interactions.
   Progressive enhancement: the page is fully functional without JS
   (FAQ uses native <details>, reveals fall back to visible). */
(() => {
  "use strict";

  // Allow overriding API base for AWS deployments via a meta tag in the page:
  // <meta name="aws-api-base" content="https://your-api.execute-api.region.amazonaws.com">
  try {
    const awsMeta = document.querySelector('meta[name="aws-api-base"]');
    if (awsMeta && awsMeta.content) {
      window.ASC_API_BASE = awsMeta.content;
    }
  } catch (e) {
    // silent
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---- Footer year ---- */
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---- Header scroll state (drives :has-free styling via data attr) ---- */
  const header = $("#header");
  const onScroll = () => header?.setAttribute("data-scrolled", String(scrollY > 12));
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  const burger = $("#burger");
  const menu = $("#mobileMenu");
  if (burger && menu) {
    burger.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    $$("a", menu).forEach((a) =>
      a.addEventListener("click", () => {
        menu.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---- Static marquee: no duplication or scroll animation ---- */
  const track = $("#marquee");

  /* ---- Symptom-based pest finder ---- */
  const chips = $$(".chip");
  const result = $("#finderResult");
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      if (!result) return;
      result.classList.remove("empty");
      result.style.opacity = "0";
      setTimeout(() => {
        result.innerHTML =
          `<div><span class="pest-name">Likely: ${chip.dataset.pest}</span>` +
          `<p style="margin:.6rem 0 0;color:var(--muted);">${chip.dataset.msg}</p></div>`;
        result.style.opacity = "1";
      }, reduce ? 0 : 150);
    })
  );

  /* ---- Quote form (demo: validates + confirms; prod → POST /v1/leads) ---- */
  const form = $("#quoteForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const required = ["#qname", "#qphone", "#qservice"].map((s) => $(s, form));
      let ok = true;
      required.forEach((el) => {
        const bad = !el.value.trim();
        el.style.borderColor = bad ? "var(--danger)" : "";
        if (bad) ok = false;
      });
      if (!ok) return;
      const btn = $("button[type=submit]", form);
      btn.textContent = "Thank you — we'll be in touch!";
      btn.style.background = "var(--success)";
      btn.dataset.done = "true";
      btn.disabled = true;
    });
  }

  /* ---- Animated counters ---- */
  const counters = $$("[data-count]");
  const animateCount = (el) => {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || "";
    if (reduce) { el.textContent = target + suffix; return; }
    const start = performance.now();
    const dur = 1200;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---- Reveal fallback + counters trigger (when no scroll-driven support) ---- */
  const supportsScrollTimeline = CSS.supports("animation-timeline: view()");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          $$("[data-count]", entry.target).forEach(animateCount);
          if (entry.target.matches("[data-count]")) animateCount(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.15 }
    );
    if (!supportsScrollTimeline) $$(".reveal").forEach((el) => io.observe(el));
    counters.forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("in"));
    counters.forEach(animateCount);
  }

  /* ---- Card spotlight (pointer-following glow) ---- */
  if (fine && !reduce) {
    $$(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });

    /* ---- Magnetic buttons ---- */
    $$(".magnetic").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        btn.style.setProperty("--tx", `${mx * 0.18}px`);
        btn.style.setProperty("--ty", `${my * 0.3}px`);
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.setProperty("--tx", "0px");
        btn.style.setProperty("--ty", "0px");
      });
    });
  
  /* ---- Hero 'Talk to Sentinel' button wiring ---- */
  const heroTalk = document.getElementById('hero-talk-sentinel');
  const sentinelLauncher = document.getElementById('sentinel-launcher');
  if (heroTalk && sentinelLauncher) {
    heroTalk.addEventListener('click', () => sentinelLauncher.click());
  }

  /* ---- Multi-step comprehensive form logic ---- */
  const cfForm = document.getElementById('comprehensiveForm');
  if (cfForm) {
    const steps = ['step-basic', 'step-type', 'step-prefs'];
    let currentStep = 0;
    const prevBtn = document.getElementById('formPrev');
    const nextBtn = document.getElementById('formNext');
    const submitBtn = document.getElementById('formSubmit');
    const accountModal = document.getElementById('accountModal');
    const otpModal = document.getElementById('otpModal');
    const closeAccountModalBtn = document.getElementById('closeAccountModal');

    const homeFields = document.getElementById('homeFields');
    const businessFields = document.getElementById('businessFields');
    const homeBookingDetails = document.getElementById('homeBookingDetails');
    const enquiryTypeInputs = cfForm.querySelectorAll('input[name="enquiryType"]');
    const homeActionInputs = cfForm.querySelectorAll('input[name="homeAction"]');

    function showStep(index) {
      steps.forEach((stepId, i) => {
        const el = document.getElementById(stepId);
        if (el) {
          el.style.display = i === index ? 'block' : 'none';
          el.classList.toggle('active', i === index);
        }
      });
      prevBtn.style.display = index > 0 ? 'block' : 'none';
      nextBtn.style.display = index < steps.length - 1 ? 'block' : 'none';
      submitBtn.style.display = index === steps.length - 1 ? 'block' : 'none';
    }

    function isVisibleField(input) {
      return input.offsetParent !== null;
    }

    function validateStep(index) {
      const stepId = steps[index];
      const stepEl = document.getElementById(stepId);
      if (!stepEl) return true;
      const inputs = Array.from(stepEl.querySelectorAll('input[required], select[required], textarea[required]')).filter(isVisibleField);
      let valid = true;
      const radioGroups = new Set();

      inputs.forEach(inp => {
        if (inp.type === 'radio') {
          if (radioGroups.has(inp.name)) return;
          radioGroups.add(inp.name);
          const radios = Array.from(stepEl.querySelectorAll(`input[name="${inp.name}"]`)).filter(isVisibleField);
          const checked = radios.some((radio) => radio.checked);
          if (!checked) {
            radios.forEach((radio) => { radio.style.outline = '1px solid var(--danger)'; });
            valid = false;
          } else {
            radios.forEach((radio) => { radio.style.outline = ''; });
          }
          return;
        }

        if (!inp.value.trim()) {
          inp.style.borderColor = 'var(--danger)';
          valid = false;
        } else {
          inp.style.borderColor = '';
        }
      });
      return valid;
    }

    function setSectionRequired(section, enabled) {
      if (!section) return;
      section.querySelectorAll('[data-required]').forEach((input) => {
        input.required = enabled;
        if (!enabled) input.style.borderColor = '';
      });
    }

    function updateHomeBookingVisibility() {
      if (!homeBookingDetails) return;
      const selected = cfForm.querySelector('input[name="homeAction"]:checked')?.value;
      if (selected === 'book') {
        homeBookingDetails.style.display = 'block';
        setSectionRequired(homeBookingDetails, true);
      } else {
        homeBookingDetails.style.display = 'none';
        setSectionRequired(homeBookingDetails, false);
      }
    }

    function updateEnquiryTypeFields() {
      const selected = cfForm.querySelector('input[name="enquiryType"]:checked')?.value;
      if (selected === 'home') {
        if (homeFields) homeFields.style.display = 'block';
        if (businessFields) businessFields.style.display = 'none';
        setSectionRequired(homeFields, true);
        setSectionRequired(businessFields, false);
        updateHomeBookingVisibility();
      } else if (selected === 'business') {
        if (homeFields) homeFields.style.display = 'none';
        if (businessFields) businessFields.style.display = 'block';
        setSectionRequired(homeFields, false);
        setSectionRequired(businessFields, true);
        setSectionRequired(homeBookingDetails, false);
      } else {
        if (homeFields) homeFields.style.display = 'none';
        if (businessFields) businessFields.style.display = 'none';
        setSectionRequired(homeFields, false);
        setSectionRequired(businessFields, false);
        setSectionRequired(homeBookingDetails, false);
      }
    }

    enquiryTypeInputs.forEach((input) => input.addEventListener('change', updateEnquiryTypeFields));
    homeActionInputs.forEach((input) => input.addEventListener('change', updateHomeBookingVisibility));

    nextBtn.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;
      if (currentStep < steps.length - 1) {
        currentStep++;
        showStep(currentStep);
      }
    });

    prevBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });

    // Handle location checkbox
    const useLocationCheckbox = document.getElementById('cfUseLocation');
    let currentLocationCoords = null;
    if (useLocationCheckbox) {
      useLocationCheckbox.addEventListener('change', (e) => {
        const locationField = document.getElementById('cfLocation');
        if (e.target.checked) {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
              currentLocationCoords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              locationField.value = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
              locationField.style.display = 'none';
              locationField.required = false;
            }, (error) => {
              console.warn('Geolocation error:', error);
              alert('Could not get your location. Please enter it manually.');
              e.target.checked = false;
              locationField.style.display = 'block';
              locationField.required = true;
            });
          } else {
            alert('Geolocation is not supported by your browser.');
            e.target.checked = false;
            locationField.style.display = 'block';
            locationField.required = true;
          }
        } else {
          locationField.style.display = 'block';
          locationField.required = true;
          locationField.value = '';
          currentLocationCoords = null;
        }
      });
    }

    // Form submission
    cfForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(currentStep)) return;

      const formData = new FormData(cfForm);
      const payload = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        region: formData.get('region'),
        contactAbout: formData.get('contactAbout'),
        enquiryType: formData.get('enquiryType'),
        homeAction: formData.get('homeAction'),
        service: formData.get('service'),
        bookDate: formData.get('bookDate'),
        bookTime: formData.get('bookTime'),
        location: formData.get('location'),
        additionalInfo: formData.get('additionalInfo'),
        orgName: formData.get('orgName'),
        website: formData.get('website'),
        orgLocation: formData.get('orgLocation'),
        employees: formData.get('employees'),
        sector: formData.get('sector'),
        orgAdditional: formData.get('orgAdditional'),
        existingCustomer: formData.get('existingCustomer') === 'on',
        wantMarketing: formData.get('wantMarketing') === 'on',
      };

      // For bookings, check if user exists
      if (payload.homeAction === 'book') {
        try {
          const checkRes = await fetch(`${window.ASC_API_BASE}/v1/users/check-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: payload.email }),
          });
          const { exists } = await checkRes.json();
          if (!exists) {
            // Show account creation modal
            accountModal.style.display = 'flex';
            window.pendingBookingData = payload;
            return;
          }
        } catch (err) {
          console.error('Check user error:', err);
        }
      }

      // Submit enquiry or booking
      try {
        const endpoint = payload.homeAction === 'book' ? '/v1/bookings' : '/v1/enquiries';
        const res = await fetch(`${window.ASC_API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          alert('Thank you! Check your email for confirmation.');
          cfForm.reset();
          currentStep = 0;
          showStep(0);
        }
      } catch (err) {
        console.error('Form submit error:', err);
        alert('Error submitting form.');
      }
    });

    showStep(0);
  }

  /* ---- Account creation modal ---- */
  const accountForm = document.getElementById('accountForm');
  const closeAccountModalBtn = document.getElementById('closeAccountModal');
  if (accountForm) {
    closeAccountModalBtn.addEventListener('click', () => {
      document.getElementById('accountModal').style.display = 'none';
    });
    accountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('accUsername').value;
      const password = document.getElementById('accPassword').value;
      const passwordConfirm = document.getElementById('accPasswordConfirm').value;

      if (password !== passwordConfirm) {
        alert('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
      }

      try {
        const payload = window.pendingBookingData;
        payload.username = username;
        payload.password = password;

        const res = await fetch(`${window.ASC_API_BASE}/v1/users/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          document.getElementById('accountModal').style.display = 'none';
          document.getElementById('otpModal').style.display = 'flex';
        } else {
          alert('Error creating account');
        }
      } catch (err) {
        console.error('Account creation error:', err);
        alert('Error creating account.');
      }
    });
  }

  /* ---- OTP verification ---- */
  const otpForm = document.getElementById('otpForm');
  const resendOtpBtn = document.getElementById('resendOtp');
  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otp = document.getElementById('otpCode').value;
      const payload = window.pendingBookingData;

      try {
        const res = await fetch(`${window.ASC_API_BASE}/v1/users/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: payload.email, otp }),
        });
        if (res.ok) {
          const bookingRes = await fetch(`${window.ASC_API_BASE}/v1/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (bookingRes.ok) {
            alert('Account created and booking confirmed! Check your email.');
            document.getElementById('otpModal').style.display = 'none';
          }
        } else {
          alert('Invalid OTP');
        }
      } catch (err) {
        console.error('OTP verify error:', err);
      }
    });
    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await fetch(`${window.ASC_API_BASE}/v1/users/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: window.pendingBookingData.email }),
          });
          alert('OTP resent to your email.');
        } catch (err) {
          console.error('Resend error:', err);
        }
      });
    }
  }
})();
