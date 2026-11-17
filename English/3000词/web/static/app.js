(() => {
  const state = {
    batches: [],
    selected: null,
    direction: "en_zh",
    sessionId: null,
    day: null,
    items: [],
    index: 0,
    itemStartedAt: null, // performance.now() at question load
    itemStartedAtIso: null,
    busy: false,
    answeredCurrent: false,
    currentOptions: [],
    selectedKey: null,
    choicesCache: {}, // session-only; rebuilt on each start
    answersByIndex: {}, // submitted results; view-only after submit
    historyItems: [],
    historyDirection: "en_zh",
    historyCategory: "高频常用",
    historyDay: 1,
    catalogCategory: "高频常用",
    catalogByCategory: {},
    statsCategory: "高频常用",
    statsDirection: "en_zh",
    statsDay: 1,
    statsItems: [],
    statsErrorRateDesc: true,
  };

  const CATEGORY_ORDER = ["高频常用", "重点必背", "拓展补充"];

  const $ = (id) => document.getElementById(id);
  const views = {
    home: $("view-home"),
    catalog: $("view-catalog"),
    quiz: $("view-quiz"),
    report: $("view-report"),
    history: $("view-history"),
    stats: $("view-stats"),
  };

  function show(view) {
    Object.values(views).forEach((el) => el.classList.add("hidden"));
    views[view].classList.remove("hidden");
  }

  function directionLabel(d) {
    return d === "en_zh" ? "英 → 中" : "中 → 英";
  }

  function verdictMark(v) {
    return v === "correct" ? "✓" : "✗";
  }

  function fmtMs(ms) {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    return iso.replace("T", " ").slice(0, 19);
  }

  /** Calendar day from start time (测评日期). */
  function dateFromIso(iso) {
    if (!iso) return "—";
    const s = String(iso);
    return s.length >= 10 ? s.slice(0, 10) : "—";
  }

  function fmtClock(iso) {
    if (!iso) return "—";
    const s = String(iso).replace("T", " ");
    const m = s.match(/\b(\d{2}:\d{2}:\d{2})\b/);
    return m ? m[1] : s.slice(11, 19) || "—";
  }

  function parseIsoMs(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  function fmtDurationZh(startedAt, endedAt) {
    const a = parseIsoMs(startedAt);
    const b = parseIsoMs(endedAt);
    if (a == null || b == null || b < a) return "—";
    let sec = Math.round((b - a) / 1000);
    if (sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}小时${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = j.detail || JSON.stringify(j);
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  }

  function categoryLabel(batch) {
    const parts = String(batch || "").split("/");
    const cat = parts.length > 1 ? parts[0] : parts[0] || "";
    return cat.replace(/^\d+\./, "") || cat || "词表";
  }

  function rebuildCatalogIndex() {
    const byCat = {};
    for (const batch of state.batches) {
      const cat = batch.category || categoryLabel(batch.batch) || "词表";
      if (!byCat[cat]) byCat[cat] = [];
      for (const day of batch.days) {
        byCat[cat].push({
          batch: batch.batch,
          category: cat,
          day: day.day,
          word_count: day.word_count,
        });
      }
    }
    for (const cat of Object.keys(byCat)) {
      byCat[cat].sort((a, b) => a.day - b.day || a.batch.localeCompare(b.batch));
    }
    state.catalogByCategory = byCat;
    const cats = CATEGORY_ORDER.filter((c) => byCat[c] && byCat[c].length);
    for (const c of Object.keys(byCat).sort()) {
      if (!cats.includes(c)) cats.push(c);
    }
    if (!cats.includes(state.catalogCategory) && cats.length) {
      state.catalogCategory = cats[0];
    }
    if (!cats.includes(state.historyCategory) && cats.length) {
      state.historyCategory = cats[0];
    }
    if (!cats.includes(state.statsCategory) && cats.length) {
      state.statsCategory = cats[0];
    }
    return cats;
  }

  function renderCategoryTabs(el, active, onSelect) {
    if (!el) return;
    const cats = rebuildCatalogIndex();
    el.innerHTML = "";
    for (const cat of cats) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab" + (cat === active ? " active" : "");
      btn.dataset.category = cat;
      btn.setAttribute("role", "tab");
      btn.textContent = cat;
      btn.addEventListener("click", () => onSelect(cat));
      el.appendChild(btn);
    }
  }

  function renderCatalog() {
    const root = $("batch-list");
    root.innerHTML = "";
    if (!state.batches.length) {
      root.innerHTML = "<p class='lead'>没有找到词表。请确认各大类批次下有 默写/words.json。</p>";
      return;
    }

    renderCategoryTabs($("catalog-category-tabs"), state.catalogCategory, (cat) => {
      state.catalogCategory = cat;
      state.selected = null;
      updateStartBtn();
      renderCatalog();
    });

    const days = (state.catalogByCategory[state.catalogCategory] || []).slice();
    const box = document.createElement("div");
    box.className = "batch";
    const grid = document.createElement("div");
    grid.className = "day-grid";
    if (!days.length) {
      grid.innerHTML = "<p class='lead'>该大类暂无词表</p>";
    }
    for (const day of days) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-card";
      if (
        state.selected &&
        state.selected.batch === day.batch &&
        state.selected.day === day.day
      ) {
        btn.classList.add("active");
      }
      btn.innerHTML = `<span class="n">第 ${day.day} 天</span><span class="c">${day.word_count} 词</span>`;
      btn.addEventListener("click", () => {
        state.selected = day;
        updateStartBtn();
        renderCatalog();
      });
      grid.appendChild(btn);
    }
    box.appendChild(grid);
    root.appendChild(box);
    syncDirectionTabs("catalog-direction-tabs", state.direction);
    updateStartBtn();
  }

  function updateStartBtn() {
    const btn = $("start-btn");
    if (!btn) return;
    btn.disabled = !state.selected;
  }

  function syncDirectionTabs(rootId, activeDir) {
    document.querySelectorAll(`#${rootId} .tab`).forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.direction === activeDir);
    });
  }

  function bindTabs() {
    document.querySelectorAll("#catalog-direction-tabs .tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.direction = tab.dataset.direction;
        syncDirectionTabs("catalog-direction-tabs", state.direction);
      });
    });

    document.querySelectorAll("#history-direction-tabs .tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.historyDirection = tab.dataset.direction;
        syncDirectionTabs("history-direction-tabs", state.historyDirection);
        renderHistoryRows();
      });
    });

    document.querySelectorAll("#stats-direction-tabs .tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.statsDirection = tab.dataset.direction;
        syncDirectionTabs("stats-direction-tabs", state.statsDirection);
        loadStats();
      });
    });
  }

  function daysForCategory(category) {
    return (state.catalogByCategory[category] || []).slice();
  }

  function ensureDayInCategory(which) {
    const cat = which === "history" ? state.historyCategory : state.statsCategory;
    const days = daysForCategory(cat);
    const cur = which === "history" ? state.historyDay : state.statsDay;
    if (!days.length) {
      if (which === "history") state.historyDay = 1;
      else state.statsDay = 1;
      return;
    }
    if (!days.some((d) => d.day === cur)) {
      if (which === "history") state.historyDay = days[0].day;
      else state.statsDay = days[0].day;
    }
  }

  function renderDayNav(containerId, category, selectedDay, onSelect) {
    const root = $(containerId);
    if (!root) return;
    root.innerHTML = "";
    const days = daysForCategory(category);
    const grid = document.createElement("div");
    grid.className = "day-grid";
    if (!days.length) {
      grid.innerHTML = "<p class='lead'>该大类暂无词表天数</p>";
      root.appendChild(grid);
      return;
    }
    for (const day of days) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-card" + (day.day === selectedDay ? " active" : "");
      btn.innerHTML = `<span class="n">第 ${day.day} 天</span><span class="c">${day.word_count} 词</span>`;
      btn.addEventListener("click", () => onSelect(day.day));
      grid.appendChild(btn);
    }
    root.appendChild(grid);
  }

  function resetResult() {
    $("row-expected").textContent = "";
    $("row-expected").className = "row-v is-expected";
    $("row-transcript").textContent = "";
    $("row-transcript").className = "row-v is-tone";
    const verdictEl = $("row-verdict");
    verdictEl.className = "row-v verdict-inline";
    verdictEl.textContent = "";
    $("response-line").innerHTML = "&nbsp;";
    state.answeredCurrent = false;
    state.selectedKey = null;
  }

  function renderChoices(options, { locked = false, correctKey = null, selectedKey = null } = {}) {
    const grid = $("choice-grid");
    grid.innerHTML = "";
    state.currentOptions = options || [];
    for (const opt of state.currentOptions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.dataset.key = opt.key;
      btn.innerHTML = `<span class="key">${escapeHtml(opt.key)}</span><span class="txt">${escapeHtml(opt.text)}</span>`;
      if (locked) {
        btn.disabled = true;
        if (selectedKey && opt.key === selectedKey) {
          btn.classList.add(opt.key === correctKey ? "is-correct" : "is-wrong");
        } else if (correctKey && opt.key === correctKey) {
          btn.classList.add("is-missed");
        }
      } else {
        btn.addEventListener("click", () => submitChoice(opt.key));
      }
      grid.appendChild(btn);
    }
  }

  function setLoading(on, title) {
    const overlay = $("loading-overlay");
    if (on && title) $("loading-title").textContent = title;
    overlay.classList.toggle("hidden", !on);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isOverlayBlocking() {
    const confirm = $("confirm-overlay");
    const loading = $("loading-overlay");
    return (
      (confirm && !confirm.classList.contains("hidden")) ||
      (loading && !loading.classList.contains("hidden"))
    );
  }

  async function ensureChoices(index, { timeoutMs = 60000 } = {}) {
    const key = String(index);
    const cached = state.choicesCache[key];
    if (cached && cached.options && cached.options.length) return cached;
    if (!state.sessionId) return null;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const data = await api(
          `/api/choices?session_id=${encodeURIComponent(state.sessionId)}&index=${index}`
        );
        if (data && data.options && data.options.length) {
          state.choicesCache[key] = {
            options: data.options,
            source: data.source,
          };
          return state.choicesCache[key];
        }
      } catch (_) {
        /* still generating */
      }
      await sleep(350);
    }
    return null;
  }

  function findCorrectKey(options, expectedAnswer) {
    const hit = (options || []).find((o) => o.text === expectedAnswer);
    return hit ? hit.key : null;
  }

  async function loadChoicesUnlocked() {
    $("choice-grid").innerHTML = "";
    $("choices-hint").textContent = "正在生成选项…";
    const pack = await ensureChoices(state.index);
    if (state.answersByIndex[String(state.index)]) return;
    if (pack && pack.options && pack.options.length) {
      $("choices-hint").textContent = "请选择一项";
      renderChoices(pack.options, { locked: false });
      return;
    }
    $("choices-hint").textContent = "选项生成较慢，请稍候或重新开始测评";
  }

  function restoreAnswered(saved) {
    const pack = state.choicesCache[String(state.index)] || {};
    const options = pack.options || saved.options || [];
    state.currentOptions = options;
    state.answeredCurrent = true;
    state.selectedKey = saved.choice_key || null;
    showAttemptResult(saved, { persist: false });
  }

  function isLastItem() {
    return state.items.length > 0 && state.index >= state.items.length - 1;
  }

  function updateQuizChrome() {
    const last = isLastItem();
    const done = !!state.answeredCurrent;
    const abort = $("abort-btn");
    const next = $("next-btn");
    const submitWrap = $("submit-wrap");
    const prev = $("prev-btn");

    prev.disabled = state.index === 0 || state.busy;

    if (last && done) {
      abort.classList.add("hidden");
      next.classList.add("hidden");
      submitWrap.classList.remove("hidden");
    } else {
      abort.classList.remove("hidden");
      submitWrap.classList.add("hidden");
      if (last) {
        next.classList.add("hidden");
      } else {
        next.classList.remove("hidden");
        next.disabled = state.busy;
      }
    }
  }

  async function showItem() {
    const item = state.items[state.index];
    if (!item) return;
    resetResult();
    $("prompt").textContent = item.prompt;
    $("quiz-progress").textContent = `第 ${state.index + 1} / ${state.items.length} 词`;

    const saved = state.answersByIndex[String(state.index)];
    if (saved) {
      // Already submitted this turn: view-only, cannot change
      restoreAnswered(saved);
      updateQuizChrome();
      return;
    }
    state.itemStartedAt = performance.now();
    state.itemStartedAtIso = new Date().toISOString();
    await loadChoicesUnlocked();
    updateQuizChrome();
  }

  function elapsedResponseMs() {
    if (state.itemStartedAt == null) return 0;
    return Math.max(0, Math.round(performance.now() - state.itemStartedAt));
  }

  function showAttemptResult(data, { persist = true } = {}) {
    const tone = data.verdict === "correct" ? "correct" : "wrong";
    $("row-expected").textContent = data.expected_answer || "";
    $("row-expected").className = "row-v is-expected";
    $("row-transcript").textContent = data.transcript || "（空）";
    $("row-transcript").className = `row-v is-tone ${tone}`;
    const verdictEl = $("row-verdict");
    verdictEl.className = `row-v verdict-inline ${tone}`;
    verdictEl.textContent = verdictMark(tone);

    const note = data.note ? ` · ${data.note}` : "";
    $("response-line").textContent = `用户响应时间 ${fmtMs(data.response_ms)}${note}`;
    state.answeredCurrent = true;

    const options =
      state.currentOptions && state.currentOptions.length
        ? state.currentOptions
        : (state.choicesCache[String(state.index)] || {}).options || [];
    state.currentOptions = options;

    const correctKey =
      data.correct_key ||
      findCorrectKey(options, data.expected_answer) ||
      data.choice_key;
    const selectedKey = data.choice_key || state.selectedKey;
    renderChoices(options, {
      locked: true,
      correctKey,
      selectedKey,
    });
    $("choices-hint").textContent =
      tone === "correct" ? "回答正确（不可更改）" : "回答错误（不可更改）";

    if (persist) {
      state.answersByIndex[String(state.index)] = {
        transcript: data.transcript,
        choice_key: selectedKey,
        correct_key: correctKey,
        score: data.score,
        verdict: data.verdict,
        expected_answer: data.expected_answer,
        response_ms: data.response_ms,
        note: data.note || "",
        options,
      };
    }
    updateQuizChrome();
  }

  async function submitChoice(key) {
    if (state.busy || !state.sessionId || state.answeredCurrent) return;
    if (state.answersByIndex[String(state.index)]) return;
    state.busy = true;
    state.selectedKey = key;
    $("next-btn").disabled = true;
    $("choices-hint").textContent = "判分中…";
    try {
      const fd = new FormData();
      fd.append("session_id", state.sessionId);
      fd.append("index", String(state.index));
      fd.append("item_started_at", state.itemStartedAtIso || new Date().toISOString());
      fd.append("client_response_ms", String(elapsedResponseMs()));
      fd.append("ended_reason", "scored");
      fd.append("choice_key", key);
      const data = await api("/api/attempt", { method: "POST", body: fd });
      showAttemptResult(data);
    } catch (err) {
      alert(`判分失败：${err.message}`);
      $("choices-hint").textContent = "请重新选择";
    } finally {
      state.busy = false;
      updateQuizChrome();
    }
  }

  async function skipCurrent() {
    if (state.busy || !state.sessionId) return;
    state.busy = true;
    try {
      const fd = new FormData();
      fd.append("session_id", state.sessionId);
      fd.append("index", String(state.index));
      fd.append("item_started_at", state.itemStartedAtIso || new Date().toISOString());
      fd.append("client_response_ms", String(elapsedResponseMs()));
      fd.append("ended_reason", "skipped");
      const data = await api("/api/attempt", { method: "POST", body: fd });
      showAttemptResult(data);
    } catch (err) {
      alert(`跳过失败：${err.message}`);
    } finally {
      state.busy = false;
    }
  }

  async function finish(reason) {
    if (!state.sessionId) return;
    state.busy = true;
    setLoading(true, "写报告中");
    try {
      const summary = await api("/api/session/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId, reason }),
      });
      renderReport(summary);
      show("report");
    } catch (err) {
      alert(`结束失败：${err.message}`);
    } finally {
      setLoading(false);
      state.busy = false;
    }
  }

  function askConfirm(opts = {}) {
    const {
      kicker = "提前退出",
      title = "确定要结束本次测评吗？",
      body = "当前进度会生成报告，已作答内容会保留。",
      okText = "确认退出",
      cancelText = "继续答题",
    } = opts;
    return new Promise((resolve) => {
      const overlay = $("confirm-overlay");
      const ok = $("confirm-ok");
      const cancel = $("confirm-cancel");
      const kickerEl = $("confirm-kicker");
      const bodyEl = $("confirm-body");
      const card = overlay.querySelector(".confirm-card");
      kickerEl.textContent = kicker || "";
      kickerEl.classList.toggle("hidden", !kicker);
      $("confirm-title").textContent = title;
      bodyEl.textContent = body || "";
      bodyEl.classList.toggle("hidden", !body);
      if (card) card.classList.toggle("confirm-compact", !kicker && !body);
      ok.textContent = okText;
      cancel.textContent = cancelText;
      const close = (value) => {
        overlay.classList.add("hidden");
        ok.removeEventListener("click", onOk);
        cancel.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKey);
        resolve(value);
      };
      const onOk = () => close(true);
      const onCancel = () => close(false);
      const onBackdrop = (e) => {
        if (e.target === overlay) close(false);
      };
      const onKey = (e) => {
        if (e.key === "Escape") close(false);
        if (e.key === "Enter") close(true);
      };
      overlay.classList.remove("hidden");
      ok.focus();
      ok.addEventListener("click", onOk);
      cancel.addEventListener("click", onCancel);
      overlay.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKey);
    });
  }

  async function goNext() {
    if (state.busy) return;
    if (isLastItem()) return;
    if (!state.answeredCurrent) {
      const yes = await askConfirm({
        kicker: "跳过本题",
        title: "本题尚未作答，确定跳过吗？",
        body: "跳过将记为错误，并进入下一词。",
        okText: "确认跳过",
        cancelText: "继续作答",
      });
      if (!yes) return;
      await skipCurrent();
    }
    state.index += 1;
    await showItem();
  }

  async function submitQuiz() {
    if (state.busy || !isLastItem() || !state.answeredCurrent) return;
    await finish("completed");
  }

  async function goPrev() {
    if (state.busy || state.index === 0) return;
    state.index -= 1;
    await showItem();
  }

  function renderReport(summary) {
    const cat = summary.category || categoryLabel(summary.batch) || "—";
    const dayLabel = summary.day_label || `第${summary.day}天`;
    const dir = summary.direction_label || directionLabel(summary.direction);
    $("report-meta").textContent = `${cat} | ${dayLabel} | ${dir}`;
    const t0 = fmtClock(summary.started_at);
    const t1 = fmtClock(summary.ended_at);
    $("report-time").textContent =
      t0 !== "—" || t1 !== "—" ? `测评时间： ${t0} ~ ${t1}` : "";

    const finishLabel =
      summary.finish_reason === "completed"
        ? "完成"
        : summary.finish_reason === "aborted"
          ? "提前退出"
          : summary.finish_reason || "—";
    const cols = [
      ["词条数量", String(summary.item_count ?? "—")],
      ["正确", String(summary.correct_count ?? 0)],
      ["错误", String(summary.wrong_count ?? 0)],
      ["正确率", `${((summary.accuracy ?? 0) * 100).toFixed(1)}%`],
      ["用时", fmtDurationZh(summary.started_at, summary.ended_at)],
      ["平均响应", fmtMs(summary.avg_response_ms)],
      ["最大响应", fmtMs(summary.max_response_ms)],
      ["最短响应", fmtMs(summary.min_response_ms)],
      ["结束原因", finishLabel],
    ];
    const table = $("summary-table");
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    thead.innerHTML = `<tr>${cols
      .map(([k]) => `<th>${escapeHtml(k)}</th>`)
      .join("")}</tr>`;
    tbody.innerHTML = `<tr>${cols
      .map(([, v]) => `<td>${escapeHtml(v)}</td>`)
      .join("")}</tr>`;

    const detailBody = $("report-table").querySelector("tbody");
    detailBody.innerHTML = "";
    (summary.detail || []).forEach((row, i) => {
      const tone = row.verdict === "correct" ? "correct" : "wrong";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td class="cell-wrap">${escapeHtml(row.prompt)}</td>
        <td class="cell-wrap">${escapeHtml(row.expected_answer)}</td>
        <td class="cell-wrap">${escapeHtml(row.transcript || "（空）")}</td>
        <td><span class="mark ${tone}">${verdictMark(tone)}</span></td>
        <td>${fmtMs(row.response_ms)}</td>`;
      detailBody.appendChild(tr);
    });
  }

  async function startSession() {
    if (!state.selected) return;
    $("start-btn").disabled = true;
    setLoading(true, "生成测评试题中");
    try {
      const data = await api("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: state.selected.batch,
          day: state.selected.day,
          direction: state.direction,
        }),
      });
      state.sessionId = data.session_id;
      state.items = data.items;
      state.day = data.day;
      state.index = 0;
      // Session-only cache; next「开始测评」will regenerate
      state.choicesCache = data.choices || {};
      state.answersByIndex = {};
      const cat =
        (state.selected && state.selected.category) ||
        categoryLabel(state.selected && state.selected.batch);
      const dayLabel = data.day_label || `第${data.day}天`;
      $("quiz-label").textContent = cat ? `${cat} · ${dayLabel}` : dayLabel;
      $("quiz-direction").textContent = directionLabel(state.direction);
      show("quiz");
      setLoading(false);
      await showItem();
    } catch (err) {
      alert(`无法开始：${err.message}`);
      setLoading(false);
    } finally {
      updateStartBtn();
    }
  }

  function renderHistoryRows() {
    const tbody = $("history-table").querySelector("tbody");
    rebuildCatalogIndex();
    ensureDayInCategory("history");
    renderCategoryTabs($("history-category-tabs"), state.historyCategory, (cat) => {
      state.historyCategory = cat;
      ensureDayInCategory("history");
      renderHistoryRows();
    });
    syncDirectionTabs("history-direction-tabs", state.historyDirection);
    renderDayNav("history-day-nav", state.historyCategory, state.historyDay, (day) => {
      state.historyDay = day;
      renderHistoryRows();
    });
    const items = (state.historyItems || []).filter((row) => {
      const cat = row.category || categoryLabel(row.batch);
      return (
        cat === state.historyCategory &&
        (row.direction || "en_zh") === state.historyDirection &&
        Number(row.day) === Number(state.historyDay)
      );
    });
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="9">该大类／方向／天暂无历史报告</td></tr>`;
      return;
    }
    tbody.innerHTML = "";
    for (const row of items) {
      const tr = document.createElement("tr");
      const acc = row.accuracy == null ? "—" : `${(row.accuracy * 100).toFixed(1)}%`;
      const dur = fmtDurationZh(row.started_at, row.ended_at);
      tr.innerHTML = `
        <td>${escapeHtml(dateFromIso(row.started_at) || row.date || "—")}</td>
        <td>${escapeHtml(fmtTime(row.started_at))}</td>
        <td>${escapeHtml(fmtTime(row.ended_at))}</td>
        <td>${escapeHtml(dur)}</td>
        <td>${escapeHtml(row.day_label || `第${row.day}天`)}</td>
        <td>${row.item_count ?? "—"}</td>
        <td>${acc}</td>
        <td><a class="linkish" href="#" data-sid="${escapeHtml(row.session_id)}">查看</a></td>
        <td>
          <button type="button" class="icon-btn trash-btn" title="删除报告" aria-label="删除报告">
            <span class="icon-trash" aria-hidden="true"></span>
          </button>
        </td>`;
      tr.querySelector("a").addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const summary = await api(`/api/history/${row.session_id}`);
          renderReport(summary);
          show("report");
        } catch (err) {
          alert(`打开报告失败：${err.message}`);
        }
      });
      tr.querySelector(".trash-btn").addEventListener("click", async () => {
        const yes = await askConfirm({
          kicker: "",
          title: "确定删除这份测评报告吗？",
          body: "",
          okText: "确认删除",
          cancelText: "取消",
        });
        if (!yes) return;
        try {
          await api(`/api/history/${encodeURIComponent(row.session_id)}`, {
            method: "DELETE",
          });
          state.historyItems = (state.historyItems || []).filter(
            (r) => r.session_id !== row.session_id
          );
          renderHistoryRows();
        } catch (err) {
          alert(`删除失败：${err.message}`);
        }
      });
      tbody.appendChild(tr);
    }
  }

  async function loadHistory() {
    const tbody = $("history-table").querySelector("tbody");
    tbody.innerHTML = `<tr><td colspan="9">加载中…</td></tr>`;
    try {
      const data = await api("/api/history");
      state.historyItems = data.items || [];
      renderHistoryRows();
    } catch (err) {
      state.historyItems = [];
      tbody.innerHTML = `<tr><td colspan="9">加载失败：${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function sortedStatsItems() {
    const items = (state.statsItems || []).slice();
    const desc = state.statsErrorRateDesc;
    items.sort((a, b) => {
      const ra = a.error_rate ?? 0;
      const rb = b.error_rate ?? 0;
      if (ra !== rb) return desc ? rb - ra : ra - rb;
      return String(a.prompt || "").localeCompare(String(b.prompt || ""), "zh");
    });
    return items;
  }

  function updateStatsSortHeader() {
    const th = $("stats-error-rate-th");
    if (!th) return;
    th.textContent = state.statsErrorRateDesc ? "错误率 ▾" : "错误率 ▴";
  }

  function renderStatsRows() {
    const tbody = $("stats-table").querySelector("tbody");
    rebuildCatalogIndex();
    ensureDayInCategory("stats");
    renderCategoryTabs($("stats-category-tabs"), state.statsCategory, (cat) => {
      state.statsCategory = cat;
      ensureDayInCategory("stats");
      loadStats();
    });
    syncDirectionTabs("stats-direction-tabs", state.statsDirection);
    renderDayNav("stats-day-nav", state.statsCategory, state.statsDay, (day) => {
      state.statsDay = day;
      loadStats();
    });
    updateStatsSortHeader();

    const items = sortedStatsItems();
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7">该大类／方向／天暂无错误词统计</td></tr>`;
      return;
    }
    tbody.innerHTML = "";
    items.forEach((row, i) => {
      const tr = document.createElement("tr");
      const rate =
        row.error_rate == null ? "—" : `${(row.error_rate * 100).toFixed(1)}%`;
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td class="cell-wrap">${escapeHtml(row.prompt || "")}</td>
        <td class="cell-wrap">${escapeHtml(row.expected_answer || "")}</td>
        <td>${row.attempt_count ?? "—"}</td>
        <td>${row.wrong_count ?? "—"}</td>
        <td>${rate}</td>
        <td>${escapeHtml(fmtTime(row.last_started_at))}</td>`;
      tbody.appendChild(tr);
    });
  }

  async function loadStats() {
    const tbody = $("stats-table").querySelector("tbody");
    rebuildCatalogIndex();
    ensureDayInCategory("stats");
    tbody.innerHTML = `<tr><td colspan="7">加载中…</td></tr>`;
    try {
      const q = new URLSearchParams({
        category: state.statsCategory,
        direction: state.statsDirection,
        day: String(state.statsDay),
      });
      const data = await api(`/api/stats/errors?${q.toString()}`);
      state.statsItems = data.items || [];
      renderStatsRows();
    } catch (err) {
      state.statsItems = [];
      tbody.innerHTML = `<tr><td colspan="7">加载失败：${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function init() {
    bindTabs();

    $("go-practice").addEventListener("click", () => show("catalog"));
    $("go-history").addEventListener("click", async () => {
      show("history");
      await loadHistory();
    });
    $("go-stats").addEventListener("click", async () => {
      show("stats");
      await loadStats();
    });
    $("back-home-from-catalog").addEventListener("click", () => show("home"));
    $("back-home-from-history").addEventListener("click", () => show("home"));
    $("back-home-from-stats").addEventListener("click", () => show("home"));
    const errTh = $("stats-error-rate-th");
    if (errTh) {
      errTh.addEventListener("click", () => {
        state.statsErrorRateDesc = !state.statsErrorRateDesc;
        renderStatsRows();
      });
    }
    $("back-home-from-report").addEventListener("click", () => {
      state.sessionId = null;
      state.items = [];
      state.index = 0;
      state.choicesCache = {};
      state.answersByIndex = {};
      show("home");
    });
    $("back-history-from-report").addEventListener("click", async () => {
      show("history");
      await loadHistory();
    });

    $("start-btn").addEventListener("click", startSession);
    updateStartBtn();
    syncDirectionTabs("catalog-direction-tabs", state.direction);
    syncDirectionTabs("history-direction-tabs", state.historyDirection);
    syncDirectionTabs("stats-direction-tabs", state.statsDirection);
    $("next-btn").addEventListener("click", goNext);
    $("prev-btn").addEventListener("click", goPrev);
    $("submit-btn").addEventListener("click", submitQuiz);

    $("abort-btn").addEventListener("click", async () => {
      const yes = await askConfirm({
        kicker: "提前退出",
        title: "确定要结束本次测评吗？",
        body: "当前进度会生成报告，已作答内容会保留。",
        okText: "确认退出",
        cancelText: "继续答题",
      });
      if (!yes) return;
      if (!state.answeredCurrent && state.items.length) {
        await skipCurrent();
      }
      await finish("aborted");
    });

    // Keyboard A-D
    window.addEventListener("keydown", (e) => {
      if (!views.quiz || views.quiz.classList.contains("hidden")) return;
      if (isOverlayBlocking()) return;
      if (state.busy || state.answeredCurrent) return;
      const key = e.key.toUpperCase();
      if (!["A", "B", "C", "D"].includes(key)) return;
      e.preventDefault();
      submitChoice(key);
    });

    try {
      const data = await api("/api/days");
      state.batches = data.batches || [];
      renderCatalog();
      show("home");
    } catch (err) {
      $("batch-list").innerHTML = `<p class="lead">加载目录失败：${escapeHtml(err.message)}</p>`;
      show("home");
    }
  }

  init();
})();
