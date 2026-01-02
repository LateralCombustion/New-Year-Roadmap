/* ========================== START app.js (PART 1/2) ========================== */
/* =========================================================
FILE: app.js
PROJECT: Erlend 2026 Roadmap (Roadmap Simulator)
BASE: Your uploaded version (kept full length; no nerfing)
CHANGES (this patch):
- Adds deadlines to normal Tasks + Sub-tasks (not Daily)
- Deadline UI: date input beside task/subtask
- If deadline missed and not completed -> RED (failed)
========================================================= */

/* ===== Constants / Helpers ===== */
const STORAGE_KEY = "erlend_roadmap_2026_v1";

const STATUS = { BLACK: "black", YELLOW: "yellow", GREEN: "green", RED: "red" };
const STATUS_CYCLE = [STATUS.BLACK, STATUS.GREEN, STATUS.RED];

function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

// Daily tasks do NOT use RED (failed) – they are checked daily, not “failed”.
function toggleDailyStatus(current) {
  return (current === STATUS.GREEN) ? STATUS.BLACK : STATUS.GREEN;
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }
function formatPct(x) { return `${Math.round(clamp01(x) * 100)}%`; }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* ===== Deadlines (Tasks + Sub-tasks) ===== */
function todayLocalKey(){
  // Uses your existing local date helpers (YYYY-MM-DD)
  return dateKeyToday();
}
function isOverdue(deadline){
  if (!deadline) return false;
  return todayLocalKey() > deadline;
}

/* Date helpers (local time) */
function pad2(n) { return String(n).padStart(2, "0"); }
function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dateKeyToday() { return dateKeyFromDate(new Date()); }

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return dateKeyFromDate(dt);
}

/* Inclusive day count: Jan 1 → selected date */
function daysBetweenInclusive(startKey, endKey) {
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  a.setHours(0,0,0,0);
  b.setHours(0,0,0,0);
  const ms = b.getTime() - a.getTime();
  const days = Math.floor(ms / 86400000);
  return days >= 0 ? (days + 1) : 0;
}

