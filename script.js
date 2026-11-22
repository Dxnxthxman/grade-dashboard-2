"use strict";

/* =========================================================
   Constants
   ========================================================= */
const STORAGE_KEY = "myGradeDashboard.v1";

// 밝고 구분이 잘 되는 과목 색상
const SUBJECT_COLORS = [
  "#3478f6", "#ef5350", "#f5a623", "#0fae5c", "#8e5cf7",
  "#00b3c7", "#ff7a59", "#5c6bc0", "#d4a106", "#78909c",
];

// 예전 디자인의 색상 → 새 색상 (이미 저장된 과목도 새 색으로 바뀌도록)
const LEGACY_COLORS = [
  "#2563eb", "#0ea5e9", "#6366f1", "#14b8a6", "#f59e0b",
  "#ec4899", "#8b5cf6", "#22c55e", "#ef4444", "#64748b",
];

const LIMITS = { subjectName: 30, examName: 50, maxScore: 100000 };

const GRADE_YEARS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];
const EXAM_TYPES = {
  midterm: { label: "중간고사", short: "중간", order: 1 },
  final: { label: "기말고사", short: "기말", order: 2 },
  other: { label: "기타", short: "기타", order: 3 },
};

const VIEW_META = {
  dashboard: { title: "대시보드", subtitle: "한눈에 보는 나의 성적 현황" },
  subjects: { title: "과목 관리", subtitle: "성적을 기록할 과목을 추가하고 관리하세요" },
  grades: { title: "성적 입력", subtitle: "시험 결과를 입력하면 백분율이 자동으로 계산돼요" },
  records: { title: "성적 기록", subtitle: "입력한 모든 시험 기록을 확인하고 수정하세요" },
};

/* =========================================================
   DOM references
   ========================================================= */
const $ = (id) => document.getElementById(id);

const DOM = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  pageTitle: $("page-title"),
  pageSubtitle: $("page-subtitle"),
  headerAction: $("header-action"),
  toast: $("toast"),

  dashboardEmpty: $("dashboard-empty"),
  statSubjects: $("stat-subjects"),
  statExams: $("stat-exams"),
  statAverage: $("stat-average"),
  statHighest: $("stat-highest"),
  statHighestName: $("stat-highest-name"),
  statLowest: $("stat-lowest"),
  statLowestName: $("stat-lowest-name"),

  barCanvas: $("bar-chart"),
  barWrapper: $("bar-chart-wrapper"),
  barEmpty: $("bar-chart-empty"),
  lineCanvas: $("line-chart"),
  lineWrapper: $("line-chart-wrapper"),
  lineEmpty: $("line-chart-empty"),
  lineFilter: $("line-subject-filter"),

  subjectForm: $("subject-form"),
  subjectFormTitle: $("subject-form-title"),
  subjectName: $("subject-name"),
  subjectError: $("subject-error"),
  subjectSubmit: $("subject-submit"),
  subjectCancel: $("subject-cancel"),
  subjectList: $("subject-list"),
  subjectEmpty: $("subject-empty"),
  subjectCountLabel: $("subject-count-label"),

  examForm: $("exam-form"),
  examFormTitle: $("exam-form-title"),
  examNoSubject: $("exam-no-subject"),
  examSubject: $("exam-subject"),
  examGradeYear: $("exam-grade-year"),
  examSemester: $("exam-semester"),
  examType: $("exam-type"),
  examName: $("exam-name"),
  examDate: $("exam-date"),
  examScore: $("exam-score"),
  examMax: $("exam-max"),
  examPercent: $("exam-percent"),
  examPercentBox: $("exam-percent-box"),
  examError: $("exam-error"),
  examSubmit: $("exam-submit"),
  examCancel: $("exam-cancel"),

  recordFilter: $("record-subject-filter"),
  recordTermFilter: $("record-term-filter"),
  recordTable: $("record-table"),
  recordTableWrapper: $("record-table-wrapper"),
  recordEmpty: $("record-empty"),
  recordCountLabel: $("record-count-label"),

  searchForm: $("search-form"),
  globalSearch: $("global-search"),
  recordSearchChip: $("record-search-chip"),
  recordSearchText: $("record-search-text"),
  recordSearchClear: $("record-search-clear"),

  exportCsv: $("export-csv"),
  resetData: $("reset-data"),
};

/* =========================================================
   Utilities
   ========================================================= */
const Utils = {
  createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  // Returns null for an empty list so callers never divide by zero.
  average(values) {
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  },

  round1(value) {
    return Math.round(value * 10) / 10;
  },

  formatPercent(value) {
    return value === null || !Number.isFinite(value) ? "-" : `${value.toFixed(1)}%`;
  },

  formatNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  },

  parseNumber(raw) {
    const text = String(raw).trim();
    if (text === "") return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  },

  normalizeName(raw) {
    return String(raw).trim().replace(/\s+/g, " ");
  },

  today() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  },

  isValidDate(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  },

  isValidColor(color) {
    return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
  },

  // Swaps a color from the old palette for the matching one in the new palette.
  refreshColor(color) {
    const index = LEGACY_COLORS.indexOf(String(color).toLowerCase());
    return index === -1 ? color : SUBJECT_COLORS[index];
  },

  hexToRgba(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  },
};

