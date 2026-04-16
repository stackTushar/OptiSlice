(function () {
  const STORE_KEY = "optislice_analytics_v2";
  const SESSION_KEY = "optislice_session_id";
  const SESSION_LAST_SEEN_KEY = "optislice_session_last_seen";
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const EXPERIMENT_KEYS = {
    ctaColor: "optislice_exp_cta_color",
    heroHeadline: "optislice_exp_hero_headline"
  };

  const charts = [];

  function defaultStore() {
    return {
      sessions: {},
      pageViews: {},
      traffic: {},
      campaigns: {},
      events: {},
      eventLog: [],
      funnel: {
        landing: 0,
        product: 0,
        cta: 0,
        signup: 0
      },
      experiments: {
        ctaColor: {
          A: { views: 0, clicks: 0 },
          B: { views: 0, clicks: 0 }
        },
        heroHeadline: {
          A: { views: 0, clicks: 0 },
          B: { views: 0, clicks: 0 }
        }
      }
    };
  }

  function getStore() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();

    try {
      const parsed = JSON.parse(raw);
      return migrateStore(parsed);
    } catch (_err) {
      return defaultStore();
    }
  }

  function migrateStore(store) {
    const fresh = defaultStore();
    if (!store || typeof store !== "object") return fresh;

    fresh.sessions = normalizeSessions(store.sessions);
    fresh.pageViews = store.pageViews || {};
    fresh.traffic = store.traffic || {};
    fresh.campaigns = store.campaigns || {};
    fresh.events = store.events || {};
    fresh.eventLog = Array.isArray(store.eventLog) ? store.eventLog : [];
    fresh.funnel = {
      landing: Number(store.funnel && store.funnel.landing) || 0,
      product: Number(store.funnel && store.funnel.product) || 0,
      cta: Number(store.funnel && store.funnel.cta) || 0,
      signup: Number(store.funnel && store.funnel.signup) || 0
    };

    const oldAb = store.ab || {};
    fresh.experiments = {
      ctaColor: store.experiments && store.experiments.ctaColor ? store.experiments.ctaColor : {
        A: oldAb.A || { views: 0, clicks: 0 },
        B: oldAb.B || { views: 0, clicks: 0 }
      },
      heroHeadline: store.experiments && store.experiments.heroHeadline ? store.experiments.heroHeadline : {
        A: { views: 0, clicks: 0 },
        B: { views: 0, clicks: 0 }
      }
    };

    return fresh;
  }

  function normalizeSessions(sessions) {
    if (!sessions) return {};

    if (Array.isArray(sessions)) {
      const converted = {};
      sessions.forEach(function (id) {
        converted[id] = {
          id: id,
          source: "unknown",
          campaign: "none",
          medium: "none",
          device: detectDeviceType(),
          start: Date.now(),
          lastSeen: Date.now(),
          pageViews: 0,
          events: 0,
          conversions: 0,
          landingPage: "unknown"
        };
      });
      return converted;
    }

    return sessions;
  }

  function saveStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function detectDeviceType() {
    const ua = (navigator.userAgent || "").toLowerCase();
    return /(android|iphone|ipad|mobile)/.test(ua) ? "mobile" : "desktop";
  }

  function parseTraffic() {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source") || inferReferrerSource();
    const campaign = params.get("utm_campaign") || "none";
    const medium = params.get("utm_medium") || "none";
    return { source: source, campaign: campaign, medium: medium };
  }

  function inferReferrerSource() {
    const ref = document.referrer;
    if (!ref) return "direct";
    if (ref.includes("google")) return "google";
    if (ref.includes("instagram")) return "instagram";
    if (ref.includes("facebook")) return "facebook";
    if (ref.includes("youtube")) return "youtube";
    return "referral";
  }

  function getSessionId() {
    const now = Date.now();
    const lastSeen = Number(sessionStorage.getItem(SESSION_LAST_SEEN_KEY) || 0);
    let id = sessionStorage.getItem(SESSION_KEY);

    if (!id || !lastSeen || now - lastSeen > SESSION_TIMEOUT_MS) {
      id = now + "-" + Math.random().toString(16).slice(2, 10);
      sessionStorage.setItem(SESSION_KEY, id);
    }

    sessionStorage.setItem(SESSION_LAST_SEEN_KEY, String(now));
    return id;
  }

  function getExperimentVariant(expName) {
    const key = EXPERIMENT_KEYS[expName];
    let variant = localStorage.getItem(key);
    if (!variant) {
      variant = Math.random() < 0.5 ? "A" : "B";
      localStorage.setItem(key, variant);
    }
    return variant;
  }

  function ensureSession(store, sessionId, sourceMeta, page) {
    if (!store.sessions[sessionId]) {
      store.sessions[sessionId] = {
        id: sessionId,
        source: sourceMeta.source,
        campaign: sourceMeta.campaign,
        medium: sourceMeta.medium,
        device: detectDeviceType(),
        start: Date.now(),
        lastSeen: Date.now(),
        pageViews: 0,
        events: 0,
        conversions: 0,
        landingPage: page
      };
    }

    store.sessions[sessionId].lastSeen = Date.now();
    return store.sessions[sessionId];
  }

  function trackEvent(name, label, metadata) {
    const page = document.body.dataset.page || "unknown";
    const sourceMeta = parseTraffic();
    const sessionId = getSessionId();
    const store = getStore();
    const session = ensureSession(store, sessionId, sourceMeta, page);

    store.events[name] = (store.events[name] || 0) + 1;
    session.events += 1;

    store.eventLog.push({
      at: Date.now(),
      name: name,
      label: label || "",
      page: page,
      source: sourceMeta.source,
      campaign: sourceMeta.campaign,
      medium: sourceMeta.medium,
      sessionId: sessionId,
      meta: metadata || {}
    });

    if (store.eventLog.length > 1200) {
      store.eventLog = store.eventLog.slice(store.eventLog.length - 1200);
    }

    saveStore(store);

    if (window.gtag) {
      window.gtag("event", name, {
        event_label: label || "",
        page_path: window.location.pathname
      });
    }
  }

  function trackGoogleAdsConversion(sendTo, value, currency) {
    if (!window.gtag || !sendTo) return;
    window.gtag("event", "conversion", {
      send_to: sendTo,
      value: value || 1.0,
      currency: currency || "INR"
    });
  }

  function trackPageView() {
    const page = document.body.dataset.page || "unknown";
    const sourceMeta = parseTraffic();
    const sessionId = getSessionId();
    const store = getStore();
    const session = ensureSession(store, sessionId, sourceMeta, page);

    store.pageViews[page] = (store.pageViews[page] || 0) + 1;
    store.traffic[sourceMeta.source] = (store.traffic[sourceMeta.source] || 0) + 1;
    if (sourceMeta.campaign !== "none") {
      store.campaigns[sourceMeta.campaign] = (store.campaigns[sourceMeta.campaign] || 0) + 1;
    }

    session.pageViews += 1;

    if (page === "home") store.funnel.landing += 1;
    if (page === "product") store.funnel.product += 1;

    store.eventLog.push({
      at: Date.now(),
      name: "page_view",
      label: page,
      page: page,
      source: sourceMeta.source,
      campaign: sourceMeta.campaign,
      medium: sourceMeta.medium,
      sessionId: sessionId,
      meta: {}
    });

    if (store.eventLog.length > 1200) {
      store.eventLog = store.eventLog.slice(store.eventLog.length - 1200);
    }

    saveStore(store);

    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        source: sourceMeta.source
      });
    }
  }

  function setupHomeExperiments() {
    if (document.body.dataset.page !== "home") return;

    const store = getStore();
    const ctaVariant = getExperimentVariant("ctaColor");
    const headlineVariant = getExperimentVariant("heroHeadline");

    const ctaBtn = document.getElementById("cta-order");
    const heroTitle = document.getElementById("hero-title");

    if (ctaBtn) {
      store.experiments.ctaColor[ctaVariant].views += 1;
      if (ctaVariant === "B") {
        ctaBtn.classList.add("btn-red");
        ctaBtn.textContent = "Claim Launch Deal";
      }
    }

    if (heroTitle) {
      store.experiments.heroHeadline[headlineVariant].views += 1;
      if (headlineVariant === "B") {
        heroTitle.textContent = "Boost Conversions with AI-Assisted Analytics";
      }
    }

    saveStore(store);

    if (ctaBtn) {
      ctaBtn.addEventListener("click", function () {
        const curr = getStore();
        curr.experiments.ctaColor[ctaVariant].clicks += 1;
        curr.funnel.cta += 1;
        saveStore(curr);

        trackEvent("cta_order_click", "ctaColor_" + ctaVariant, { experiment: "ctaColor" });
        trackGoogleAdsConversion("AW-XXXXXXXXX/CTA_CONVERSION_LABEL", 1.0, "INR");
        window.location.href = "signup.html";
      });
    }

    if (heroTitle) {
      heroTitle.addEventListener("click", function () {
        const curr = getStore();
        curr.experiments.heroHeadline[headlineVariant].clicks += 1;
        saveStore(curr);
        trackEvent("hero_headline_engagement", "heroHeadline_" + headlineVariant, { experiment: "heroHeadline" });
      });
    }
  }

  function setupGenericTrackingButtons() {
    document.querySelectorAll(".track-click").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const eventName = btn.dataset.event || "generic_click";
        const label = btn.dataset.label || "unknown";
        trackEvent(eventName, label);
      });
    });
  }

  function setupSignupGoal() {
    const form = document.getElementById("signup-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const plan = document.getElementById("plan");
      const selectedPlan = plan ? plan.value : "unknown";

      trackEvent("signup_submit", "signup_form", { plan: selectedPlan });
      trackGoogleAdsConversion("AW-XXXXXXXXX/SIGNUP_CONVERSION_LABEL", 1.0, "INR");

      const store = getStore();
      const sessionId = getSessionId();
      if (store.sessions[sessionId]) {
        store.sessions[sessionId].conversions += 1;
      }
      store.funnel.signup += 1;
      saveStore(store);

      const msg = document.getElementById("form-msg");
      if (msg) msg.hidden = false;
      form.reset();
    });
  }

  function setupCampaignBuilder() {
    if (document.body.dataset.page !== "campaigns") return;

    const form = document.getElementById("utm-form");
    const result = document.getElementById("utm-result");
    const copyBtn = document.getElementById("copy-utm");

    if (!form || !result || !copyBtn) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const source = document.getElementById("utm-source").value.trim();
      const medium = document.getElementById("utm-medium").value.trim();
      const campaign = document.getElementById("utm-campaign").value.trim();

      const url = "index.html?utm_source=" + encodeURIComponent(source) +
        "&utm_medium=" + encodeURIComponent(medium) +
        "&utm_campaign=" + encodeURIComponent(campaign);

      result.textContent = url;
      copyBtn.hidden = false;

      trackEvent("utm_link_generated", campaign, { source: source, medium: medium });
    });

    copyBtn.addEventListener("click", function () {
      const text = result.textContent;
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () {
          copyBtn.textContent = "Copy Link";
        }, 1000);
      });
      trackEvent("utm_link_copied", "campaign_link");
    });
  }

  function setupDashboard() {
    if (document.body.dataset.page !== "dashboard") return;

    const windowEl = document.getElementById("filter-window");
    const sourceEl = document.getElementById("filter-source");
    const exportBtn = document.getElementById("export-csv");
    const seedBtn = document.getElementById("seed-data");
    const clearBtn = document.getElementById("clear-data");

    hydrateSourceFilter(sourceEl);

    if (windowEl) windowEl.addEventListener("change", renderDashboard);
    if (sourceEl) sourceEl.addEventListener("change", renderDashboard);
    if (exportBtn) exportBtn.addEventListener("click", exportCsv);
    if (seedBtn) seedBtn.addEventListener("click", seedDemoData);
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        localStorage.removeItem(STORE_KEY);
        Object.values(EXPERIMENT_KEYS).forEach(function (key) {
          localStorage.removeItem(key);
        });
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_LAST_SEEN_KEY);
        window.location.reload();
      });
    }

    renderDashboard();
  }

  function hydrateSourceFilter(sourceEl) {
    if (!sourceEl) return;
    const store = getStore();
    const sources = Object.keys(store.traffic);
    sourceEl.innerHTML = "<option value=\"all\">All Sources</option>";
    sources.forEach(function (src) {
      const opt = document.createElement("option");
      opt.value = src;
      opt.textContent = src;
      sourceEl.appendChild(opt);
    });
  }

  function getFilters() {
    const windowVal = document.getElementById("filter-window");
    const sourceVal = document.getElementById("filter-source");
    return {
      days: windowVal ? windowVal.value : "30",
      source: sourceVal ? sourceVal.value : "all"
    };
  }

  function applyEventFilters(events, filters) {
    const now = Date.now();
    return events.filter(function (evt) {
      if (filters.source !== "all" && evt.source !== filters.source) return false;
      if (filters.days === "all") return true;
      const maxAge = Number(filters.days) * 24 * 60 * 60 * 1000;
      return now - evt.at <= maxAge;
    });
  }

  function getFilteredSessions(store, filteredEvents) {
    const ids = {};
    filteredEvents.forEach(function (evt) {
      ids[evt.sessionId] = true;
    });

    return Object.values(store.sessions).filter(function (session) {
      return ids[session.id];
    });
  }

  function renderDashboard() {
    const store = getStore();
    const filters = getFilters();
    const filteredEvents = applyEventFilters(store.eventLog, filters);
    const sessions = getFilteredSessions(store, filteredEvents);

    const sessionCount = sessions.length;
    const conversionCount = filteredEvents.filter(function (e) { return e.name === "signup_submit"; }).length;
    const conversionRate = sessionCount ? ((conversionCount / sessionCount) * 100).toFixed(1) : "0.0";

    const returning = sessions.filter(function (s) { return s.pageViews > 1; }).length;

    setText("m-sessions", sessionCount);
    setText("m-returning", returning);
    setText("m-signups", conversionCount);
    setText("m-conversion", conversionRate + "%");

    const trafficData = aggregateBy(filteredEvents, "source", "page_view");
    const dailyData = aggregateDaily(filteredEvents, "page_view");
    const funnelData = aggregateFunnel(filteredEvents);
    const topPages = aggregateBy(filteredEvents, "page", "page_view");
    const topEvents = aggregateNames(filteredEvents);

    renderTrafficChart(trafficData);
    renderDailyChart(dailyData);
    renderFunnelChart(funnelData);
    renderExperimentChart(store.experiments);
    renderList("top-pages", toSortedPairs(topPages), "views");
    renderList("top-events", toSortedPairs(topEvents), "events");
    renderRecentEvents(filteredEvents);
  }

  function renderTrafficChart(trafficData) {
    const el = document.getElementById("trafficChart");
    if (!el || typeof Chart === "undefined") return;

    createChart(el, {
      type: "pie",
      data: {
        labels: Object.keys(trafficData),
        datasets: [{
          data: Object.values(trafficData),
          backgroundColor: ["#1268d6", "#2c8f57", "#e6483d", "#f0a523", "#6658d3", "#30a3c9"]
        }]
      }
    });
  }

  function renderDailyChart(dailyData) {
    const el = document.getElementById("dailyChart");
    if (!el || typeof Chart === "undefined") return;

    const keys = Object.keys(dailyData).sort();
    const values = keys.map(function (k) { return dailyData[k]; });

    createChart(el, {
      type: "line",
      data: {
        labels: keys,
        datasets: [{
          label: "Sessions",
          data: values,
          borderColor: "#1268d6",
          backgroundColor: "rgba(18,104,214,0.2)",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function renderFunnelChart(funnelData) {
    const el = document.getElementById("funnelChart");
    if (!el || typeof Chart === "undefined") return;

    createChart(el, {
      type: "bar",
      data: {
        labels: ["Landing", "Product", "CTA", "Signup"],
        datasets: [{
          label: "Users",
          data: [funnelData.landing, funnelData.product, funnelData.cta, funnelData.signup],
          backgroundColor: ["#30a3c9", "#1268d6", "#f0a523", "#2c8f57"]
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function renderExperimentChart(experiments) {
    const el = document.getElementById("experimentChart");
    if (!el || typeof Chart === "undefined") return;

    const ctaA = ctr(experiments.ctaColor.A);
    const ctaB = ctr(experiments.ctaColor.B);
    const headA = ctr(experiments.heroHeadline.A);
    const headB = ctr(experiments.heroHeadline.B);

    createChart(el, {
      type: "bar",
      data: {
        labels: ["CTA Color", "Hero Headline"],
        datasets: [
          {
            label: "Variant A CTR %",
            data: [ctaA, headA],
            backgroundColor: "#1268d6"
          },
          {
            label: "Variant B CTR %",
            data: [ctaB, headB],
            backgroundColor: "#e6483d"
          }
        ]
      },
      options: {
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    const bestCta = ctaA === ctaB ? "tie" : (ctaA > ctaB ? "A" : "B");
    const bestHead = headA === headB ? "tie" : (headA > headB ? "A" : "B");
    setText("ab-summary", "Best CTA variant: " + bestCta + " | Best headline variant: " + bestHead);
  }

  function renderList(id, pairs, suffix) {
    const list = document.getElementById(id);
    if (!list) return;

    list.innerHTML = "";
    if (!pairs.length) {
      const li = document.createElement("li");
      li.textContent = "No data yet.";
      list.appendChild(li);
      return;
    }

    pairs.slice(0, 8).forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = item[0] + " - " + item[1] + " " + suffix;
      list.appendChild(li);
    });
  }

  function renderRecentEvents(events) {
    const list = document.getElementById("recent-events");
    if (!list) return;

    const sorted = events.slice().sort(function (a, b) {
      return b.at - a.at;
    }).slice(0, 12);

    list.innerHTML = "";
    if (!sorted.length) {
      const li = document.createElement("li");
      li.textContent = "No activity in selected filter.";
      list.appendChild(li);
      return;
    }

    sorted.forEach(function (evt) {
      const li = document.createElement("li");
      li.textContent = formatTime(evt.at) + " | " + evt.name + " | " + evt.source + " | " + evt.page;
      list.appendChild(li);
    });
  }

  function setupReports() {
    if (document.body.dataset.page !== "reports") return;

    const store = getStore();
    const events = store.eventLog || [];
    const sessions = Object.values(store.sessions || {});

    const traffic = toSortedPairs(store.traffic || {});
    const topSource = traffic.length ? traffic[0][0] : "none";

    const signups = (store.events && store.events.signup_submit) || 0;
    const ctaClicks = (store.events && store.events.cta_order_click) || 0;
    const conversionRate = sessions.length ? ((signups / sessions.length) * 100).toFixed(1) : "0.0";

    const insightLines = [
      "Top acquisition source: " + topSource,
      "Total sessions tracked: " + sessions.length,
      "CTA clicks captured: " + ctaClicks,
      "Signups completed: " + signups,
      "Overall conversion rate: " + conversionRate + "%"
    ];

    const actions = [];
    if (conversionRate < 10) {
      actions.push("Improve signup form clarity and reduce required fields.");
    } else {
      actions.push("Scale top-performing campaign to increase qualified traffic.");
    }

    const ctaA = ctr(store.experiments.ctaColor.A);
    const ctaB = ctr(store.experiments.ctaColor.B);
    actions.push("Keep CTA variant " + (ctaA >= ctaB ? "A" : "B") + " as control for the next sprint.");

    const productViews = events.filter(function (e) { return e.name === "product_view_details"; }).length;
    if (productViews > signups) {
      actions.push("Add a sticky conversion prompt on product page to reduce drop-off.");
    }

    renderTextList("insights-list", insightLines);
    renderTextList("actions-list", actions);
  }

  function renderTextList(id, items) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = "";
    items.forEach(function (line) {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
  }

  function aggregateBy(events, field, onlyName) {
    const out = {};
    events.forEach(function (evt) {
      if (onlyName && evt.name !== onlyName) return;
      const key = evt[field] || "unknown";
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function aggregateNames(events) {
    const out = {};
    events.forEach(function (evt) {
      if (evt.name === "page_view") return;
      out[evt.name] = (out[evt.name] || 0) + 1;
    });
    return out;
  }

  function aggregateDaily(events, onlyName) {
    const out = {};
    events.forEach(function (evt) {
      if (onlyName && evt.name !== onlyName) return;
      const day = new Date(evt.at).toISOString().slice(0, 10);
      out[day] = (out[day] || 0) + 1;
    });
    return out;
  }

  function aggregateFunnel(events) {
    return {
      landing: events.filter(function (e) { return e.name === "page_view" && e.page === "home"; }).length,
      product: events.filter(function (e) { return e.name === "page_view" && e.page === "product"; }).length,
      cta: events.filter(function (e) { return e.name === "cta_order_click"; }).length,
      signup: events.filter(function (e) { return e.name === "signup_submit"; }).length
    };
  }

  function toSortedPairs(obj) {
    return Object.entries(obj).sort(function (a, b) {
      return b[1] - a[1];
    });
  }

  function ctr(group) {
    if (!group || !group.views) return 0;
    return Number(((group.clicks / group.views) * 100).toFixed(1));
  }

  function formatTime(ms) {
    const d = new Date(ms);
    return d.toLocaleString();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function createChart(el, config) {
    destroyChartForCanvas(el);
    const chart = new Chart(el, config);
    charts.push(chart);
  }

  function destroyChartForCanvas(el) {
    for (let i = charts.length - 1; i >= 0; i -= 1) {
      if (charts[i].canvas === el) {
        charts[i].destroy();
        charts.splice(i, 1);
      }
    }
  }

  function exportCsv() {
    const store = getStore();
    const rows = ["timestamp,event,label,page,source,campaign,medium,session_id"];
    store.eventLog.forEach(function (evt) {
      rows.push([
        csvSafe(new Date(evt.at).toISOString()),
        csvSafe(evt.name),
        csvSafe(evt.label),
        csvSafe(evt.page),
        csvSafe(evt.source),
        csvSafe(evt.campaign),
        csvSafe(evt.medium),
        csvSafe(evt.sessionId)
      ].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optislice-events.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent("dashboard_export_csv", "events_export");
  }

  function csvSafe(value) {
    const txt = String(value || "");
    return '"' + txt.replace(/"/g, '""') + '"';
  }

  function seedDemoData() {
    const store = getStore();
    const sources = ["google", "instagram", "facebook", "email", "direct"];
    const pages = ["home", "product", "signup"];

    for (let i = 0; i < 60; i += 1) {
      const sessionId = "seed-" + i + "-" + Math.random().toString(16).slice(2, 8);
      const source = sources[Math.floor(Math.random() * sources.length)];
      const page = pages[Math.floor(Math.random() * pages.length)];
      const at = Date.now() - Math.floor(Math.random() * 25 * 24 * 60 * 60 * 1000);

      store.sessions[sessionId] = {
        id: sessionId,
        source: source,
        campaign: source + "_campaign",
        medium: source === "email" ? "newsletter" : "cpc",
        device: Math.random() > 0.5 ? "mobile" : "desktop",
        start: at,
        lastSeen: at,
        pageViews: 1 + Math.floor(Math.random() * 4),
        events: 1 + Math.floor(Math.random() * 4),
        conversions: Math.random() > 0.75 ? 1 : 0,
        landingPage: page
      };

      store.pageViews[page] = (store.pageViews[page] || 0) + 1;
      store.traffic[source] = (store.traffic[source] || 0) + 1;
      store.campaigns[source + "_campaign"] = (store.campaigns[source + "_campaign"] || 0) + 1;

      store.eventLog.push({
        at: at,
        name: "page_view",
        label: page,
        page: page,
        source: source,
        campaign: source + "_campaign",
        medium: source === "email" ? "newsletter" : "cpc",
        sessionId: sessionId,
        meta: {}
      });

      if (Math.random() > 0.5) {
        store.events.cta_order_click = (store.events.cta_order_click || 0) + 1;
        store.eventLog.push({
          at: at + 30000,
          name: "cta_order_click",
          label: "seed",
          page: "home",
          source: source,
          campaign: source + "_campaign",
          medium: source === "email" ? "newsletter" : "cpc",
          sessionId: sessionId,
          meta: {}
        });
        store.funnel.cta += 1;
      }

      if (Math.random() > 0.7) {
        store.events.signup_submit = (store.events.signup_submit || 0) + 1;
        store.eventLog.push({
          at: at + 90000,
          name: "signup_submit",
          label: "seed",
          page: "signup",
          source: source,
          campaign: source + "_campaign",
          medium: source === "email" ? "newsletter" : "cpc",
          sessionId: sessionId,
          meta: { plan: "basic" }
        });
        store.funnel.signup += 1;
      }

      if (page === "home") store.funnel.landing += 1;
      if (page === "product") store.funnel.product += 1;
    }

    saveStore(store);
    hydrateSourceFilter(document.getElementById("filter-source"));
    renderDashboard();
  }

  trackPageView();
  setupHomeExperiments();
  setupGenericTrackingButtons();
  setupSignupGoal();
  setupCampaignBuilder();
  setupDashboard();
  setupReports();
})();