/* ===== State ===== */
function defaultState() {
  // Daily: master task definitions + per-date status log
  const dailyMaster = [
    { id: uid(), text: "Early up/sleep", subtasks: [] },
    { id: uid(), text: "Morning routine", subtasks: [] },
    { id: uid(), text: "Triple meals", subtasks: [] },
    { id: uid(), text: "Supplements", subtasks: [] },
  ];

  return {
    roadmapName: "Erlend 2026",
    ownerName: "Name",
    simulatorName: "Erlend Simulator 2026",
    brightMode: false, // placeholder only
    createdAt: Date.now(),

    bgImage: "", // dataURL or URL

    selectedDailyDate: dateKeyToday(),

    categories: [
      { id: uid(), name: "Personal", deletable: true, tasks: [] },
      { id: uid(), name: "Work", deletable: true, tasks: [] },
      { id: uid(), name: "Training", deletable: true, tasks: [] },
      { id: uid(), name: "Social", deletable: true, tasks: [] },
      { id: uid(), name: "Health", deletable: true, tasks: [] },
      { id: uid(), name: "Recreational", deletable: true, tasks: [] },
      { id: uid(), name: "Economy", deletable: true, tasks: [] },
      { id: uid(), name: "Housing", deletable: true, tasks: [] },
    ],

    daily: {
      id: "daily-fixed",
      name: "Daily",
      deletable: false,

      // master definitions (task text + subtask definitions)
      masterTasks: dailyMaster,

      // log: dateKey -> taskId -> { status, subtasks: { subId: status } }
      log: {}
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);

    // Validate minimum
    if (!s || !s.categories || !s.daily) return defaultState();
    if (!s.daily.masterTasks) {
      // If daily exists but missing new shape, reset daily only
      const fresh = defaultState();
      s.daily = fresh.daily;
      s.selectedDailyDate = fresh.selectedDailyDate;
    }
    if (!s.selectedDailyDate) s.selectedDailyDate = dateKeyToday();
    if (!s.daily.log) s.daily.log = {};

    // If categories are missing/empty, seed the initial set
    if (!Array.isArray(s.categories) || s.categories.length === 0) {
      const fresh = defaultState();
      s.categories = fresh.categories;
    }

    return s;
  } catch {
    return defaultState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ===== DOM refs ===== */
const nowStamp = document.getElementById("nowStamp");
const weekStamp = document.getElementById("weekStamp");

const barOverall = document.getElementById("barOverall");
const barOverallText = document.getElementById("barOverallText");
const categoryBars = document.getElementById("categoryBars");

const dailyList = document.getElementById("dailyList");
const categoriesGrid = document.getElementById("categoriesGrid");

const btnAddCategory = document.getElementById("btnAddCategory");
const btnAddDailyTask = document.getElementById("btnAddDailyTask");
const btnResetAll = document.getElementById("btnResetAll");
const btnRenameRoadmap = document.getElementById("btnRenameRoadmap");
const btnNewRoadmap = document.getElementById("btnNewRoadmap");

const btnLoadRoadmap = document.getElementById("btnLoadRoadmap");
const btnExportRoadmap = document.getElementById("btnExportRoadmap");
const fileLoader = document.getElementById("fileLoader");

const btnOptions = document.getElementById("btnOptions");
const optionsModal = document.getElementById("optionsModal");
const btnCloseOptions = document.getElementById("btnCloseOptions");
const btnSaveOptions = document.getElementById("btnSaveOptions");
const optRoadmapTitle = document.getElementById("optRoadmapTitle");
const optOwnerName = document.getElementById("optOwnerName");
const optSimName = document.getElementById("optSimName");
const optBrightMode = document.getElementById("optBrightMode");

// Background image controls (Options)
const btnBgExample = document.getElementById("btnBgExample");
const btnBgUpload = document.getElementById("btnBgUpload");
const btnBgClear = document.getElementById("btnBgClear");
const bgLoader = document.getElementById("bgLoader");

/* NEW: optional options action (only binds if exists in HTML) */
const btnClearDailyLog = document.getElementById("btnClearDailyLog");

const ownerNameEl = document.getElementById("ownerName");
const simNameEl = document.getElementById("simName");
const roadmapTitleEl = document.getElementById("roadmapTitle");

const backdrop = document.getElementById("backdrop");
const subtaskModal = document.getElementById("subtaskModal");
const subtaskModalTitle = document.getElementById("subtaskModalTitle");
const subtaskList = document.getElementById("subtaskList");
const btnCloseModal = document.getElementById("btnCloseModal");
const btnAddSubtask = document.getElementById("btnAddSubtask");

/* Daily date controls */
const dailyDateInput = document.getElementById("dailyDate");
const btnDayPrev = document.getElementById("btnDayPrev");
const btnDayNext = document.getElementById("btnDayNext");
const btnDayToday = document.getElementById("btnDayToday");

/* Modal context */
let modalCtx = { scope: null, taskId: null }; // scope: "daily" or categoryId

/* =========================================================
   RMB Context Menu (Rename)
========================================================= */
const ctxMenu = document.createElement("div");
ctxMenu.id = "ctxMenu";
ctxMenu.style.position = "fixed";
ctxMenu.style.zIndex = "9999";
ctxMenu.style.minWidth = "160px";
ctxMenu.style.padding = "6px";
ctxMenu.style.borderRadius = "8px";
ctxMenu.style.border = "1px solid rgba(255,255,255,0.14)";
ctxMenu.style.background = "rgba(20,20,20,0.95)";
ctxMenu.style.boxShadow = "0 12px 30px rgba(0,0,0,0.55)";
ctxMenu.style.display = "none";
document.body.appendChild(ctxMenu);

function closeCtxMenu() {
  ctxMenu.style.display = "none";
  ctxMenu.innerHTML = "";
}

function openCtxMenu(x, y, items) {
  ctxMenu.innerHTML = "";

  items.forEach(it => {
    const item = document.createElement("div");
    item.textContent = it.label;
    item.style.padding = "10px 10px";
    item.style.borderRadius = "6px";
    item.style.cursor = "pointer";
    item.style.userSelect = "none";
    item.style.opacity = "0.95";
    item.addEventListener("mouseenter", () => item.style.background = "rgba(255,255,255,0.08)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    item.addEventListener("click", () => {
      closeCtxMenu();
      it.onClick();
    });
    ctxMenu.appendChild(item);
  });

  ctxMenu.style.display = "block";
  ctxMenu.style.left = "0px";
  ctxMenu.style.top = "0px";

  const rect = ctxMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 10);
  const top = Math.min(y, window.innerHeight - rect.height - 10);

  ctxMenu.style.left = `${Math.max(6, left)}px`;
  ctxMenu.style.top = `${Math.max(6, top)}px`;
}

/* Close RMB menu on click/Escape/scroll/resize */
document.addEventListener("click", () => closeCtxMenu(), true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCtxMenu(); }, true);
window.addEventListener("scroll", () => closeCtxMenu(), true);
window.addEventListener("resize", () => closeCtxMenu(), true);

/* ===== Daily log accessors ===== */
function ensureDailyLog(dateKey) {
  if (!state.daily.log[dateKey]) state.daily.log[dateKey] = {};
  return state.daily.log[dateKey];
}

function ensureDailyTaskEntry(dateKey, taskId) {
  const log = ensureDailyLog(dateKey);
  if (!log[taskId]) log[taskId] = { status: STATUS.BLACK, subtasks: {} };
  if (!log[taskId].subtasks) log[taskId].subtasks = {};
  if (!log[taskId].status) log[taskId].status = STATUS.BLACK;
  return log[taskId];
}

function getDailyMasterTask(taskId) {
  return state.daily.masterTasks.find(t => t.id === taskId) || null;
}

function getDailyStatus(dateKey, taskId) {
  const entry = ensureDailyTaskEntry(dateKey, taskId);
  const st = entry.status || STATUS.BLACK;
  return (st === STATUS.RED) ? STATUS.BLACK : st;
}