/* =========================================================
   Academic period (grade year · semester · exam type)
   ========================================================= */
const Period = {
  // Records saved before this feature existed have no period and are shown as "미지정".
  isSet(exam) {
    return GRADE_YEARS.includes(exam.gradeYear) && SEMESTERS.includes(exam.semester) && Boolean(EXAM_TYPES[exam.examType]);
  },

  termKey(exam) {
    return Period.isSet(exam) ? `${exam.gradeYear}-${exam.semester}` : "unset";
  },

  termLabel(exam) {
    return Period.isSet(exam) ? `${exam.gradeYear}학년 ${exam.semester}학기` : "학기 미지정";
  },

  label(exam) {
    return Period.isSet(exam) ? `${Period.termLabel(exam)} ${EXAM_TYPES[exam.examType].label}` : "학기 미지정";
  },

  shortLabel(exam) {
    return Period.isSet(exam) ? `${exam.gradeYear}-${exam.semester} ${EXAM_TYPES[exam.examType].short}` : "미지정";
  },

  sortValue(exam) {
    if (!Period.isSet(exam)) return Number.MAX_SAFE_INTEGER;
    return exam.gradeYear * 100 + exam.semester * 10 + EXAM_TYPES[exam.examType].order;
  },

  compareAsc(a, b) {
    return Period.sortValue(a) - Period.sortValue(b) || a.date.localeCompare(b.date) || a.name.localeCompare(b.name);
  },

  compareDesc(a, b) {
    const setDiff = Number(Period.isSet(b)) - Number(Period.isSet(a));
    return setDiff || Period.compareAsc(b, a);
  },
};

/* =========================================================
   Storage (LocalStorage)
   ========================================================= */
const Storage = {
  empty() {
    return { subjects: [], exams: [] };
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Storage.empty();
      return Storage.sanitize(JSON.parse(raw));
    } catch (error) {
      console.warn("저장된 데이터를 읽지 못했습니다.", error);
      return Storage.empty();
    }
  },

  // Drops malformed records so a corrupted save can't break the app.
  sanitize(data) {
    const rawSubjects = Array.isArray(data?.subjects) ? data.subjects : [];
    const rawExams = Array.isArray(data?.exams) ? data.exams : [];

    const subjects = rawSubjects
      .filter((s) => s && typeof s.id === "string" && typeof s.name === "string" && s.name.trim())
      .map((s, index) => ({
        id: s.id,
        name: s.name.trim().slice(0, LIMITS.subjectName),
        color: Utils.isValidColor(s.color) ? Utils.refreshColor(s.color) : SUBJECT_COLORS[index % SUBJECT_COLORS.length],
      }));

    const subjectIds = new Set(subjects.map((s) => s.id));

    const exams = rawExams
      .filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          subjectIds.has(e.subjectId) &&
          typeof e.name === "string" &&
          Utils.isValidDate(e.date) &&
          Number.isFinite(e.score) &&
          Number.isFinite(e.maxScore) &&
          e.maxScore > 0 &&
          e.score >= 0 &&
          e.score <= e.maxScore
      )
      .map((e) => {
        const hasPeriod = Period.isSet(e);
        return {
          id: e.id,
          subjectId: e.subjectId,
          gradeYear: hasPeriod ? e.gradeYear : null,
          semester: hasPeriod ? e.semester : null,
          examType: hasPeriod ? e.examType : null,
          name: e.name,
          date: e.date,
          score: e.score,
          maxScore: e.maxScore,
        };
      });

    return { subjects, exams };
  },

  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error(error);
      Toast.show("브라우저 저장 공간 문제로 데이터를 저장하지 못했어요.", "error");
    }
  },
};

/* =========================================================
   State
   ========================================================= */
let state = Storage.empty();

const uiState = {
  view: "dashboard",
  editingSubjectId: null,
  editingExamId: null,
  lineFilter: "all",
  recordFilter: "all",
  recordTermFilter: "all",
  recordSearch: "",
};

/* =========================================================
   Data operations (every mutation goes through App.commit)
   ========================================================= */
