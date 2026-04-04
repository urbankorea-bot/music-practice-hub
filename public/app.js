const socket = io();

const state = {
  currentUser: null,
  authToken: null,
  users: [],
  assignments: [],
  archivedAssignments: [],
  selectedScheduleDates: [],
  activeChatPartnerId: null,
  recorderByAssignment: new Map(),
  metronomeIntervalId: null,
  metronomeAudioCtx: null,
  metronomeCurrentBeat: 0,
  tunerAudioCtx: null,
  tunerStream: null,
  tunerAnalyser: null,
  tunerFrameId: null
};

const el = {
  authForm: document.getElementById('auth-form'),
  name: document.getElementById('name'),
  password: document.getElementById('password'),
  role: document.getElementById('role'),
  loginScreen: document.getElementById('login-screen'),
  appScreen: document.getElementById('app-screen'),
  loginError: document.getElementById('login-error'),
  signOutBtn: document.getElementById('sign-out-btn'),
  currentUser: document.getElementById('current-user'),
  teacherCodeLabel: document.getElementById('teacher-code-label'),
  teacherCode: document.getElementById('teacher-code'),
  setTeacherCodeLabel: document.getElementById('set-teacher-code-label'),
  setTeacherCode: document.getElementById('set-teacher-code'),
  teacherCodeDisplay: document.getElementById('teacher-code-display'),
  assignmentsPanel: document.getElementById('assignments-panel'),
  chatPanel: document.getElementById('chat-panel'),
  teacherPanel: document.getElementById('teacher-panel'),
  studentPanel: document.getElementById('student-panel'),
  assignmentForm: document.getElementById('assignment-form'),
  assignmentStudent: document.getElementById('assignment-student'),
  assignmentTitle: document.getElementById('assignment-title'),
  assignmentDescription: document.getElementById('assignment-description'),
  assignmentYoutube: document.getElementById('assignment-youtube'),
  assignmentDateInput: document.getElementById('assignment-date-input'),
  assignmentAddDate: document.getElementById('assignment-add-date'),
  assignmentSelectedDates: document.getElementById('assignment-selected-dates'),
  assignmentPracticeMode: document.getElementById('assignment-practice-mode'),
  assignmentPracticeTarget: document.getElementById('assignment-practice-target'),
  assignmentList: document.getElementById('assignment-list'),
  archiveList: document.getElementById('archive-list'),
  chatPartner: document.getElementById('chat-partner'),
  chatBox: document.getElementById('chat-box'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  metronomeBpm: document.getElementById('metronome-bpm'),
  metronomeBpmValue: document.getElementById('metronome-bpm-value'),
  metronomeBeats: document.getElementById('metronome-beats'),
  metronomeStart: document.getElementById('metronome-start'),
  metronomeStop: document.getElementById('metronome-stop'),
  metronomeStatus: document.getElementById('metronome-status'),
  tunerStart: document.getElementById('tuner-start'),
  tunerStop: document.getElementById('tuner-stop'),
  tunerStatus: document.getElementById('tuner-status'),
  tunerInstrument: document.getElementById('tuner-instrument'),
  tunerNote: document.getElementById('tuner-note'),
  tunerFrequency: document.getElementById('tuner-frequency'),
  tunerDetune: document.getElementById('tuner-detune'),
  tunerTarget: document.getElementById('tuner-target'),
  tunerNeedle: document.getElementById('tuner-needle')
};

const NOTE_OFFSETS = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
};