function setDailyStatus(dateKey, taskId, status) {
  const entry = ensureDailyTaskEntry(dateKey, taskId);
  entry.status = status;
}

function getDailySubStatus(dateKey, taskId, subId) {
  const entry = ensureDailyTaskEntry(dateKey, taskId);
  if (!(subId in entry.subtasks)) entry.subtasks[subId] = STATUS.BLACK;
  const st = entry.subtasks[subId];
  return (st === STATUS.RED) ? STATUS.BLACK : st;
}

function setDailySubStatus(dateKey, taskId, subId, status) {
  const entry = ensureDailyTaskEntry(dateKey, taskId);
  entry.subtasks[subId] = status;
}

/* ===== Subtask → Parent rules ===== */
function deriveParentStatusFromSubStatuses(subStatuses) {
  const anyRed = subStatuses.some(s => s === STATUS.RED);
  const allGreen = subStatuses.length > 0 && subStatuses.every(s => s === STATUS.GREEN);
  const anyGreen = subStatuses.some(s => s === STATUS.GREEN);
  if (anyRed) return STATUS.RED;
  if (allGreen) return STATUS.GREEN;
  if (anyGreen) return STATUS.YELLOW;
  return STATUS.BLACK;
}

/* ===== Progress Computation ===== */
function taskProgressNormal(task) {
  if (task.subtasks && task.subtasks.length > 0) {
    const total = task.subtasks.length;
    const done = task.subtasks.filter(st => st.status === STATUS.GREEN).length;
    return total === 0 ? 0 : done / total;
  }
  return task.status === STATUS.GREEN ? 1 : 0;
}

function taskProgressDaily(dateKey, masterTask) {
  const subs = masterTask.subtasks || [];
  if (subs.length > 0) {
    const done = subs.filter(st => getDailySubStatus(dateKey, masterTask.id, st.id) === STATUS.GREEN).length;
    return subs.length === 0 ? 0 : done / subs.length;
  }
  return getDailyStatus(dateKey, masterTask.id) === STATUS.GREEN ? 1 : 0;
}

function categoryProgress(cat) {
  const tasks = cat.tasks || [];
  if (tasks.length === 0) return 0;
  return tasks.reduce((sum, t) => sum + taskProgressNormal(t), 0) / tasks.length;
}

function dailyProgress(dateKey) {
  const tasks = state.daily.masterTasks || [];
  if (tasks.length === 0) return 0;
  return tasks.reduce((sum, t) => sum + taskProgressDaily(dateKey, t), 0) / tasks.length;
}

function dailyProgressCumulative(dateKey) {
  const tasks = state.daily.masterTasks || [];
  if (tasks.length === 0) return 0;

  const d = parseDateKey(dateKey);
  const startKey = `${d.getFullYear()}-01-01`;
  const nDays = daysBetweenInclusive(startKey, dateKey);
  if (nDays <= 0) return 0;

  let sum = 0;
  let dayKey = startKey;

  for (let i = 0; i < nDays; i++) {
    const dayProg = tasks.reduce((s, t) => s + taskProgressDaily(dayKey, t), 0) / tasks.length;
    sum += dayProg;
    dayKey = addDays(dayKey, 1);
  }

  return sum / nDays;
}

function overallProgress(dateKey) {
  const cats = state.categories || [];
  const allNonDailyTasks = cats.flatMap(c => (c.tasks || []));
  const dailyTasks = state.daily.masterTasks || [];

  const totalCount = allNonDailyTasks.length + dailyTasks.length;
  if (totalCount === 0) return 0;

  const sumNonDaily = allNonDailyTasks.reduce((s, t) => s + taskProgressNormal(t), 0);
  const dailyComponent = dailyProgressCumulative(dateKey) * dailyTasks.length;

  return (sumNonDaily + dailyComponent) / totalCount;
}

function totalTaskCount() {
  const cats = state.categories || [];
  const allNonDailyTasks = cats.reduce((sum, c) => sum + ((c.tasks || []).length), 0);
  const dailyCount = (state.daily.masterTasks || []).length;
  return allNonDailyTasks + dailyCount;
}
/* =========================== END app.js (PART 1/2) =========================== */