const Data = {
  findSubject(id) {
    return state.subjects.find((subject) => subject.id === id) || null;
  },

  findExam(id) {
    return state.exams.find((exam) => exam.id === id) || null;
  },

  isDuplicateSubject(name, exceptId = null) {
    const key = name.toLowerCase();
    return state.subjects.some((s) => s.id !== exceptId && s.name.toLowerCase() === key);
  },

  nextColor() {
    const used = new Set(state.subjects.map((s) => s.color));
    return SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length];
  },

  addSubject(name) {
    state.subjects.push({ id: Utils.createId(), name, color: Data.nextColor() });
    App.commit();
  },

  updateSubject(id, name) {
    const subject = Data.findSubject(id);
    if (!subject) return;
    subject.name = name;
    App.commit();
  },

  deleteSubject(id) {
    state.subjects = state.subjects.filter((s) => s.id !== id);
    state.exams = state.exams.filter((e) => e.subjectId !== id);
    App.commit();
  },

  addExam(values) {
    state.exams.push({ id: Utils.createId(), ...values });
    App.commit();
  },

  updateExam(id, values) {
    const exam = Data.findExam(id);
    if (!exam) return;
    Object.assign(exam, values);
    App.commit();
  },

  deleteExam(id) {
    state.exams = state.exams.filter((e) => e.id !== id);
    App.commit();
  },

  resetAll() {
    state = Storage.empty();
    App.commit();
  },
};

/* =========================================================
   Statistics
   ========================================================= */
const Stats = {
  percentage(exam) {
    return exam.maxScore > 0 ? (exam.score / exam.maxScore) * 100 : 0;
  },

  examsOf(subjectId) {
    return state.exams.filter((exam) => exam.subjectId === subjectId);
  },

  subjectSummaries() {
    return state.subjects.map((subject) => {
      const percentages = Stats.examsOf(subject.id).map(Stats.percentage);
      return {
        subject,
        examCount: percentages.length,
        average: Utils.average(percentages),
      };
    });
  },

  overview() {
    const summaries = Stats.subjectSummaries();
    const graded = summaries.filter((s) => s.average !== null);
    const ranked = [...graded].sort((a, b) => b.average - a.average);

    return {
      summaries,
      graded,
      subjectCount: state.subjects.length,
      examCount: state.exams.length,
      overallAverage: Utils.average(state.exams.map(Stats.percentage)),
      highest: ranked[0] || null,
      lowest: ranked[ranked.length - 1] || null,
    };
  },
};

/* =========================================================
   Toast messages
   ========================================================= */
const Toast = {
  timer: null,

  show(message, type = "success") {
    DOM.toast.textContent = message;
    DOM.toast.className = `toast toast-${type} is-visible`;
    clearTimeout(Toast.timer);
    Toast.timer = setTimeout(() => DOM.toast.classList.remove("is-visible"), 2600);
  },
};

/* =========================================================
   Search (top search box → records)
   ========================================================= */
const Search = {
  // Matches subject name, exam name or period label ("2학년", "중간고사"), ignoring case and spaces.
  matches(exam, query) {
    if (query === "") return true;
    const subject = Data.findSubject(exam.subjectId);
    const haystack = [subject ? subject.name : "", exam.name, Period.label(exam), exam.date]
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, "");
    return query
      .toLowerCase()
      .split(" ")
      .every((word) => haystack.includes(word));
  },

  run(rawQuery) {
    uiState.recordSearch = Utils.normalizeName(rawQuery);
    if (uiState.view !== "records") Navigation.setView("records");
    Views.renderRecords();
  },

  clear() {
    DOM.globalSearch.value = "";
    uiState.recordSearch = "";
    Views.renderRecords();
  },
};

/* =========================================================
   Charts (Chart.js)
   ========================================================= */