const INSTRUMENT_TARGETS = {
  'chromatic': [],
  'violin': ['G3', 'D4', 'A4', 'E5'],
  'viola': ['C3', 'G3', 'D4', 'A4'],
  'cello': ['C2', 'G2', 'D3', 'A3'],
  'double-bass': ['E1', 'A1', 'D2', 'G2'],
  'guitar': ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'bass-guitar': ['E1', 'A1', 'D2', 'G2'],
  'ukulele': ['G4', 'C4', 'E4', 'A4'],
  'banjo': ['G4', 'D3', 'G3', 'B3', 'D4'],
  'flute': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  'piccolo': ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'],
  'oboe': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'B4', 'C5'],
  'english-horn': ['E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
  'bassoon': ['Bb1', 'C2', 'D2', 'E2', 'F2', 'G2', 'A2'],
  'bb-clarinet': ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
  'eb-clarinet': ['F3', 'G3', 'A3', 'Bb3', 'C4', 'D4'],
  'bass-clarinet': ['D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3'],
  'soprano-sax': ['C#3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3'],
  'alto-sax': ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
  'tenor-sax': ['C#2', 'D2', 'E2', 'F#2', 'G2', 'A2', 'B2'],
  'bari-sax': ['D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3'],
  'trumpet': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4'],
  'french-horn': ['F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'E3', 'F3'],
  'trombone': ['Bb1', 'C2', 'D2', 'Eb2', 'F2', 'G2', 'A2', 'Bb2'],
  'euphonium': ['Bb1', 'C2', 'D2', 'Eb2', 'F2', 'G2', 'A2', 'Bb2'],
  'tuba': ['Bb0', 'C1', 'D1', 'Eb1', 'F1', 'G1', 'A1', 'Bb1'],
  'voice': ['C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5']
};

function toLocalTime(dateStr) {
  if (!dateStr) return '-';
  const s = String(dateStr);
  const d = new Date(s.includes('T') || s.includes('Z') ? s : s + 'Z');
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }
  const res = await fetch(path, {
    headers,
    cache: 'no-store',
    ...options
  });
  if (res.status === 401 && state.authToken) {
    state.currentUser = null;
    state.authToken = null;
    localStorage.removeItem('mph_session');
    renderSession();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function loadUsers() {
  if (state.currentUser && state.currentUser.role === 'teacher') {
    state.users = await api(`/api/users?teacherId=${state.currentUser.id}`);
  } else if (state.currentUser && state.currentUser.role === 'student' && state.currentUser.teacher_id) {
    state.users = await api(`/api/users?teacherId=${state.currentUser.teacher_id}`);
  } else {
    state.users = await api('/api/users');
  }
}

function partnerRole() {
  return state.currentUser?.role === 'teacher' ? 'student' : 'teacher';
}

function usersByRole(role) {
  return state.users.filter((u) => u.role === role);
}

function renderSession() {
  const user = state.currentUser;
  if (!user) {
    el.loginScreen.hidden = false;
    el.appScreen.hidden = true;
    el.currentUser.textContent = '';
    el.teacherCodeDisplay.hidden = true;
    return;
  }

  el.loginScreen.hidden = true;
  el.appScreen.hidden = false;

  el.currentUser.textContent = `${user.name} (${user.role})`;
  el.teacherPanel.hidden = user.role !== 'teacher';
  el.studentPanel.hidden = user.role !== 'student';
  el.assignmentsPanel.hidden = false;
  el.chatPanel.hidden = false;

  if (user.role === 'teacher' && user.teacher_code) {
    el.teacherCodeDisplay.hidden = false;
    el.teacherCodeDisplay.innerHTML = `<div>Your teacher code:</div><div class="teacher-code-value">${escapeHtml(user.teacher_code)}</div><div class="muted">Share this code with your students so they can join.</div>`;
  } else {
    el.teacherCodeDisplay.hidden = true;
  }

  if (user.role !== 'student') {
    stopMetronome();
    stopTuner();
  }
}

function renderTeacherStudentOptions() {
  if (!state.currentUser) return;
  const previousStudentId = el.assignmentStudent.value;
  const previousChatPartnerId = el.chatPartner.value;

  const students = usersByRole('student');
  el.assignmentStudent.innerHTML = students
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');
  if (students.length > 0) {
    const hasPreviousStudent = students.some((s) => String(s.id) === String(previousStudentId));
    el.assignmentStudent.value = hasPreviousStudent ? String(previousStudentId) : String(students[0].id);
  }

  const partners = usersByRole(partnerRole());
  el.chatPartner.innerHTML = partners
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');
  if (partners.length > 0) {
    const hasPreviousPartner = partners.some((p) => String(p.id) === String(previousChatPartnerId));
    el.chatPartner.value = hasPreviousPartner ? String(previousChatPartnerId) : String(partners[0].id);
  }

  if (state.currentUser.role === 'teacher') {
    syncTeacherChatWithSelectedStudent();
  }

  if (partners.length > 0) {
    state.activeChatPartnerId = Number(el.chatPartner.value || partners[0].id);
  }
}

function syncTeacherChatWithSelectedStudent() {
  if (!state.currentUser || state.currentUser.role !== 'teacher') return;
  const selectedStudentId = Number(el.assignmentStudent.value);
  if (!selectedStudentId) return;

  const chatHasStudent = Array.from(el.chatPartner.options).some(
    (option) => Number(option.value) === selectedStudentId
  );
  if (!chatHasStudent) return;

  el.chatPartner.value = String(selectedStudentId);
  state.activeChatPartnerId = selectedStudentId;
}

function refreshPracticeTargetOptions() {
  const unit = el.assignmentPracticeMode.value === 'times' ? 'times' : 'minutes';
  Array.from(el.assignmentPracticeTarget.options).forEach((opt) => {
    opt.textContent = `${opt.value} ${unit}`;
  });
}

function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizeScheduleDates(dates) {
  return Array.from(
    new Set((Array.isArray(dates) ? dates : []).map((dateText) => String(dateText || '').trim()))
  )
    .filter((dateText) => isIsoDateString(dateText))
    .sort();
}

function toUtcDate(dateText) {
  return new Date(`${dateText}T00:00:00.000Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function renderSelectedScheduleDates() {
  const scheduleDates = normalizeScheduleDates(state.selectedScheduleDates);
  state.selectedScheduleDates = scheduleDates;

  if (!el.assignmentSelectedDates) return;
  if (!scheduleDates.length) {
    el.assignmentSelectedDates.innerHTML = '<span class="muted">No dates selected.</span>';
    return;
  }

  el.assignmentSelectedDates.innerHTML = scheduleDates
    .map(
      (dateText) =>
        `<span class="selected-date-pill">
          <span>${formatTaskDateShort(dateText)}</span>
          <button type="button" data-remove-date="${dateText}" aria-label="Remove ${dateText}">x</button>
        </span>`
    )
    .join('');

  const removeButtons = el.assignmentSelectedDates.querySelectorAll('[data-remove-date]');
  removeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const removeDate = btn.getAttribute('data-remove-date');
      state.selectedScheduleDates = state.selectedScheduleDates.filter((dateText) => dateText !== removeDate);
      renderSelectedScheduleDates();
    });
  });
}

function setSelectedScheduleDates(dates) {
  state.selectedScheduleDates = normalizeScheduleDates(dates);
  renderSelectedScheduleDates();
}

function addSelectedScheduleDate() {
  const dateText = String(el.assignmentDateInput?.value || '').trim();
  if (!isIsoDateString(dateText)) {
    alert('Select a valid date first.');
    return;
  }
  state.selectedScheduleDates = normalizeScheduleDates([...state.selectedScheduleDates, dateText]);
  renderSelectedScheduleDates();
}

function getAssignmentScheduleDates(assignment) {
  const legacyDaily = String(assignment?.schedule_days || '') === 'Monday-Sunday (Daily)';

  if (assignment?.schedule_dates_json) {
    try {
      const parsed = JSON.parse(assignment.schedule_dates_json);
      const normalized = normalizeScheduleDates(parsed);
      if (normalized.length) {
        if (legacyDaily && normalized.length === 1) {
          const start = normalized[0];
          const end = toUtcDate(start);
          end.setUTCDate(end.getUTCDate() + 6);
          return [start, ...Array.from({ length: 6 }, (_v, idx) => {
            const date = toUtcDate(start);
            date.setUTCDate(date.getUTCDate() + idx + 1);
            return toIsoDate(date);
          })];
        }
        return normalized;
      }
    } catch (_error) {
      // Ignore bad legacy values.
    }
  }

  if (Array.isArray(assignment?.day_checks) && assignment.day_checks.length) {
    const fromChecks = normalizeScheduleDates(assignment.day_checks.map((check) => check.task_date));
    if (fromChecks.length) return fromChecks;
  }

  const start = assignment?.schedule_start_date;
  const end = assignment?.schedule_end_date;
  if (isIsoDateString(start) && isIsoDateString(end)) {
    if (start === end) return [start];
    const startUtc = toUtcDate(start);
    const endUtc = toUtcDate(end);
    const dates = [];
    const current = new Date(startUtc);
    while (current <= endUtc && dates.length < 366) {
      dates.push(toIsoDate(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    if (legacyDaily && dates.length === 1) {
      const fallbackEnd = toUtcDate(start);
      fallbackEnd.setUTCDate(fallbackEnd.getUTCDate() + 6);
      const expanded = [];
      const currentExpanded = toUtcDate(start);
      while (currentExpanded <= fallbackEnd) {
        expanded.push(toIsoDate(currentExpanded));
        currentExpanded.setUTCDate(currentExpanded.getUTCDate() + 1);
      }
      return expanded;
    }
    return dates;
  }
  if (isIsoDateString(start)) return [start];
  if (isIsoDateString(end)) return [end];

  const createdDate = assignment?.created_at ? String(assignment.created_at).slice(0, 10) : null;
  if (isIsoDateString(createdDate)) return [createdDate];
  return [];
}

function getRenderableDayChecks(assignment) {
  const existingChecks = Array.isArray(assignment?.day_checks) ? assignment.day_checks : [];
  const scheduleDates = getAssignmentScheduleDates(assignment);
  const checkByDate = new Map();

  for (const check of existingChecks) {
    if (!isIsoDateString(check?.task_date)) continue;
    checkByDate.set(String(check.task_date), check);
  }

  for (const taskDate of scheduleDates) {
    if (!checkByDate.has(taskDate)) {
      checkByDate.set(taskDate, {
        task_date: taskDate,
        completed: 0,
        completed_at: null
      });
    }
  }

  return Array.from(checkByDate.values()).sort((a, b) =>
    String(a.task_date).localeCompare(String(b.task_date))
  );
}

function formatScheduleLabel(assignment) {
  const scheduleDates = getAssignmentScheduleDates(assignment);
  if (!scheduleDates.length) {
    const fallback = assignment.created_at ? String(assignment.created_at).slice(0, 10) : null;
    return fallback || 'Not set';
  }
  if (scheduleDates.length === 1) return scheduleDates[0];

  const start = scheduleDates[0];
  const end = scheduleDates[scheduleDates.length - 1];
  const startUtc = new Date(`${start}T00:00:00.000Z`);
  const endUtc = new Date(`${end}T00:00:00.000Z`);
  const spanDays = Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1;
  const isConsecutive = spanDays === scheduleDates.length;

  if (isConsecutive) return `${start} to ${end}`;
  return `${scheduleDates.length} selected dates`;
}

function formatTaskDateShort(taskDate) {
  const date = new Date(`${taskDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return taskDate;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function updateMetronomeStatus(text) {
  el.metronomeStatus.textContent = text;
}

function getMetronomeIntervalMs() {
  const bpm = Number(el.metronomeBpm.value);
  return Math.round(60000 / bpm);
}

function playMetronomeClick(accented) {
  const ctx = state.metronomeAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
  state.metronomeAudioCtx = ctx;

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'square';
  oscillator.frequency.value = accented ? 1400 : 950;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.08);
}

function startMetronome() {
  if (!state.currentUser || state.currentUser.role !== 'student') return;
  if (state.metronomeIntervalId) return;

  const beatsPerBar = Number(el.metronomeBeats.value);
  state.metronomeCurrentBeat = 0;
  playMetronomeClick(true);
  state.metronomeCurrentBeat = 1;

  state.metronomeIntervalId = window.setInterval(() => {
    const isAccent = state.metronomeCurrentBeat % beatsPerBar === 0;
    playMetronomeClick(isAccent);
    state.metronomeCurrentBeat += 1;
  }, getMetronomeIntervalMs());

  el.metronomeStart.disabled = true;
  el.metronomeStop.disabled = false;
  updateMetronomeStatus(`Running at ${el.metronomeBpm.value} BPM`);
}

function stopMetronome() {
  if (state.metronomeIntervalId) {
    window.clearInterval(state.metronomeIntervalId);
    state.metronomeIntervalId = null;
  }
  state.metronomeCurrentBeat = 0;
  el.metronomeStart.disabled = false;
  el.metronomeStop.disabled = true;
  updateMetronomeStatus('Stopped');
}

function restartMetronomeIfRunning() {
  if (!state.metronomeIntervalId) return;
  stopMetronome();
  startMetronome();
}

function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i += 1) {
    const value = buffer[i];
    rms += value * value;
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;

  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const trimmedSize = trimmed.length;
  const correlations = new Array(trimmedSize).fill(0);

  for (let lag = 0; lag < trimmedSize; lag += 1) {
    for (let i = 0; i < trimmedSize - lag; i += 1) {
      correlations[lag] += trimmed[i] * trimmed[i + lag];
    }
  }

  let d = 0;
  while (d + 1 < trimmedSize && correlations[d] > correlations[d + 1]) d += 1;

  let maxPos = -1;
  let maxVal = -1;
  for (let i = d; i < trimmedSize; i += 1) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return -1;

  const x1 = correlations[maxPos - 1] || correlations[maxPos];
  const x2 = correlations[maxPos];
  const x3 = correlations[maxPos + 1] || correlations[maxPos];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a ? -b / (2 * a) : 0;
  const period = maxPos + shift;

  return sampleRate / period;
}

function noteToFrequency(note) {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!match) return null;
  const [, pitchClass, octaveText] = match;
  const semitone = NOTE_OFFSETS[pitchClass];
  if (semitone === undefined) return null;
  const octave = Number(octaveText);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

function getTunerNoteData(frequency) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteName = noteNames[((midi % 12) + 12) % 12];
  const noteFrequency = 440 * 2 ** ((midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(frequency / noteFrequency));
  return { noteName, cents };
}

function getClosestInstrumentTarget(frequency, instrumentId) {
  const targets = INSTRUMENT_TARGETS[instrumentId] || [];
  if (!targets.length) return null;

  let closest = null;
  let closestCents = Number.POSITIVE_INFINITY;
  for (const note of targets) {
    const targetFrequency = noteToFrequency(note);
    if (!targetFrequency) continue;
    const centsOff = Math.round(1200 * Math.log2(frequency / targetFrequency));
    if (Math.abs(centsOff) < Math.abs(closestCents)) {
      closestCents = centsOff;
      closest = { note, centsOff };
    }
  }
  return closest;
}

function getSelectedInstrumentLabel() {
  const selectedOption = el.tunerInstrument.options[el.tunerInstrument.selectedIndex];
  return selectedOption ? selectedOption.textContent : 'Chromatic (Any Instrument)';
}

function updateTunerUI(frequency) {
  if (frequency <= 0 || !Number.isFinite(frequency)) {
    el.tunerNote.textContent = '-';
    el.tunerFrequency.textContent = '-';
    el.tunerDetune.textContent = '-';
    el.tunerTarget.textContent = '-';
    el.tunerNeedle.style.left = '50%';
    return;
  }

  const { noteName, cents } = getTunerNoteData(frequency);
  const selectedInstrument = el.tunerInstrument.value || 'chromatic';
  const closestTarget = getClosestInstrumentTarget(frequency, selectedInstrument);
  const clamped = Math.max(-50, Math.min(50, cents));
  const position = ((clamped + 50) / 100) * 100;

  el.tunerNote.textContent = noteName;
  el.tunerFrequency.textContent = `${frequency.toFixed(1)} Hz`;
  if (cents === 0) {
    el.tunerDetune.textContent = 'In tune';
  } else {
    el.tunerDetune.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;
  }
  if (closestTarget) {
    el.tunerTarget.textContent = `${closestTarget.note} (${closestTarget.centsOff > 0 ? '+' : ''}${closestTarget.centsOff} cents)`;
  } else {
    el.tunerTarget.textContent = 'Any note';
  }
  el.tunerNeedle.style.left = `${position}%`;
}

function monitorPitch() {
  if (!state.tunerAnalyser || !state.tunerAudioCtx) return;

  const buffer = new Float32Array(state.tunerAnalyser.fftSize);
  state.tunerAnalyser.getFloatTimeDomainData(buffer);
  const frequency = autoCorrelate(buffer, state.tunerAudioCtx.sampleRate);

  if (frequency === -1) {
    el.tunerStatus.textContent = `Listening (${getSelectedInstrumentLabel()})... no stable pitch detected`;
    updateTunerUI(-1);
  } else {
    el.tunerStatus.textContent = `Listening (${getSelectedInstrumentLabel()})`;
    updateTunerUI(frequency);
  }

  state.tunerFrameId = requestAnimationFrame(monitorPitch);
}

async function startTuner() {
  if (!state.currentUser || state.currentUser.role !== 'student') return;
  if (state.tunerFrameId || state.tunerStream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    el.tunerStatus.textContent = 'Tuner not supported on this browser.';
    return;
  }

  try {
    state.tunerStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.tunerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = state.tunerAudioCtx.createMediaStreamSource(state.tunerStream);
    state.tunerAnalyser = state.tunerAudioCtx.createAnalyser();
    state.tunerAnalyser.fftSize = 2048;
    source.connect(state.tunerAnalyser);

    el.tunerStart.disabled = true;
    el.tunerStop.disabled = false;
    el.tunerStatus.textContent = `Listening (${getSelectedInstrumentLabel()})`;
    monitorPitch();
  } catch (_error) {
    el.tunerStatus.textContent = 'Microphone access denied or unavailable.';
  }
}

function stopTuner() {
  if (state.tunerFrameId) {
    cancelAnimationFrame(state.tunerFrameId);
    state.tunerFrameId = null;
  }
  if (state.tunerStream) {
    state.tunerStream.getTracks().forEach((track) => track.stop());
    state.tunerStream = null;
  }
  if (state.tunerAudioCtx) {
    state.tunerAudioCtx.close();
    state.tunerAudioCtx = null;
  }
  state.tunerAnalyser = null;
  el.tunerStart.disabled = false;
  el.tunerStop.disabled = true;
  el.tunerStatus.textContent = 'Stopped';
  updateTunerUI(-1);
}

function assignmentCard(assignment) {
  const canRecord =
    state.currentUser.role === 'student' &&
    Number(state.currentUser.id) === Number(assignment.student_id);

  const canFeedback =
    state.currentUser.role === 'teacher' && Number(state.currentUser.id) === Number(assignment.teacher_id);
  const canDelete = canFeedback;

  const recordingItems = assignment.recordings
    .map(
      (r) =>
        `<li>
          <div>${escapeHtml(r.original_name || 'Recording')} <span class="muted">(${toLocalTime(r.created_at)})</span></div>
          <audio controls src="${escapeHtml(r.file_path)}"></audio>
        </li>`
    )
    .join('');

  const feedbackItems = assignment.feedback
    .map(
      (f) =>
        `<li>
          <strong>${escapeHtml(f.teacher_name)}:</strong> ${escapeHtml(f.comment)}
          <span class="muted">(${toLocalTime(f.created_at)})</span>
        </li>`
    )
    .join('');

  const goalUnit = assignment.practice_mode === 'times' ? 'times' : 'minutes';
  const scheduleLabel = formatScheduleLabel(assignment);
  const dayChecks = getRenderableDayChecks(assignment);
  const completedDayCount = dayChecks.filter((check) => Number(check.completed) === 1).length;
  const totalDayCount = dayChecks.length;
  const canToggleDayChecks = canRecord;
  const dayCheckItems = dayChecks
    .map((check) => {
      const shortDay = formatTaskDateShort(check.task_date);
      const isDone = Number(check.completed) === 1;
      return `<div class="day-check-item ${isDone ? 'done' : ''}">
        <button
          type="button"
          class="checkmark-action-btn ${isDone ? 'done' : ''}"
          data-date-check="${assignment.id}"
          data-task-date="${check.task_date}"
          data-completed="${isDone ? '1' : '0'}"
          aria-pressed="${isDone ? 'true' : 'false'}"
          aria-label="${isDone ? 'Uncheck' : 'Check'} ${shortDay}"
          title="${
            canToggleDayChecks
              ? isDone
                ? 'Click to uncheck'
                : 'Click to mark complete'
              : 'Visible to teacher. Student updates this check mark.'
          }"
          ${canToggleDayChecks ? '' : 'disabled'}
        >
          ${isDone ? '✓ Checked' : '✓ Check Mark'}
        </button>
        <span class="day-check-date">${shortDay}</span>
      </div>`;
    })
    .join('');

  return `
    <article class="assignment-card">
      <div>
        <strong>${escapeHtml(assignment.title)}</strong>
        <span class="badge ${assignment.status === 'completed' ? 'completed' : ''}">${escapeHtml(assignment.status)}</span>
      </div>
      <div class="muted">Teacher: ${escapeHtml(assignment.teacher_name)} | Student: ${escapeHtml(assignment.student_name)}</div>
      <div>${escapeHtml(assignment.description || '')}</div>
      <div class="muted">Schedule: ${scheduleLabel}</div>
      <div class="muted">Goal: ${assignment.practice_target || 10} ${goalUnit}</div>
      <div class="day-checks">
        <strong>Daily Check Marks</strong>
        ${canToggleDayChecks ? '<div class="muted">Click each date check mark button to update daily progress.</div>' : ''}
        <div class="muted">${completedDayCount}/${totalDayCount} day(s) completed</div>
        <div class="day-check-grid">
          ${dayCheckItems || '<span class="muted">No day tracking configured.</span>'}
        </div>
      </div>
      ${
        assignment.youtube_url
          ? `<a href="${escapeHtml(assignment.youtube_url)}" target="_blank" rel="noopener noreferrer">YouTube Reference</a>`
          : '<div class="muted">No YouTube reference provided.</div>'
      }
      <div>
        <strong>Recordings</strong>
        <ul class="recording-list">${recordingItems || '<li class="muted">No recordings yet.</li>'}</ul>
      </div>
      <div>
        <strong>Feedback</strong>
        <ul class="feedback-list">${feedbackItems || '<li class="muted">No feedback yet.</li>'}</ul>
      </div>

      ${
        canRecord
          ? `<form data-upload="${assignment.id}" class="stack">
              <input type="file" name="recording" accept="audio/*" />
              <button type="submit">Upload Recording</button>
            </form>
            <div class="stack">
              <div class="muted">Or record directly from your device microphone.</div>
              <div class="recorder-actions">
                <button type="button" data-record-start="${assignment.id}">Start Recording</button>
                <button type="button" data-record-stop="${assignment.id}" disabled>Stop</button>
                <button type="button" data-record-upload="${assignment.id}" disabled>Upload Clip</button>
              </div>
              <audio controls data-record-preview="${assignment.id}" hidden></audio>
              <div class="muted" data-record-status="${assignment.id}"></div>
            </div>`
          : ''
      }

      ${
        canFeedback
          ? `<form data-feedback="${assignment.id}" class="stack">
              <input type="text" name="comment" placeholder="Leave feedback" required />
              <button type="submit">Post Feedback</button>
            </form>`
          : ''
      }
      ${canDelete ? `<button type="button" class="danger-btn" data-delete-assignment="${assignment.id}">Archive Assignment</button>` : ''}
    </article>
  `;
}

function archiveCard(assignment) {
  const dayChecks = getRenderableDayChecks(assignment);
  const completedDayCount = dayChecks.filter((check) => Number(check.completed) === 1).length;
  const totalDayCount = dayChecks.length;
  const scheduleLabel = formatScheduleLabel(assignment);

  return `
    <article class="archive-card">
      <div>
        <strong>${escapeHtml(assignment.title)}</strong>
        <span class="badge completed">archived</span>
      </div>
      <div class="muted">Student: ${escapeHtml(assignment.student_name)}</div>
      <div class="muted">Schedule: ${scheduleLabel}</div>
      <div class="muted">Progress: ${completedDayCount}/${totalDayCount} day(s)</div>
      <div class="muted">Archived: ${toLocalTime(assignment.archived_at)}</div>
      <div class="archive-actions">
        <button type="button" data-restore-assignment="${assignment.id}">Revive Assignment</button>
        <button type="button" class="danger-btn" data-delete-archived-assignment="${assignment.id}">Delete Permanently</button>
      </div>
    </article>
  `;
}

function bindAssignmentActions() {
  async function uploadRecordingFile(assignmentId, file) {
    const fd = new FormData();
    fd.append('recording', file);
    fd.append('studentId', state.currentUser.id);

    const uploadHeaders = {};
    if (state.authToken) {
      uploadHeaders['Authorization'] = `Bearer ${state.authToken}`;
    }

    const res = await fetch(`/api/assignments/${assignmentId}/recordings`, {
      method: 'POST',
      headers: uploadHeaders,
      body: fd
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
  }

  const uploadForms = el.assignmentList.querySelectorAll('form[data-upload]');
  uploadForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const assignmentId = form.getAttribute('data-upload');
      const fileInput = form.querySelector('input[name="recording"]');
      if (!fileInput.files[0]) return;

      await uploadRecordingFile(assignmentId, fileInput.files[0]);

      fileInput.value = '';
      await loadAssignments();
    });
  });

  const startButtons = el.assignmentList.querySelectorAll('[data-record-start]');
  startButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const assignmentId = btn.getAttribute('data-record-start');
      const stopBtn = el.assignmentList.querySelector(`[data-record-stop="${assignmentId}"]`);
      const uploadBtn = el.assignmentList.querySelector(`[data-record-upload="${assignmentId}"]`);
      const preview = el.assignmentList.querySelector(`[data-record-preview="${assignmentId}"]`);
      const status = el.assignmentList.querySelector(`[data-record-status="${assignmentId}"]`);

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        status.textContent = 'Direct recording is not supported on this browser.';
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const previewUrl = URL.createObjectURL(blob);
          preview.src = previewUrl;
          preview.hidden = false;
          uploadBtn.disabled = false;
          status.textContent = 'Recording ready. Click Upload Clip.';

          const recordState = state.recorderByAssignment.get(String(assignmentId)) || {};
          state.recorderByAssignment.set(String(assignmentId), { ...recordState, blob, previewUrl });

          stream.getTracks().forEach((t) => t.stop());
        };

        recorder.start();
        state.recorderByAssignment.set(String(assignmentId), { stream, recorder, chunks, blob: null, previewUrl: null });
        btn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = 'Recording...';
      } catch (_error) {
        status.textContent = 'Microphone access was denied or unavailable.';
      }
    });
  });

  const stopButtons = el.assignmentList.querySelectorAll('[data-record-stop]');
  stopButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const assignmentId = btn.getAttribute('data-record-stop');
      const startBtn = el.assignmentList.querySelector(`[data-record-start="${assignmentId}"]`);
      const stateForAssignment = state.recorderByAssignment.get(String(assignmentId));
      if (!stateForAssignment?.recorder) return;

      if (stateForAssignment.recorder.state !== 'inactive') {
        stateForAssignment.recorder.stop();
      }

      btn.disabled = true;
      startBtn.disabled = false;
    });
  });

  const uploadButtons = el.assignmentList.querySelectorAll('[data-record-upload]');
  uploadButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const assignmentId = btn.getAttribute('data-record-upload');
      const status = el.assignmentList.querySelector(`[data-record-status="${assignmentId}"]`);
      const stateForAssignment = state.recorderByAssignment.get(String(assignmentId));
      if (!stateForAssignment?.blob) return;

      try {
        const file = new File([stateForAssignment.blob], `recording_${Date.now()}.webm`, {
          type: stateForAssignment.blob.type || 'audio/webm'
        });
        await uploadRecordingFile(assignmentId, file);
        if (stateForAssignment.previewUrl) URL.revokeObjectURL(stateForAssignment.previewUrl);
        state.recorderByAssignment.delete(String(assignmentId));
        await loadAssignments();
      } catch (_error) {
        status.textContent = 'Upload failed. Please try again.';
      }
    });
  });

  const dayCheckButtons = el.assignmentList.querySelectorAll('button[data-date-check]');
  dayCheckButtons.forEach((button) => {
    if (button.disabled) return;
    button.addEventListener('click', async () => {
      const assignmentId = button.getAttribute('data-date-check');
      const taskDate = button.getAttribute('data-task-date');
      const currentCompleted = button.getAttribute('data-completed') === '1';
      const completed = !currentCompleted;

      try {
        await api(`/api/assignments/${assignmentId}/date-check`, {
          method: 'PATCH',
          body: JSON.stringify({
            studentId: state.currentUser.id,
            taskDate,
            completed
          })
        });
        await loadAssignments();
      } catch (_error) {}
    });
  });

  const deleteButtons = el.assignmentList.querySelectorAll('[data-delete-assignment]');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!state.currentUser || state.currentUser.role !== 'teacher') return;
      const assignmentId = btn.getAttribute('data-delete-assignment');
      const shouldArchive = window.confirm('Move this assignment to archives?');
      if (!shouldArchive) return;

      await api(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
        body: JSON.stringify({
          teacherId: state.currentUser.id
        })
      });
      await loadAssignments();
    });
  });

  const feedbackForms = el.assignmentList.querySelectorAll('form[data-feedback]');
  feedbackForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const assignmentId = form.getAttribute('data-feedback');
      const commentInput = form.querySelector('input[name="comment"]');
      const comment = commentInput.value.trim();
      if (!comment) return;

      await api(`/api/assignments/${assignmentId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ teacherId: state.currentUser.id, comment })
      });

      commentInput.value = '';
      await loadAssignments();
    });
  });
}

async function loadAssignments() {
  if (!state.currentUser) return;

  let query = '';
  if (state.currentUser.role === 'teacher') {
    query = `teacherId=${state.currentUser.id}`;
    const selectedStudentId = Number(el.assignmentStudent.value);
    if (selectedStudentId) {
      query += `&studentId=${selectedStudentId}`;
    }
  } else {
    query = `studentId=${state.currentUser.id}`;
  }

  state.assignments = await api(`/api/assignments?${query}`);
  el.assignmentList.innerHTML = state.assignments.map(assignmentCard).join('') || '<p class="muted">No assignments yet.</p>';
  bindAssignmentActions();
  if (state.currentUser.role === 'teacher') {
    await loadArchives();
  }
}

async function loadArchives() {
  if (!el.archiveList) return;
  if (!state.currentUser || state.currentUser.role !== 'teacher') {
    el.archiveList.innerHTML = '';
    return;
  }

  let query = `teacherId=${state.currentUser.id}`;
  const selectedStudentId = Number(el.assignmentStudent.value);
  if (selectedStudentId) {
    query += `&studentId=${selectedStudentId}`;
  }

  state.archivedAssignments = await api(`/api/assignments/archived?${query}`);
  el.archiveList.innerHTML =
    state.archivedAssignments.map(archiveCard).join('') || '<p class="muted">No archived assignments.</p>';
  bindArchiveActions();
}

function bindArchiveActions() {
  if (!el.archiveList || !state.currentUser || state.currentUser.role !== 'teacher') return;
  const restoreButtons = el.archiveList.querySelectorAll('[data-restore-assignment]');
  restoreButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const assignmentId = btn.getAttribute('data-restore-assignment');
      const restored = await api(`/api/assignments/${assignmentId}/restore`, {
        method: 'PATCH',
        body: JSON.stringify({
          teacherId: state.currentUser.id
        })
      });
      const restoredStudentId = Number(restored?.studentId);
      if (restoredStudentId && el.assignmentStudent) {
        const matchingOption = Array.from(el.assignmentStudent.options).find(
          (option) => Number(option.value) === restoredStudentId
        );
        if (matchingOption) {
          el.assignmentStudent.value = String(restoredStudentId);
          syncTeacherChatWithSelectedStudent();
          await loadChat();
        }
      }
      await loadAssignments();
    });
  });

  const deleteButtons = el.archiveList.querySelectorAll('[data-delete-archived-assignment]');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const assignmentId = btn.getAttribute('data-delete-archived-assignment');
      const shouldDelete = window.confirm('Permanently delete this archived assignment? This cannot be undone.');
      if (!shouldDelete) return;

      await api(`/api/assignments/${assignmentId}/permanent`, {
        method: 'DELETE',
        body: JSON.stringify({
          teacherId: state.currentUser.id
        })
      });
      state.archivedAssignments = state.archivedAssignments.filter(
        (assignment) => Number(assignment.id) !== Number(assignmentId)
      );
      el.archiveList.innerHTML =
        state.archivedAssignments.map(archiveCard).join('') || '<p class="muted">No archived assignments.</p>';
      bindArchiveActions();
      await loadAssignments();
    });
  });
}

async function loadChat() {
  if (!state.currentUser || !state.activeChatPartnerId) {
    el.chatBox.innerHTML = '<p class="muted">Select a partner to start chatting.</p>';
    return;
  }

  const messages = await api(`/api/chat?userA=${state.currentUser.id}&userB=${state.activeChatPartnerId}`);
  el.chatBox.innerHTML = messages
    .map(
      (m) =>
        `<div class="chat-row"><strong>${escapeHtml(m.sender_name)}:</strong> ${escapeHtml(m.message)} <span class="muted">${toLocalTime(m.created_at)}</span></div>`
    )
    .join('');
  el.chatBox.scrollTop = el.chatBox.scrollHeight;
}

el.role.addEventListener('change', () => {
  const role = el.role.value;
  el.teacherCodeLabel.hidden = role !== 'student';
  el.setTeacherCodeLabel.hidden = role !== 'teacher';
});

el.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginError.hidden = true;
  const name = el.name.value.trim();
  const password = el.password.value;
  const role = el.role.value;
  const teacherCode = el.teacherCode.value.trim();
  if (!name || !password) return;

  try {
    const body = { name, role, password };
    if (role === 'student') body.teacherCode = teacherCode;
    if (role === 'teacher') body.setTeacherCode = el.setTeacherCode.value.trim();

    const userData = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    state.authToken = userData.token;
    state.currentUser = userData;
    el.password.value = '';
    el.teacherCode.value = '';
    el.setTeacherCode.value = '';

    localStorage.setItem('mph_session', JSON.stringify({ user: userData, token: userData.token }));

    socket.emit('user:online', state.currentUser.id);

    await loadUsers();
    renderSession();
    renderTeacherStudentOptions();
    await loadAssignments();
    await loadChat();
  } catch (error) {
    el.loginError.textContent = error.message || 'Sign-in failed';
    el.loginError.hidden = false;
  }
});

el.signOutBtn.addEventListener('click', () => {
  state.currentUser = null;
  state.authToken = null;
  state.users = [];
  state.assignments = [];
  state.archivedAssignments = [];
  localStorage.removeItem('mph_session');
  stopMetronome();
  stopTuner();
  renderSession();
});

el.assignmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentUser || state.currentUser.role !== 'teacher') return;
  const scheduleDates = normalizeScheduleDates(state.selectedScheduleDates);
  if (!scheduleDates.length) {
    alert('Configure at least one tracked practice day.');
    return;
  }

  await api('/api/assignments', {
    method: 'POST',
    body: JSON.stringify({
      title: el.assignmentTitle.value,
      description: el.assignmentDescription.value,
      youtubeUrl: el.assignmentYoutube.value,
      scheduleDates,
      scheduleStartDate: scheduleDates[0],
      scheduleEndDate: scheduleDates[scheduleDates.length - 1],
      practiceMode: el.assignmentPracticeMode.value,
      practiceTarget: Number(el.assignmentPracticeTarget.value),
      teacherId: state.currentUser.id,
      studentId: Number(el.assignmentStudent.value)
    })
  });

  el.assignmentTitle.value = '';
  el.assignmentDescription.value = '';
  el.assignmentYoutube.value = '';
  const today = new Date().toISOString().slice(0, 10);
  if (el.assignmentDateInput) el.assignmentDateInput.value = today;
  setSelectedScheduleDates([today]);
  el.assignmentPracticeMode.value = 'minutes';
  el.assignmentPracticeTarget.value = '10';
  refreshPracticeTargetOptions();

  await loadAssignments();
});

el.assignmentPracticeMode.addEventListener('change', () => {
  refreshPracticeTargetOptions();
});

el.assignmentAddDate.addEventListener('click', (e) => {
  e.preventDefault();
  addSelectedScheduleDate();
});

el.assignmentDateInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  addSelectedScheduleDate();
});

el.assignmentStudent.addEventListener('change', async () => {
  if (!state.currentUser || state.currentUser.role !== 'teacher') return;
  syncTeacherChatWithSelectedStudent();
  await Promise.all([loadAssignments(), loadChat()]);
});

el.chatPartner.addEventListener('change', async () => {
  state.activeChatPartnerId = Number(el.chatPartner.value);
  await loadChat();
});

el.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentUser || !state.activeChatPartnerId) return;
  const message = el.chatInput.value.trim();
  if (!message) return;

  await api('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      senderId: state.currentUser.id,
      recipientId: state.activeChatPartnerId,
      message
    })
  });

  el.chatInput.value = '';
});

el.metronomeBpm.addEventListener('input', () => {
  el.metronomeBpmValue.textContent = el.metronomeBpm.value;
  restartMetronomeIfRunning();
});

el.metronomeBeats.addEventListener('change', () => {
  restartMetronomeIfRunning();
});

el.metronomeStart.addEventListener('click', () => {
  startMetronome();
});

el.metronomeStop.addEventListener('click', () => {
  stopMetronome();
});

el.tunerStart.addEventListener('click', async () => {
  await startTuner();
});

el.tunerStop.addEventListener('click', () => {
  stopTuner();
});

el.tunerInstrument.addEventListener('change', () => {
  if (state.tunerFrameId) {
    el.tunerStatus.textContent = `Listening (${getSelectedInstrumentLabel()})`;
  }
  updateTunerUI(-1);
});

socket.on('chat:new', async () => {
  await loadChat();
});

socket.on('assignment:new', async () => {
  await loadAssignments();
  alert('New assignment received.');
});

socket.on('assignment:completed', async (payload) => {
  await loadAssignments();
  alert(`Assignment completed: ${payload.title}`);
});

socket.on('assignment:status-updated', async () => {
  await loadAssignments();
});

socket.on('assignment:date-check-updated', async () => {
  await loadAssignments();
});

socket.on('assignment:deleted', async () => {
  await loadAssignments();
});

socket.on('assignment:restored', async (payload) => {
  if (state.currentUser?.role === 'teacher') {
    const restoredStudentId = Number(payload?.studentId);
    if (restoredStudentId && el.assignmentStudent) {
      const matchingOption = Array.from(el.assignmentStudent.options).find(
        (option) => Number(option.value) === restoredStudentId
      );
      if (matchingOption) {
        el.assignmentStudent.value = String(restoredStudentId);
        syncTeacherChatWithSelectedStudent();
        await loadChat();
      }
    }
  }
  await loadAssignments();
});

socket.on('assignment:purged', async () => {
  await loadAssignments();
});

socket.on('recording:new', async () => {
  await loadAssignments();
  alert('New recording uploaded.');
});

socket.on('feedback:new', async () => {
  await loadAssignments();
  alert('New feedback posted by your teacher.');
});

(async function init() {
  refreshPracticeTargetOptions();
  const today = new Date().toISOString().slice(0, 10);
  if (el.assignmentDateInput) el.assignmentDateInput.value = today;
  setSelectedScheduleDates([today]);

  // Ensure code fields match initial role selection
  el.teacherCodeLabel.hidden = el.role.value !== 'student';
  el.setTeacherCodeLabel.hidden = el.role.value !== 'teacher';

  // Restore saved session
  try {
    const saved = JSON.parse(localStorage.getItem('mph_session') || 'null');
    if (saved && saved.user && saved.token) {
      state.authToken = saved.token;
      state.currentUser = saved.user;
      socket.emit('user:online', state.currentUser.id);
      await loadUsers();
      renderSession();
      renderTeacherStudentOptions();
      await loadAssignments();
      await loadChat();
      return;
    }
  } catch (_e) {
    localStorage.removeItem('mph_session');
  }

  await loadUsers();
  renderSession();
})();