/* ========================== START app.js (PART 2/2) ========================== */
function renderProgress() {
  const dateKey = state.selectedDailyDate;

  const ov = overallProgress(dateKey);
  const ovPct = Math.round(ov * 100);

  barOverall.style.width = `${ovPct}%`;
  const overallBarEl = barOverall.parentElement;
  const hasAnyTasks = totalTaskCount() > 0;

  overallBarEl.classList.toggle("bar--completed", ovPct === 100 && hasAnyTasks);
  barOverallText.textContent = (ovPct === 100 && hasAnyTasks) ? "COMPLETED!" : formatPct(ov);

  categoryBars.innerHTML = "";

  // Non-daily categories
  (state.categories || []).forEach(cat => {
    const row = el("div", "progressRow");
    const label = el("div", "progressRow__label", cat.name);

    const bar = el("div", "bar");
    const fill = el("div", "bar__fill");
    const text = el("div", "bar__text");

    const p = categoryProgress(cat);
    const pct = Math.round(p * 100);
    fill.style.width = `${pct}%`;

    const hasTasks = (cat.tasks || []).length > 0;
    bar.classList.toggle("bar--completed", pct === 100 && hasTasks);
    text.textContent = (pct === 100 && hasTasks) ? "COMPLETED!" : formatPct(p);

    bar.appendChild(fill);
    bar.appendChild(text);

    row.appendChild(label);
    row.appendChild(bar);
    categoryBars.appendChild(row);
  });

  // Daily progress bar (cumulative)
  {
    const row = el("div", "progressRow");
    const label = el("div", "progressRow__label", "Daily");
    label.title = "Cumulative daily progress (average from Jan 1 → selected date)";

    const bar = el("div", "bar");
    const fill = el("div", "bar__fill");
    const text = el("div", "bar__text");

    const p = dailyProgressCumulative(dateKey);
    const pct = Math.round(p * 100);
    fill.style.width = `${pct}%`;

    const hasTasks = (state.daily.masterTasks || []).length > 0;
    bar.classList.toggle("bar--completed", pct === 100 && hasTasks);
    text.textContent = (pct === 100 && hasTasks) ? "COMPLETED!" : formatPct(p);

    bar.appendChild(fill);
    bar.appendChild(text);

    row.appendChild(label);
    row.appendChild(bar);
    categoryBars.appendChild(row);
  }
}

function renderCategories() {
  categoriesGrid.innerHTML = "";
  (state.categories || []).forEach(cat => categoriesGrid.appendChild(renderCategoryCard(cat)));
}

function renderCategoryCard(cat) {
  const card = el("section", "cat");

  const header = el("div", "cat__header");
  const title = el("div", "cat__title", cat.name);

  /* RMB rename category */
  title.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY, [
      { label: "Rename", onClick: () => renameCategory(cat.id) }
    ]);
  });

  const tools = el("div", "cat__tools");
  const add = el("div", "cat__add", "+ Add tasks");
  add.addEventListener("click", () => addTaskToCategory(cat.id));

  const del = el("div", "cat__del", "Delete");
  if (!cat.deletable) del.classList.add("disabled");
  del.addEventListener("click", () => {
    if (!cat.deletable) return;
    deleteCategory(cat.id);
  });

  tools.appendChild(add);
  tools.appendChild(del);

  header.appendChild(title);
  header.appendChild(tools);

  const list = el("div", "cat__list");
  (cat.tasks || []).forEach(task => {
    normalizeNormalTask(task);
    list.appendChild(renderTaskRowNormal(task, { scope: cat.id }));
  });

  card.appendChild(header);
  card.appendChild(list);
  return card;
}

/* ===== Normal tasks (non-daily) ===== */
function normalizeNormalTask(task) {
  if (task.subtasks && task.subtasks.length > 0) {
    const anyRed = task.subtasks.some(s => s.status === STATUS.RED);
    const allGreen = task.subtasks.every(s => s.status === STATUS.GREEN);
    const anyGreen = task.subtasks.some(s => s.status === STATUS.GREEN);
    task.status = anyRed ? STATUS.RED : (allGreen ? STATUS.GREEN : (anyGreen ? STATUS.YELLOW : STATUS.BLACK));
  }

  // Deadline override (only for normal tasks)
  if (task.deadline && isOverdue(task.deadline) && task.status !== STATUS.GREEN) {
    task.status = STATUS.RED;
  }

  return task;
}

function applyStatusClass(node, status) {
  node.classList.remove("status--black", "status--yellow", "status--green", "status--red");
  node.classList.add(`status--${status}`);
}

function renderTaskRowNormal(task, ctx) {
  const row = el("div", "task");

  // visual hint for tasks that have subtasks
  if (task.subtasks && task.subtasks.length > 0) row.classList.add("task--hasSubs");

  const statusBox = el("div", "task__status");
  applyStatusClass(statusBox, task.status);
  statusBox.title = "Click to cycle: black → green → red → black";

  statusBox.addEventListener("click", () => {
    if (task.subtasks && task.subtasks.length > 0) return;
    task.status = nextStatus(task.status);
    saveState();
    renderAll();
  });

  const text = el("div", "task__text", task.text);
  text.title = "Click to open sub-tasks";

  /* RMB rename task */
  text.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY, [
      { label: "Rename", onClick: () => renameTask(ctx.scope, task.id) }
    ]);
  });

  text.addEventListener("click", () => openSubtasks(ctx, task.id));

  // Deadline input (optional)
  const deadline = document.createElement("input");
  deadline.type = "date";
  deadline.className = "task__deadline";
  deadline.value = task.deadline || "";
  deadline.title = "Deadline (if missed, task becomes RED unless completed)";
  deadline.addEventListener("click", (e) => e.stopPropagation());
  deadline.addEventListener("change", () => {
    task.deadline = deadline.value || "";
    saveState();
    renderAll();
  });

  const remove = el("div", "task__remove", "−");
  remove.title = "Delete task (and its subtasks)";
  remove.addEventListener("click", () => deleteTask(ctx, task.id));

  row.appendChild(statusBox);
  row.appendChild(text);
  row.appendChild(deadline);
  row.appendChild(remove);
  return row;
}