const Charts = {
  bar: null,
  line: null,

  isAvailable() {
    return typeof window.Chart !== "undefined";
  },

  setupDefaults() {
    if (!Charts.isAvailable()) return;
    Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;
    Chart.defaults.font.size = 13;
    Chart.defaults.color = "#7a7e85";
  },

  tooltipStyle() {
    return {
      backgroundColor: "#2b2d31",
      padding: 12,
      cornerRadius: 10,
      boxPadding: 4,
      titleFont: { weight: "600" },
    };
  },

  percentAxis() {
    return {
      min: 0,
      max: 100,
      ticks: { stepSize: 20, callback: (value) => `${value}%` },
      grid: { color: "#f0f1f3" },
      border: { display: false },
    };
  },

  toggleEmpty(wrapper, emptyEl, isEmpty, message) {
    if (!emptyEl.dataset.defaultText) emptyEl.dataset.defaultText = emptyEl.textContent;
    emptyEl.textContent = message || emptyEl.dataset.defaultText;
    wrapper.classList.toggle("hidden", isEmpty);
    emptyEl.classList.toggle("hidden", !isEmpty);
  },

  destroy(key) {
    if (Charts[key]) {
      Charts[key].destroy();
      Charts[key] = null;
    }
  },

  // Charts are only drawn while the dashboard is visible so Chart.js can measure the canvas.
  render(overview) {
    if (uiState.view !== "dashboard") return;

    if (!Charts.isAvailable()) {
      const message = "그래프 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.";
      Charts.toggleEmpty(DOM.barWrapper, DOM.barEmpty, true, message);
      Charts.toggleEmpty(DOM.lineWrapper, DOM.lineEmpty, true, message);
      return;
    }

    Charts.renderBar(overview.graded);
    Charts.renderLine();
  },

  renderBar(graded) {
    Charts.destroy("bar");
    Charts.toggleEmpty(DOM.barWrapper, DOM.barEmpty, graded.length === 0);
    if (graded.length === 0) return;

    Charts.bar = new Chart(DOM.barCanvas, {
      type: "bar",
      data: {
        labels: graded.map((s) => s.subject.name),
        datasets: [
          {
            label: "평균",
            data: graded.map((s) => Utils.round1(s.average)),
            backgroundColor: graded.map((s) => Utils.hexToRgba(s.subject.color, 0.85)),
            hoverBackgroundColor: graded.map((s) => s.subject.color),
            borderRadius: 8,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...Charts.tooltipStyle(),
            callbacks: {
              label: (ctx) => {
                const summary = graded[ctx.dataIndex];
                return ` 평균 ${summary.average.toFixed(1)}% · 시험 ${summary.examCount}회`;
              },
            },
          },
        },
        scales: {
          y: Charts.percentAxis(),
          x: { grid: { display: false }, border: { display: false } },
        },
      },
    });
  },

  renderLine() {
    Charts.destroy("line");

    const filter = uiState.lineFilter;
    const subjects = state.subjects.filter(
      (s) => Stats.examsOf(s.id).length > 0 && (filter === "all" || s.id === filter)
    );
    Charts.toggleEmpty(DOM.lineWrapper, DOM.lineEmpty, subjects.length === 0);
    if (subjects.length === 0) return;

    const subjectIds = new Set(subjects.map((s) => s.id));
    const exams = state.exams.filter((e) => subjectIds.has(e.subjectId)).sort(Period.compareAsc);
    const labels = [...new Set(exams.map(Period.shortLabel))];
    const fullLabels = new Map(exams.map((e) => [Period.shortLabel(e), Period.label(e)]));

    const datasets = subjects.map((subject) => ({
      label: subject.name,
      data: Stats.examsOf(subject.id)
        .sort(Period.compareAsc)
        .map((exam) => ({
          x: Period.shortLabel(exam),
          y: Utils.round1(Stats.percentage(exam)),
          examName: exam.name,
          score: exam.score,
          maxScore: exam.maxScore,
        })),
      borderColor: subject.color,
      backgroundColor: subject.color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.3,
    }));

    if (filter !== "all") {
      const average = Utils.average(exams.map(Stats.percentage));
      datasets.push({
        label: "평균",
        data: labels.map((label) => ({ x: label, y: Utils.round1(average) })),
        borderColor: "#94a3b8",
        borderDash: [6, 6],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
      });
    }

    Charts.line = new Chart(DOM.lineCanvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16 },
          },
          tooltip: {
            ...Charts.tooltipStyle(),
            callbacks: {
              title: (items) => (items.length ? fullLabels.get(items[0].label) || items[0].label : ""),
              label: (ctx) => {
                const point = ctx.raw;
                if (!point.examName) return ` ${ctx.dataset.label}: ${point.y.toFixed(1)}%`;
                const score = `${Utils.formatNumber(point.score)}/${Utils.formatNumber(point.maxScore)}`;
                return ` ${ctx.dataset.label} · ${point.examName}: ${point.y.toFixed(1)}% (${score})`;
              },
            },
          },
        },
        scales: {
          y: Charts.percentAxis(),
          x: { grid: { display: false }, border: { display: false } },
        },
      },
    });
  },
};

/* =========================================================
   Views (rendering HTML)
   ========================================================= */
const Views = {
  renderAll(overview) {
    Views.renderOverview(overview);
    Views.renderSelects();
    Views.renderSubjectList(overview.summaries);
    Views.renderExamFormState();
    Views.renderRecords();
  },

  renderOverview(o) {
    DOM.statSubjects.textContent = o.subjectCount;
    DOM.statExams.textContent = o.examCount;
    DOM.statAverage.textContent = Utils.formatPercent(o.overallAverage);

    DOM.statHighest.textContent = o.highest ? Utils.formatPercent(o.highest.average) : "-";
    DOM.statHighestName.textContent = o.highest ? o.highest.subject.name : "데이터 없음";
    DOM.statLowest.textContent = o.lowest ? Utils.formatPercent(o.lowest.average) : "-";
    DOM.statLowestName.textContent = o.lowest ? o.lowest.subject.name : "데이터 없음";

    DOM.dashboardEmpty.classList.toggle("hidden", o.examCount > 0);
  },

  // Fills a <select> and returns the value that ended up selected.
  fillSelect(select, items, selected, allLabel) {
    const options = items.map(
      (item) => `<option value="${Utils.escapeHtml(item.value)}">${Utils.escapeHtml(item.label)}</option>`
    );
    const values = items.map((item) => item.value);

    if (allLabel) {
      options.unshift(`<option value="all">${allLabel}</option>`);
      values.unshift("all");
    }

    select.innerHTML = options.join("");
    const value = values.includes(selected) ? selected : values[0] ?? "";
    select.value = value;
    return value;
  },

  renderSelects() {
    const allSubjects = state.subjects.map((s) => ({ value: s.id, label: s.name }));
    const gradedSubjects = state.subjects
      .filter((s) => Stats.examsOf(s.id).length > 0)
      .map((s) => ({ value: s.id, label: s.name }));

    Views.fillSelect(DOM.examSubject, allSubjects, DOM.examSubject.value);
    uiState.lineFilter = Views.fillSelect(DOM.lineFilter, gradedSubjects, uiState.lineFilter, "전체 과목");
    uiState.recordFilter = Views.fillSelect(DOM.recordFilter, allSubjects, uiState.recordFilter, "전체 과목");

    const terms = new Map();
    [...state.exams].sort(Period.compareAsc).forEach((e) => terms.set(Period.termKey(e), Period.termLabel(e)));
    const termItems = [...terms].map(([value, label]) => ({ value, label }));
    uiState.recordTermFilter = Views.fillSelect(DOM.recordTermFilter, termItems, uiState.recordTermFilter, "전체 학기");

    DOM.lineFilter.disabled = gradedSubjects.length === 0;
    DOM.recordFilter.disabled = allSubjects.length === 0;
    DOM.recordTermFilter.disabled = termItems.length === 0;
  },

  renderSubjectList(summaries) {
    DOM.subjectCountLabel.textContent = `${summaries.length}개 과목`;
    DOM.subjectEmpty.classList.toggle("hidden", summaries.length > 0);

    DOM.subjectList.innerHTML = summaries
      .map(({ subject, examCount, average }) => {
        const name = Utils.escapeHtml(subject.name);
        const editing = uiState.editingSubjectId === subject.id ? " is-editing" : "";
        return `
          <li class="subject-item${editing}">
            <span class="subject-dot" style="background:${subject.color}"></span>
            <div class="subject-info">
              <p class="subject-name">${name}</p>
              <p class="subject-meta">시험 ${examCount}회 · 평균 ${Utils.formatPercent(average)}</p>
            </div>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-action="edit-subject" data-id="${subject.id}" aria-label="${name} 수정">수정</button>
              <button type="button" class="icon-btn icon-btn-danger" data-action="delete-subject" data-id="${subject.id}" aria-label="${name} 삭제">삭제</button>
            </div>
          </li>`;
      })
      .join("");
  },

  renderExamFormState() {
    const hasSubjects = state.subjects.length > 0;
    DOM.examNoSubject.classList.toggle("hidden", hasSubjects);
    DOM.examForm.classList.toggle("is-disabled", !hasSubjects);
    DOM.examSubmit.disabled = !hasSubjects;
  },

  renderRecords() {
    const subjectFilter = uiState.recordFilter;
    const termFilter = uiState.recordTermFilter;
    const search = uiState.recordSearch;
    const exams = state.exams
      .filter((e) => subjectFilter === "all" || e.subjectId === subjectFilter)
      .filter((e) => termFilter === "all" || Period.termKey(e) === termFilter)
      .filter((e) => Search.matches(e, search))
      .sort(Period.compareDesc);

    DOM.recordSearchChip.classList.toggle("hidden", search === "");
    DOM.recordSearchText.textContent = `'${search}'`;

    DOM.recordCountLabel.textContent = `${exams.length}건`;
    DOM.recordTableWrapper.classList.toggle("hidden", exams.length === 0);
    DOM.recordEmpty.classList.toggle("hidden", exams.length > 0);
    if (state.exams.length === 0) {
      DOM.recordEmpty.textContent = "아직 입력한 성적이 없어요. '성적 입력' 메뉴에서 첫 시험을 기록해 보세요.";
    } else if (search !== "") {
      DOM.recordEmpty.textContent = `'${search}'에 맞는 성적 기록이 없어요. 다른 검색어로 찾아보세요.`;
    } else {
      DOM.recordEmpty.textContent = "선택한 조건에 맞는 성적 기록이 없어요.";
    }

    DOM.recordTable.innerHTML = exams
      .map((exam) => {
        const subject = Data.findSubject(exam.subjectId);
        const percent = Stats.percentage(exam);
        const examName = Utils.escapeHtml(exam.name);
        return `
          <tr>
            <td>
              <span class="subject-badge">
                <span class="subject-dot" style="background:${subject.color}"></span>
                ${Utils.escapeHtml(subject.name)}
              </span>
            </td>
            <td><span class="term-badge${Period.isSet(exam) ? "" : " is-unset"}">${Period.label(exam)}</span></td>
            <td>${examName}</td>
            <td>${exam.date}</td>
            <td class="num">${Utils.formatNumber(exam.score)} / ${Utils.formatNumber(exam.maxScore)}</td>
            <td>
              <div class="percent-cell">
                <div class="progress"><div class="progress-bar" style="width:${percent}%;background:${subject.color}"></div></div>
                <span class="percent-text">${percent.toFixed(1)}%</span>
              </div>
            </td>
            <td>
              <div class="row-actions">
                <button type="button" class="icon-btn" data-action="edit-exam" data-id="${exam.id}" aria-label="${examName} 수정">수정</button>
                <button type="button" class="icon-btn icon-btn-danger" data-action="delete-exam" data-id="${exam.id}" aria-label="${examName} 삭제">삭제</button>
              </div>
            </td>
          </tr>`;
      })
      .join("");
  },
};