/* ===== Daily rendering (date-based) ===== */
function renderDaily() {
  const dateKey = state.selectedDailyDate;
  dailyList.innerHTML = "";

  (state.daily.masterTasks || []).forEach(masterTask => {
    dailyList.appendChild(renderTaskRowDaily(masterTask, dateKey));
  });
}

function renderTaskRowDaily(masterTask, dateKey) {
  const row = el("div", "task");

  const subs = masterTask.subtasks || [];

  // Compute displayed status (subtasks override)
  let status = getDailyStatus(dateKey, masterTask.id);

  if (subs.length > 0) {
    const subStatuses = subs.map(st => getDailySubStatus(dateKey, masterTask.id, st.id));
    status = deriveParentStatusFromSubStatuses(subStatuses);
    // keep parent status in log consistent
    setDailyStatus(dateKey, masterTask.id, status);
  }

  const statusBox = el("div", "task__status");
  applyStatusClass(statusBox, status);
  statusBox.title = "Click to toggle: black ↔ green";

  statusBox.addEventListener("click", () => {
    // Lock parent when subtasks exist
    if ((masterTask.subtasks || []).length > 0) return;
    const next = toggleDailyStatus(getDailyStatus(dateKey, masterTask.id));
    setDailyStatus(dateKey, masterTask.id, next);
    saveState();
    renderAll();
  });

  const text = el("div", "task__text", masterTask.text);
  text.title = "Click to open sub-tasks";

  /* RMB rename daily master task */
  text.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY, [
      { label: "Rename", onClick: () => renameDailyTask(masterTask.id) }
    ]);
  });

  text.addEventListener("click", () => openSubtasks({ scope: "daily" }, masterTask.id));

  const remove = el("div", "task__remove", "−");
  remove.title = "Delete daily task (removes it for ALL dates)";
  remove.addEventListener("click", () => deleteDailyMasterTask(masterTask.id));

  row.appendChild(statusBox);
  row.appendChild(text);
  row.appendChild(remove);
  return row;
}

/* ===== Unified render ===== */
function renderAll() {
  enforceDeadlines();
  renderProgress();
  renderDaily();
  renderCategories();
}

function enforceDeadlines(){
  // Only normal (non-daily) tasks use deadlines.
  // Daily tasks are date-based and do not use RED/failed.
  (state.categories || []).forEach(cat => {
    (cat.tasks || []).forEach(task => {
      // Sub-task deadlines
      (task.subtasks || []).forEach(st => {
        if (st.deadline && isOverdue(st.deadline) && st.status !== STATUS.GREEN) {
          st.status = STATUS.RED;
        }
      });

      // Parent deadline (if set) — overdue + not completed => fail
      if (task.deadline && isOverdue(task.deadline)) {
        const completed = taskProgressNormal(task) === 1;
        if (!completed) task.status = STATUS.RED;
      }

      // Keep parent status consistent with subtasks + red failures
      normalizeNormalTask(task);
    });
  });
}

/* =========================================================
   Rename helpers (RMB -> Rename)
========================================================= */
function renameCategory(categoryId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const name = prompt("Rename category:", cat.name);
  if (!name) return;
  cat.name = name.trim();
  saveState();
  renderAll();
}

function renameTask(categoryId, taskId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const t = (cat.tasks || []).find(x => x.id === taskId);
  if (!t) return;
  const name = prompt("Rename task:", t.text);
  if (!name) return;
  t.text = name.trim();
  saveState();
  renderAll();
}

function renameSubtask(categoryId, taskId, subId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const t = (cat.tasks || []).find(x => x.id === taskId);
  if (!t) return;
  const st = (t.subtasks || []).find(x => x.id === subId);
  if (!st) return;

  const name = prompt("Rename sub-task:", st.text);
  if (!name) return;
  st.text = name.trim();
  saveState();
  renderAll();
  renderSubtasks(); // keeps modal updated
}

function renameDailyTask(taskId) {
  const t = getDailyMasterTask(taskId);
  if (!t) return;
  const name = prompt("Rename daily task:", t.text);
  if (!name) return;
  t.text = name.trim();
  saveState();
  renderAll();
  renderSubtasks();
}

function renameDailySubtask(taskId, subId) {
  const t = getDailyMasterTask(taskId);
  if (!t) return;
  const st = (t.subtasks || []).find(x => x.id === subId);
  if (!st) return;
  const name = prompt("Rename daily sub-task:", st.text);
  if (!name) return;
  st.text = name.trim();
  saveState();
  renderAll();
  renderSubtasks();
}

/* ===== Categories / Tasks Actions (non-daily) ===== */
function addCategory() {
  const name = prompt("Category name?");
  if (!name) return;

  state.categories.push({ id: uid(), name: name.trim(), deletable: true, tasks: [] });
  saveState();
  renderAll();
}