/* =========================================================
   Subject form
   ========================================================= */
const SubjectForm = {
  validate(name, exceptId) {
    if (name === "") return "과목명을 입력해 주세요.";
    if (name.length > LIMITS.subjectName) return `과목명은 ${LIMITS.subjectName}자 이내로 입력해 주세요.`;
    if (Data.isDuplicateSubject(name, exceptId)) return "이미 등록된 과목이에요.";
    return null;
  },

  handleSubmit(event) {
    event.preventDefault();
    const name = Utils.normalizeName(DOM.subjectName.value);
    const editingId = uiState.editingSubjectId;

    const error = SubjectForm.validate(name, editingId);
    if (error) {
      DOM.subjectError.textContent = error;
      DOM.subjectName.focus();
      return;
    }

    SubjectForm.reset();
    if (editingId) {
      Data.updateSubject(editingId, name);
      Toast.show("과목 이름을 수정했어요.");
    } else {
      Data.addSubject(name);
      Toast.show(`'${name}' 과목을 추가했어요.`);
    }
    DOM.subjectName.focus();
  },

  startEdit(id) {
    const subject = Data.findSubject(id);
    if (!subject) return;

    uiState.editingSubjectId = id;
    DOM.subjectName.value = subject.name;
    DOM.subjectFormTitle.textContent = "과목 수정";
    DOM.subjectSubmit.textContent = "변경 저장";
    DOM.subjectCancel.classList.remove("hidden");
    DOM.subjectError.textContent = "";
    Views.renderSubjectList(Stats.subjectSummaries());
    DOM.subjectName.focus();
    DOM.subjectName.select();
  },

  reset() {
    uiState.editingSubjectId = null;
    DOM.subjectForm.reset();
    DOM.subjectFormTitle.textContent = "새 과목 추가";
    DOM.subjectSubmit.textContent = "과목 추가";
    DOM.subjectCancel.classList.add("hidden");
    DOM.subjectError.textContent = "";
  },

  handleDelete(id) {
    const subject = Data.findSubject(id);
    if (!subject) return;

    const examCount = Stats.examsOf(id).length;
    const warning = examCount > 0 ? `\n이 과목의 시험 기록 ${examCount}건도 함께 삭제돼요.` : "";
    if (!confirm(`'${subject.name}' 과목을 삭제할까요?${warning}`)) return;

    if (uiState.editingSubjectId === id) SubjectForm.reset();
    const editingExam = Data.findExam(uiState.editingExamId);
    if (editingExam && editingExam.subjectId === id) ExamForm.reset();

    Data.deleteSubject(id);
    Toast.show(`'${subject.name}' 과목을 삭제했어요.`);
  },
};

/* =========================================================
   Exam form
   ========================================================= */
const ExamForm = {
  populatePeriodSelects() {
    Views.fillSelect(DOM.examGradeYear, GRADE_YEARS.map((y) => ({ value: String(y), label: `${y}학년` })), "1");
    Views.fillSelect(DOM.examSemester, SEMESTERS.map((s) => ({ value: String(s), label: `${s}학기` })), "1");
    Views.fillSelect(
      DOM.examType,
      Object.entries(EXAM_TYPES).map(([value, type]) => ({ value, label: type.label })),
      "midterm"
    );
  },

  readValues() {
    return {
      subjectId: DOM.examSubject.value,
      gradeYear: Number(DOM.examGradeYear.value),
      semester: Number(DOM.examSemester.value),
      examType: DOM.examType.value,
      name: Utils.normalizeName(DOM.examName.value),
      date: DOM.examDate.value,
      score: Utils.parseNumber(DOM.examScore.value),
      maxScore: Utils.parseNumber(DOM.examMax.value),
    };
  },

  validate(v) {
    if (!Data.findSubject(v.subjectId)) return { message: "과목을 선택해 주세요.", field: DOM.examSubject };
    if (!GRADE_YEARS.includes(v.gradeYear)) return { message: "학년을 선택해 주세요.", field: DOM.examGradeYear };
    if (!SEMESTERS.includes(v.semester)) return { message: "학기를 선택해 주세요.", field: DOM.examSemester };
    if (!EXAM_TYPES[v.examType]) return { message: "시험 구분을 선택해 주세요.", field: DOM.examType };
    if (ExamForm.isDuplicatePeriod(v)) {
      const subjectName = Data.findSubject(v.subjectId).name;
      return { message: `${subjectName} 과목의 ${Period.label(v)} 성적이 이미 있어요. 성적 기록에서 수정해 주세요.`, field: DOM.examType };
    }
    if (v.name.length > LIMITS.examName) return { message: `시험명은 ${LIMITS.examName}자 이내로 입력해 주세요.`, field: DOM.examName };
    if (!Utils.isValidDate(v.date)) return { message: "올바른 시험 날짜를 선택해 주세요.", field: DOM.examDate };
    if (v.score === null) return { message: "획득 점수를 숫자로 입력해 주세요.", field: DOM.examScore };
    if (v.maxScore === null) return { message: "만점을 숫자로 입력해 주세요.", field: DOM.examMax };
    if (v.maxScore <= 0) return { message: "만점은 0보다 커야 해요.", field: DOM.examMax };
    if (v.maxScore > LIMITS.maxScore) return { message: `만점은 ${LIMITS.maxScore.toLocaleString()} 이하로 입력해 주세요.`, field: DOM.examMax };
    if (v.score < 0) return { message: "획득 점수는 0 이상이어야 해요.", field: DOM.examScore };
    if (v.score > v.maxScore) return { message: "획득 점수는 만점보다 클 수 없어요.", field: DOM.examScore };
    return null;
  },

  // A subject can have only one midterm and one final per semester; "기타" may repeat.
  isDuplicatePeriod(v) {
    if (v.examType === "other") return false;
    return state.exams.some(
      (e) =>
        e.id !== uiState.editingExamId &&
        e.subjectId === v.subjectId &&
        e.gradeYear === v.gradeYear &&
        e.semester === v.semester &&
        e.examType === v.examType
    );
  },

  handleSubmit(event) {
    event.preventDefault();
    const values = ExamForm.readValues();
    const error = ExamForm.validate(values);

    if (error) {
      DOM.examError.textContent = error.message;
      error.field.focus();
      return;
    }

    if (values.name === "") values.name = Period.label(values);

    const editingId = uiState.editingExamId;
    const subjectName = Data.findSubject(values.subjectId).name;
    ExamForm.reset(values);

    if (editingId) {
      Data.updateExam(editingId, values);
      Toast.show("성적을 수정했어요.");
      Navigation.setView("records");
    } else {
      Data.addExam(values);
      Toast.show(`${subjectName} 성적을 저장했어요.`);
      DOM.examName.focus();
    }
  },

  updatePreview() {
    const score = Utils.parseNumber(DOM.examScore.value);
    const maxScore = Utils.parseNumber(DOM.examMax.value);

    if (score === null || maxScore === null || maxScore <= 0) {
      DOM.examPercent.textContent = "-";
      DOM.examPercentBox.classList.remove("is-invalid");
      return;
    }

    const percent = (score / maxScore) * 100;
    DOM.examPercent.textContent = `${percent.toFixed(1)}%`;
    DOM.examPercentBox.classList.toggle("is-invalid", score < 0 || score > maxScore);
  },

  startEdit(id) {
    const exam = Data.findExam(id);
    if (!exam) return;

    uiState.editingExamId = id;
    DOM.examSubject.value = exam.subjectId;
    if (Period.isSet(exam)) {
      DOM.examGradeYear.value = String(exam.gradeYear);
      DOM.examSemester.value = String(exam.semester);
      DOM.examType.value = exam.examType;
    }
    DOM.examName.value = exam.name;
    DOM.examDate.value = exam.date;
    DOM.examScore.value = exam.score;
    DOM.examMax.value = exam.maxScore;

    DOM.examFormTitle.textContent = "성적 수정";
    DOM.examSubmit.textContent = "변경 저장";
    DOM.examCancel.classList.remove("hidden");
    DOM.examError.textContent = "";
    ExamForm.updatePreview();

    Navigation.setView("grades");
    DOM.examName.focus();
  },

  // `keep` remembers the last subject, grade year and semester so consecutive entries are faster.
  reset(keep = null) {
    uiState.editingExamId = null;
    DOM.examForm.reset();
    if (keep && Data.findSubject(keep.subjectId)) DOM.examSubject.value = keep.subjectId;
    if (keep && GRADE_YEARS.includes(keep.gradeYear)) DOM.examGradeYear.value = String(keep.gradeYear);
    if (keep && SEMESTERS.includes(keep.semester)) DOM.examSemester.value = String(keep.semester);
    DOM.examDate.value = Utils.today();
    DOM.examMax.value = "100";

    DOM.examFormTitle.textContent = "시험 성적 입력";
    DOM.examSubmit.textContent = "성적 저장";
    DOM.examCancel.classList.add("hidden");
    DOM.examError.textContent = "";
    ExamForm.updatePreview();
  },

  handleDelete(id) {
    const exam = Data.findExam(id);
    if (!exam) return;
    if (!confirm(`'${exam.name}' 기록을 삭제할까요?`)) return;

    if (uiState.editingExamId === id) ExamForm.reset();
    Data.deleteExam(id);
    Toast.show("성적 기록을 삭제했어요.");
  },
};

/* =========================================================
   CSV export
   ========================================================= */