function deleteCategory(categoryId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;
  if (!confirm(`Delete category "${cat.name}" and all its tasks?`)) return;

  state.categories = state.categories.filter(c => c.id !== categoryId);
  saveState();
  renderAll();
}

function addTaskToCategory(categoryId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;

  const text = prompt(`New task for "${cat.name}"?`);
  if (!text) return;

  cat.tasks.push({ id: uid(), text: text.trim(), status: STATUS.BLACK, deadline: "", subtasks: [] });
  saveState();
  renderAll();
}

function deleteTask(ctx, taskId) {
  const scope = ctx.scope;
  const cat = state.categories.find(c => c.id === scope);
  if (!cat) return;

  const t = cat.tasks.find(x => x.id === taskId);
  if (!t) return;

  if (!confirm(`Delete task "${t.text}" and its subtasks?`)) return;
  cat.tasks = cat.tasks.filter(x => x.id !== taskId);

  saveState();
  renderAll();
}

/* ===== Daily master actions ===== */
function addDailyTask() {
  const text = prompt("New daily task? (This adds it to ALL dates)");
  if (!text) return;

  state.daily.masterTasks.push({ id: uid(), text: text.trim(), subtasks: [] });
  saveState();
  renderAll();
}

function deleteDailyMasterTask(taskId) {
  const t = getDailyMasterTask(taskId);
  if (!t) return;

  if (!confirm(`Delete daily task "${t.text}"?\n(This removes it for ALL dates)`)) return;

  // Remove from master
  state.daily.masterTasks = state.daily.masterTasks.filter(x => x.id !== taskId);

  // Remove from all logs
  Object.keys(state.daily.log || {}).forEach(dk => {
    if (state.daily.log[dk] && state.daily.log[dk][taskId]) {
      delete state.daily.log[dk][taskId];
    }
  });

  saveState();
  renderAll();
}

/* ===== Clear Daily task records (Options) ===== */
function clearDailyTaskRecords() {
  if (!confirm("Clear ALL daily task records for ALL dates?\n(Daily task list stays, only the checkmarks history is wiped)")) return;
  state.daily.log = {};
  saveState();
  renderAll();
}

/* ===== Subtasks Modal (supports daily + normal) ===== */
function getNormalTaskByContext(scope, taskId) {
  const cat = state.categories.find(c => c.id === scope);
  if (!cat) return null;
  return cat.tasks.find(t => t.id === taskId) || null;
}

function openSubtasks(ctx, taskId) {
  modalCtx.scope = ctx.scope;
  modalCtx.taskId = taskId;

  if (modalCtx.scope === "daily") {
    const master = getDailyMasterTask(taskId);
    if (!master) return;
    subtaskModalTitle.textContent = master.text;
  } else {
    const task = getNormalTaskByContext(modalCtx.scope, taskId);
    if (!task) return;
    subtaskModalTitle.textContent = task.text;
  }

  backdrop.classList.remove("hidden");
  subtaskModal.classList.remove("hidden");
  renderSubtasks();
}

function closeSubtaskModal() {
  subtaskModal.classList.add("hidden");
  backdrop.classList.add("hidden");
  modalCtx.scope = null;
  modalCtx.taskId = null;
}