const Csv = {
  // Quotes special characters and neutralizes spreadsheet formulas.
  escapeCell(value) {
    let text = String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  },

  download() {
    if (state.exams.length === 0) {
      Toast.show("내보낼 성적 데이터가 없어요.", "info");
      return;
    }

    const header = ["과목", "학년", "학기", "시험 구분", "시험명", "날짜", "획득 점수", "만점", "환산 점수(%)"];
    const rows = [...state.exams].sort(Period.compareAsc).map((exam) => [
      Data.findSubject(exam.subjectId).name,
      exam.gradeYear ?? "",
      exam.semester ?? "",
      EXAM_TYPES[exam.examType]?.label ?? "",
      exam.name,
      exam.date,
      exam.score,
      exam.maxScore,
      Stats.percentage(exam).toFixed(1),
    ]);

    const csv = [header, ...rows].map((row) => row.map(Csv.escapeCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `grades-${Utils.today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    Toast.show(`성적 ${rows.length}건을 CSV로 내보냈어요.`);
  },
};

/* =========================================================
   Navigation
   ========================================================= */
const Navigation = {
  setView(view) {
    if (!VIEW_META[view]) return;
    uiState.view = view;

    DOM.views.forEach((section) => section.classList.toggle("is-active", section.id === `view-${view}`));
    DOM.navItems.forEach((item) => {
      const isActive = item.dataset.view === view;
      item.classList.toggle("is-active", isActive);
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    DOM.pageTitle.textContent = VIEW_META[view].title;
    DOM.pageSubtitle.textContent = VIEW_META[view].subtitle;
    DOM.headerAction.classList.toggle("hidden", view === "grades");

    if (view === "dashboard") Charts.render(Stats.overview());
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
};

/* =========================================================
   App
   ========================================================= */
const App = {
  init() {
    state = Storage.load();
    Charts.setupDefaults();
    ExamForm.populatePeriodSelects();
    App.bindEvents();
    App.refresh();
    ExamForm.reset();
    Navigation.setView("dashboard");

    // Canvas text does not re-render on its own once the web font finishes loading.
    document.fonts?.ready.then(() => Charts.render(Stats.overview()));
  },

  commit() {
    Storage.save(state);
    App.refresh();
  },

  refresh() {
    const overview = Stats.overview();
    Views.renderAll(overview);
    Charts.render(overview);
  },

  handleReset() {
    if (state.subjects.length === 0) {
      Toast.show("초기화할 데이터가 없어요.", "info");
      return;
    }
    if (!confirm("모든 과목과 성적 기록을 삭제할까요?\n이 작업은 되돌릴 수 없어요.")) return;

    SubjectForm.reset();
    ExamForm.reset();
    uiState.lineFilter = "all";
    uiState.recordFilter = "all";
    uiState.recordTermFilter = "all";
    uiState.recordSearch = "";
    DOM.globalSearch.value = "";
    Data.resetAll();
    Toast.show("모든 데이터를 초기화했어요.");
  },

  bindEvents() {
    DOM.navItems.forEach((item) => item.addEventListener("click", () => Navigation.setView(item.dataset.view)));

    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-goto]");
      if (target) Navigation.setView(target.dataset.goto);
    });

    DOM.subjectForm.addEventListener("submit", SubjectForm.handleSubmit);
    DOM.subjectCancel.addEventListener("click", () => {
      SubjectForm.reset();
      Views.renderSubjectList(Stats.subjectSummaries());
    });
    DOM.subjectList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      if (button.dataset.action === "edit-subject") SubjectForm.startEdit(button.dataset.id);
      if (button.dataset.action === "delete-subject") SubjectForm.handleDelete(button.dataset.id);
    });

    DOM.examForm.addEventListener("submit", ExamForm.handleSubmit);
    DOM.examCancel.addEventListener("click", () => ExamForm.reset());
    DOM.examScore.addEventListener("input", ExamForm.updatePreview);
    DOM.examMax.addEventListener("input", ExamForm.updatePreview);

    DOM.recordTable.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      if (button.dataset.action === "edit-exam") ExamForm.startEdit(button.dataset.id);
      if (button.dataset.action === "delete-exam") ExamForm.handleDelete(button.dataset.id);
    });

    DOM.lineFilter.addEventListener("change", () => {
      uiState.lineFilter = DOM.lineFilter.value;
      Charts.render(Stats.overview());
    });
    DOM.recordFilter.addEventListener("change", () => {
      uiState.recordFilter = DOM.recordFilter.value;
      Views.renderRecords();
    });
    DOM.recordTermFilter.addEventListener("change", () => {
      uiState.recordTermFilter = DOM.recordTermFilter.value;
      Views.renderRecords();
    });

    DOM.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      Search.run(DOM.globalSearch.value);
    });
    // On the records page, results update while typing.
    DOM.globalSearch.addEventListener("input", () => {
      if (uiState.view === "records" || DOM.globalSearch.value === "") {
        uiState.recordSearch = Utils.normalizeName(DOM.globalSearch.value);
        Views.renderRecords();
      }
    });
    DOM.recordSearchClear.addEventListener("click", Search.clear);

    DOM.exportCsv.addEventListener("click", Csv.download);
    DOM.resetData.addEventListener("click", App.handleReset);
  },
};

App.init();