function renderSubtasks() {
  subtaskList.innerHTML = "";

  if (modalCtx.scope === "daily") {
    const dateKey = state.selectedDailyDate;
    const master = getDailyMasterTask(modalCtx.taskId);
    if (!master) return;

    const subs = master.subtasks || [];
    subs.forEach(st => {
      const row = el("div", "task");

      const statusBox = el("div", "task__status");
      const s = getDailySubStatus(dateKey, master.id, st.id);
      applyStatusClass(statusBox, s);
      statusBox.title = "Click to toggle: black ↔ green";
      statusBox.addEventListener("click", () => {
        const next = toggleDailyStatus(getDailySubStatus(dateKey, master.id, st.id));
        setDailySubStatus(dateKey, master.id, st.id, next);

        // update parent derived status
        const subStatuses = subs.map(x => getDailySubStatus(dateKey, master.id, x.id));
        const parent = deriveParentStatusFromSubStatuses(subStatuses);
        setDailyStatus(dateKey, master.id, parent);

        saveState();
        renderAll();
        renderSubtasks();
      });

      const text = el("div", "task__text", st.text);
      text.style.cursor = "default";

      /* RMB rename daily subtask */
      text.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openCtxMenu(e.clientX, e.clientY, [
          { label: "Rename", onClick: () => renameDailySubtask(master.id, st.id) }
        ]);
      });

      const remove = el("div", "task__remove", "−");
      remove.title = "Delete sub-task (removes it for ALL dates)";
      remove.addEventListener("click", () => {
        if (!confirm(`Delete sub-task "${st.text}"?\n(This removes it for ALL dates)`)) return;

        // remove from master
        master.subtasks = master.subtasks.filter(x => x.id !== st.id);

        // remove from all logs
        Object.keys(state.daily.log || {}).forEach(dk => {
          const entry = state.daily.log[dk]?.[master.id];
          if (entry?.subtasks && st.id in entry.subtasks) delete entry.subtasks[st.id];
        });

        saveState();
        renderAll();
        renderSubtasks();
      });

      row.appendChild(statusBox);
      row.appendChild(text);
      row.appendChild(remove);
      subtaskList.appendChild(row);
    });

    return;
  }

  // normal tasks
  const task = getNormalTaskByContext(modalCtx.scope, modalCtx.taskId);
  if (!task) return;

  (task.subtasks || []).forEach(st => {
    const row = el("div", "task");

    const statusBox = el("div", "task__status");
    applyStatusClass(statusBox, st.status);
    statusBox.title = "Click to cycle: black → green → red → black";
    statusBox.addEventListener("click", () => {
      st.status = nextStatus(st.status);
      normalizeNormalTask(task);
      saveState();
      renderAll();
      renderSubtasks();
    });

    const text = el("div", "task__text", st.text);
    text.style.cursor = "default";

    /* RMB rename normal subtask */
    text.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openCtxMenu(e.clientX, e.clientY, [
        { label: "Rename", onClick: () => renameSubtask(modalCtx.scope, task.id, st.id) }
      ]);
    });

    // Deadline input (optional)
    const deadline = document.createElement("input");
    deadline.type = "date";
    deadline.className = "task__deadline";
    deadline.value = st.deadline || "";
    deadline.title = "Deadline (if missed, sub-task becomes RED unless completed)";
    deadline.addEventListener("click", (e) => e.stopPropagation());
    deadline.addEventListener("change", () => {
      st.deadline = deadline.value || "";
      normalizeNormalTask(task);
      saveState();
      renderAll();
      renderSubtasks();
    });

    const remove = el("div", "task__remove", "−");
    remove.title = "Delete sub-task";
    remove.addEventListener("click", () => {
      if (!confirm(`Delete sub-task "${st.text}"?`)) return;
      task.subtasks = task.subtasks.filter(x => x.id !== st.id);
      normalizeNormalTask(task);
      saveState();
      renderAll();
      renderSubtasks();
    });

    row.appendChild(statusBox);
    row.appendChild(text);
    row.appendChild(deadline);
    row.appendChild(remove);
    subtaskList.appendChild(row);
  });
}

function addSubtask() {
  if (modalCtx.scope === "daily") {
    const master = getDailyMasterTask(modalCtx.taskId);
    if (!master) return;

    const text = prompt("New sub-task? (Daily subtasks apply to ALL dates)");
    if (!text) return;

    master.subtasks = master.subtasks || [];
    master.subtasks.push({ id: uid(), text: text.trim() });

    saveState();
    renderAll();
    renderSubtasks();
    return;
  }

  const task = getNormalTaskByContext(modalCtx.scope, modalCtx.taskId);
  if (!task) return;

  const text = prompt("New sub-task?");
  if (!text) return;

  task.subtasks = task.subtasks || [];
  task.subtasks.push({ id: uid(), text: text.trim(), status: STATUS.BLACK, deadline: "" });

  normalizeNormalTask(task);
  saveState();
  renderAll();
  renderSubtasks();
}

/* ===== Roadmap Controls ===== */
function renameRoadmap() {
  const name = prompt("Roadmap name?", state.roadmapName || "Erlend 2026");
  if (!name) return;
  state.roadmapName = name.trim();
  saveState();
  syncHeaderText();
}

function newRoadmap() {
  if (!confirm("Create a fresh roadmap? (This will overwrite current local data)")) return;
  state = defaultState();
  saveState();
  syncHeaderText();
  syncDailyDateUI();
  renderAll();
}

function resetAll() {
  if (!confirm("Delete EVERYTHING? This resets all categories/tasks.")) return;
  state = defaultState();
  saveState();
  syncHeaderText();
  syncDailyDateUI();
  renderAll();
}

/* ===== Export / Load ===== */
function exportRoadmap() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${(state.roadmapName || "roadmap").replaceAll(" ", "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function triggerLoad() {
  fileLoader.value = "";
  fileLoader.click();
}

function handleLoadedFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!parsed || !parsed.categories || !parsed.daily) {
        alert("That file does not look like a roadmap JSON.");
        return;
      }
      state = parsed;

      // Ensure required fields exist
      if (!state.selectedDailyDate) state.selectedDailyDate = dateKeyToday();
      if (!state.daily.masterTasks) state.daily.masterTasks = [];
      if (!state.daily.log) state.daily.log = {};
      if (!Array.isArray(state.categories) || state.categories.length === 0) {
        state.categories = defaultState().categories;
      }
      if (!("bgImage" in state)) state.bgImage = "";

      saveState();
      syncHeaderText();
      syncDailyDateUI();
      renderAll();
      alert("Loaded roadmap successfully.");
    } catch {
      alert("Could not read JSON file.");
    }
  };
  reader.readAsText(file);
}

/* ===== Background image helpers ===== */
function bgExampleDataUrl() {
  // Simple SVG pattern (lightweight, works offline)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs>
    <radialGradient id="g" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#2b0b2f"/>
      <stop offset="55%" stop-color="#0b0b12"/>
      <stop offset="100%" stop-color="#050505"/>
    </radialGradient>
    <pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M0 40 H80" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
      <path d="M40 0 V80" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
      <circle cx="40" cy="40" r="10" fill="rgba(255,255,255,0.04)"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#p)"/>
</svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function setBg(url) {
  state.bgImage = url || "";
  saveState();
  syncHeaderText();
}

/* ===== Options modal ===== */
function openOptions() {
  optRoadmapTitle.value = state.roadmapName || "";
  optOwnerName.value = state.ownerName || "";
  optSimName.value = state.simulatorName || "";
  optBrightMode.checked = !!state.brightMode;

  backdrop.classList.remove("hidden");
  optionsModal.classList.remove("hidden");
}

function closeOptions() {
  optionsModal.classList.add("hidden");
  backdrop.classList.add("hidden");
}

function saveOptions() {
  state.roadmapName = (optRoadmapTitle.value || "").trim() || "Roadmap";
  state.ownerName = (optOwnerName.value || "").trim() || "Name";
  state.simulatorName = (optSimName.value || "").trim() || "Simulator";
  state.brightMode = !!optBrightMode.checked; // placeholder only

  saveState();
  syncHeaderText();

  if (state.brightMode) {
    alert("Bright mode is a placeholder in v1 (no theme switch yet).");
  }

  closeOptions();
}

function applyBackgroundFromState() {
  const url = (state.bgImage || "").trim();
  if (!url) {
    document.body.style.backgroundImage = "";
    document.body.classList.remove("hasBg");
    return;
  }
  document.body.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
  document.body.classList.add("hasBg");
}

function syncHeaderText() {
  ownerNameEl.textContent = state.ownerName || "Name";
  simNameEl.textContent = state.simulatorName || "Simulator";
  roadmapTitleEl.textContent = state.roadmapName || "Roadmap";
  applyBackgroundFromState();
}

/* ===== Daily date UI ===== */
function syncDailyDateUI() {
  if (!state.selectedDailyDate) state.selectedDailyDate = dateKeyToday();
  dailyDateInput.value = state.selectedDailyDate;
}

function setSelectedDailyDate(newDateKey) {
  state.selectedDailyDate = newDateKey;
  saveState();
  syncDailyDateUI();
  renderAll();
}

/* ===== Clock / Week ===== */
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function tick() {
  const d = new Date();
  const ts =
    `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${String(d.getFullYear()).slice(-2)} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

  nowStamp.textContent = ts;
  weekStamp.textContent = `Week # ${getWeekNumber(d)}`;
}

/* ===== Event Wiring ===== */
btnAddCategory.addEventListener("click", addCategory);
btnAddDailyTask.addEventListener("click", addDailyTask);

btnResetAll.addEventListener("click", resetAll);
btnRenameRoadmap.addEventListener("click", renameRoadmap);
btnNewRoadmap.addEventListener("click", newRoadmap);

btnExportRoadmap.addEventListener("click", exportRoadmap);
btnLoadRoadmap.addEventListener("click", triggerLoad);
fileLoader.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleLoadedFile(file);
});

btnOptions.addEventListener("click", openOptions);
btnCloseOptions.addEventListener("click", closeOptions);
btnSaveOptions.addEventListener("click", saveOptions);

// Background image controls
if (btnBgExample) btnBgExample.addEventListener("click", () => setBg(bgExampleDataUrl()));
if (btnBgClear) btnBgClear.addEventListener("click", () => setBg(""));
if (btnBgUpload && bgLoader) {
  btnBgUpload.addEventListener("click", () => { bgLoader.value = ""; bgLoader.click(); });
  bgLoader.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) {
        alert("That file does not look like an image.");
        return;
      }
      setBg(dataUrl);
    };
    reader.readAsDataURL(file);
  });
}

/* options button (if present) */
if (btnClearDailyLog) {
  btnClearDailyLog.addEventListener("click", clearDailyTaskRecords);
}

btnCloseModal.addEventListener("click", closeSubtaskModal);
btnAddSubtask.addEventListener("click", addSubtask);

backdrop.addEventListener("click", () => {
  if (!subtaskModal.classList.contains("hidden")) closeSubtaskModal();
  if (!optionsModal.classList.contains("hidden")) closeOptions();
});

/* Daily date navigation */
dailyDateInput.addEventListener("change", () => {
  if (!dailyDateInput.value) return;
  setSelectedDailyDate(dailyDateInput.value);
});
btnDayPrev.addEventListener("click", () => setSelectedDailyDate(addDays(state.selectedDailyDate, -1)));
btnDayNext.addEventListener("click", () => setSelectedDailyDate(addDays(state.selectedDailyDate, +1)));
btnDayToday.addEventListener("click", () => setSelectedDailyDate(dateKeyToday()));

/* ===== Boot ===== */
tick();
setInterval(tick, 1000);
syncHeaderText();
syncDailyDateUI();
renderAll();
/* =========================== END app.js (PART 2/2) =========================== */
