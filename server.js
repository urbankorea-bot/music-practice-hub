const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'music_hub.db');
const uploadsDir = path.join(__dirname, 'uploads');
const MAX_SCHEDULE_DAYS = 366;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function tryAlter(sql) {
  try { db.exec(sql); } catch (e) {
    if (!String(e.message || '').includes('duplicate column name')) console.error(e);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
    password TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
tryAlter("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    youtube_url TEXT,
    schedule_start_date TEXT,
    schedule_end_date TEXT,
    schedule_dates_json TEXT,
    schedule_days TEXT NOT NULL DEFAULT 'Monday-Sunday (Daily)',
    practice_mode TEXT NOT NULL DEFAULT 'minutes',
    practice_target INTEGER NOT NULL DEFAULT 10,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0,1)),
    archived_at DATETIME,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  )
`);
tryAlter("ALTER TABLE assignments ADD COLUMN schedule_days TEXT NOT NULL DEFAULT 'Monday-Sunday (Daily)'");
tryAlter('ALTER TABLE assignments ADD COLUMN schedule_start_date TEXT');
tryAlter('ALTER TABLE assignments ADD COLUMN schedule_end_date TEXT');
tryAlter('ALTER TABLE assignments ADD COLUMN schedule_dates_json TEXT');
tryAlter("ALTER TABLE assignments ADD COLUMN practice_mode TEXT NOT NULL DEFAULT 'minutes'");
tryAlter("ALTER TABLE assignments ADD COLUMN practice_target INTEGER NOT NULL DEFAULT 10");
tryAlter('ALTER TABLE assignments ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE assignments ADD COLUMN archived_at DATETIME');

db.exec(`
  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    original_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS assignment_daily_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    day_name TEXT NOT NULL CHECK(day_name IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
    completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assignment_id, day_name),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS assignment_date_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    task_date TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assignment_id, task_date),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    recording_id INTEGER,
    teacher_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (recording_id) REFERENCES recordings(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  )
`);

app.use(express.json());
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const onlineUsers = new Map();
const authTokens = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = authTokens.get(token);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.authUserId = userId;
  next();
}

function emitToUser(userId, event, payload) {
  const socketId = onlineUsers.get(String(userId));
  if (socketId) {
    io.to(socketId).emit(event, payload);
  }
}

function isIsoDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUtcDate(dateText) {
  return new Date(`${dateText}T00:00:00.000Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeScheduleDates(rawDates) {
  if (!Array.isArray(rawDates) || rawDates.length === 0) return null;
  const unique = new Set(
    rawDates.map((value) => String(value).trim()).filter((value) => isIsoDateString(value))
  );
  const sorted = Array.from(unique).sort();
  if (!sorted.length) return null;
  if (sorted.length > MAX_SCHEDULE_DAYS) return null;
  return sorted;
}

function parseScheduleDatesFromJson(rawJson) {
  if (!rawJson) return null;
  try {
    return normalizeScheduleDates(JSON.parse(rawJson));
  } catch (_error) {
    return null;
  }
}

function resolveScheduleRange(assignment) {
  const fallbackDate = assignment.created_at ? String(assignment.created_at).slice(0, 10) : null;
  const start = isIsoDateString(assignment.schedule_start_date)
    ? assignment.schedule_start_date
    : fallbackDate || toIsoDate(new Date());
  const end = isIsoDateString(assignment.schedule_end_date) ? assignment.schedule_end_date : start;
  return { start, end };
}

function getDatesInRange(startDate, endDate) {
  if (!isIsoDateString(startDate) || !isIsoDateString(endDate)) return [];
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  if (end < start) return [];
  const dates = [];
  const current = new Date(start);
  while (current <= end && dates.length < MAX_SCHEDULE_DAYS) {
    dates.push(toIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function expandLegacyDailyDates(scheduleDates, assignment) {
  const legacyDaily = String(assignment?.schedule_days || '') === 'Monday-Sunday (Daily)';
  if (!legacyDaily || !Array.isArray(scheduleDates) || scheduleDates.length !== 1) {
    return scheduleDates;
  }
  const startDate = scheduleDates[0];
  if (!isIsoDateString(startDate)) return scheduleDates;
  const endDate = toUtcDate(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  return getDatesInRange(startDate, toIsoDate(endDate));
}

function getScheduleDatesForAssignment(assignment) {
  const fromJson = parseScheduleDatesFromJson(assignment.schedule_dates_json);
  if (fromJson && fromJson.length) return expandLegacyDailyDates(fromJson, assignment);
  const { start, end } = resolveScheduleRange(assignment);
  return expandLegacyDailyDates(getDatesInRange(start, end), assignment);
}

function sanitizeUser(user) {
  return { id: user.id, name: user.name, role: user.role, created_at: user.created_at };
}

function ensureDateChecksForAssignment(assignment) {
  const scheduleDates = getScheduleDatesForAssignment(assignment);
  const stmt = db.prepare('INSERT OR IGNORE INTO assignment_date_checks (assignment_id, task_date) VALUES (?, ?)');
  for (const dateText of scheduleDates) {
    stmt.run(assignment.id, dateText);
  }
}

// --- API Routes ---

app.get('/api/users', (_req, res) => {
  try {
    const users = db.prepare('SELECT id, name, role, created_at FROM users ORDER BY role, name').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, role, password } = req.body;
  if (!name || !role || !password) {
    return res.status(400).json({ error: 'Name, role and password are required' });
  }
  if (!['teacher', 'student'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  try {
    const existing = db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(name.trim(), role);
    if (existing) {
      if (!existing.password) {
        const hash = await bcrypt.hash(String(password), 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, existing.id);
        const updatedUser = db.prepare('SELECT id, name, role, created_at FROM users WHERE id = ?').get(existing.id);
        const token = generateToken();
        authTokens.set(token, updatedUser.id);
        return res.json({ ...updatedUser, token });
      }
      let passwordMatch = false;
      if (existing.password.startsWith('$2')) {
        passwordMatch = await bcrypt.compare(String(password), existing.password);
      } else {
        passwordMatch = existing.password === String(password);
        if (passwordMatch) {
          const hash = await bcrypt.hash(String(password), 10);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, existing.id);
        }
      }
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      const token = generateToken();
      authTokens.set(token, existing.id);
      return res.json({ ...sanitizeUser(existing), token });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const result = db.prepare('INSERT INTO users (name, role, password) VALUES (?, ?, ?)').run(name.trim(), role, hashedPassword);
    const user = db.prepare('SELECT id, name, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken();
    authTokens.set(token, user.id);
    res.status(201).json({ ...user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/assignments', requireAuth, (req, res) => {
  const { teacherId, studentId } = req.query;
  const filters = ['COALESCE(a.is_archived, 0) = 0'];
  const params = [];

  if (teacherId) { filters.push('a.teacher_id = ?'); params.push(teacherId); }
  if (studentId) { filters.push('a.student_id = ?'); params.push(studentId); }

  const where = `WHERE ${filters.join(' AND ')}`;

  try {
    const assignments = db.prepare(`
      SELECT a.*, t.name AS teacher_name, s.name AS student_name
      FROM assignments a
      JOIN users t ON t.id = a.teacher_id
      JOIN users s ON s.id = a.student_id
      ${where}
      ORDER BY a.created_at DESC
    `).all(...params);

    for (const assignment of assignments) {
      ensureDateChecksForAssignment(assignment);
      assignment.recordings = db.prepare('SELECT * FROM recordings WHERE assignment_id = ? ORDER BY created_at DESC').all(assignment.id);
      assignment.feedback = db.prepare(`
        SELECT f.*, u.name AS teacher_name
        FROM feedback f JOIN users u ON u.id = f.teacher_id
        WHERE f.assignment_id = ?
        ORDER BY f.created_at DESC
      `).all(assignment.id);
      assignment.day_checks = db.prepare(`
        SELECT task_date, completed, completed_at
        FROM assignment_date_checks
        WHERE assignment_id = ?
        ORDER BY task_date ASC
      `).all(assignment.id);
    }

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/assignments/archived', requireAuth, (req, res) => {
  const { teacherId, studentId } = req.query;
  if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

  const filters = ['COALESCE(a.is_archived, 0) = 1'];
  const params = [];
  if (teacherId) { filters.push('a.teacher_id = ?'); params.push(teacherId); }
  if (studentId) { filters.push('a.student_id = ?'); params.push(studentId); }

  const where = `WHERE ${filters.join(' AND ')}`;

  try {
    const assignments = db.prepare(`
      SELECT a.*, t.name AS teacher_name, s.name AS student_name
      FROM assignments a
      JOIN users t ON t.id = a.teacher_id
      JOIN users s ON s.id = a.student_id
      ${where}
      ORDER BY a.archived_at DESC, a.created_at DESC
    `).all(...params);

    for (const assignment of assignments) {
      assignment.day_checks = db.prepare(`
        SELECT task_date, completed, completed_at
        FROM assignment_date_checks WHERE assignment_id = ?
        ORDER BY task_date ASC
      `).all(assignment.id);
    }

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assignments', requireAuth, (req, res) => {
  const { title, description, youtubeUrl, scheduleDates, scheduleStartDate, scheduleEndDate, teacherId, studentId, practiceMode, practiceTarget } = req.body;
  if (!title || !teacherId || !studentId) {
    return res.status(400).json({ error: 'title, teacherId and studentId are required' });
  }

  let normalizedScheduleDates = normalizeScheduleDates(scheduleDates);
  if (!normalizedScheduleDates) {
    if (!isIsoDateString(scheduleStartDate) || !isIsoDateString(scheduleEndDate)) {
      return res.status(400).json({ error: 'Provide scheduleDates or valid scheduleStartDate/scheduleEndDate' });
    }
    if (toUtcDate(scheduleEndDate) < toUtcDate(scheduleStartDate)) {
      return res.status(400).json({ error: 'scheduleEndDate must be on or after scheduleStartDate' });
    }
    normalizedScheduleDates = getDatesInRange(scheduleStartDate, scheduleEndDate);
  }
  if (!normalizedScheduleDates.length) return res.status(400).json({ error: 'Schedule must include at least one date' });
  if (normalizedScheduleDates.length > MAX_SCHEDULE_DAYS) return res.status(400).json({ error: `Schedule cannot exceed ${MAX_SCHEDULE_DAYS} dates` });

  const normalizedStartDate = normalizedScheduleDates[0];
  const normalizedEndDate = normalizedScheduleDates[normalizedScheduleDates.length - 1];
  const fullSpanLength = getDatesInRange(normalizedStartDate, normalizedEndDate).length;
  const scheduleSummary = normalizedScheduleDates.length === 1
    ? normalizedStartDate
    : normalizedScheduleDates.length === fullSpanLength
      ? `${normalizedStartDate} to ${normalizedEndDate}`
      : `${normalizedScheduleDates.length} selected dates`;

  const normalizedMode = practiceMode === 'times' ? 'times' : 'minutes';
  const normalizedTarget = Number(practiceTarget);
  if (![5, 10, 30].includes(normalizedTarget)) return res.status(400).json({ error: 'practiceTarget must be one of: 5, 10, 30' });

  try {
    const result = db.prepare(`
      INSERT INTO assignments (title, description, youtube_url, schedule_start_date, schedule_end_date, schedule_dates_json, schedule_days, practice_mode, practice_target, teacher_id, student_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), description || '', youtubeUrl || '', normalizedStartDate, normalizedEndDate, JSON.stringify(normalizedScheduleDates), scheduleSummary, normalizedMode, normalizedTarget, teacherId, studentId);

    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(result.lastInsertRowid);
    ensureDateChecksForAssignment(assignment);
    emitToUser(studentId, 'assignment:new', { assignment });
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/assignments/:id/complete', requireAuth, (req, res) => {
  const assignmentId = req.params.id;
  const { studentId, completed } = req.body;

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.is_archived) === 1) return res.status(400).json({ error: 'Archived assignments cannot be updated' });
    if (Number(assignment.student_id) !== Number(studentId)) return res.status(403).json({ error: 'Only assigned student can update assignment completion' });

    const shouldComplete = completed === undefined ? true : Boolean(completed);
    const nextStatus = shouldComplete ? 'completed' : 'assigned';

    if (shouldComplete) {
      db.prepare("UPDATE assignments SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE id = ?").run(assignmentId);
    } else {
      db.prepare("UPDATE assignments SET status = 'assigned', completed_at = NULL WHERE id = ?").run(assignmentId);
    }

    const updated = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (assignment.status !== 'completed' && nextStatus === 'completed') {
      emitToUser(assignment.teacher_id, 'assignment:completed', { assignmentId: updated.id, title: updated.title, studentId: assignment.student_id });
    }
    const statusPayload = { assignmentId: updated.id, title: updated.title, status: updated.status, studentId: assignment.student_id };
    emitToUser(assignment.teacher_id, 'assignment:status-updated', statusPayload);
    emitToUser(assignment.student_id, 'assignment:status-updated', statusPayload);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/assignments/:id/date-check', requireAuth, (req, res) => {
  const assignmentId = req.params.id;
  const { studentId, taskDate, completed } = req.body;

  if (!studentId || !taskDate) return res.status(400).json({ error: 'studentId and taskDate are required' });
  if (!isIsoDateString(taskDate)) return res.status(400).json({ error: 'taskDate must be valid (YYYY-MM-DD)' });

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.is_archived) === 1) return res.status(400).json({ error: 'Archived assignments cannot be updated' });
    if (Number(assignment.student_id) !== Number(studentId)) return res.status(403).json({ error: 'Only assigned student can update daily checks' });
    const previousStatus = assignment.status;

    const scheduleDates = getScheduleDatesForAssignment(assignment);
    if (!scheduleDates.includes(String(taskDate))) return res.status(400).json({ error: 'Selected date is not part of this assignment schedule' });

    ensureDateChecksForAssignment(assignment);
    const isCompleted = completed ? 1 : 0;
    db.prepare('UPDATE assignment_date_checks SET completed = ?, completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE assignment_id = ? AND task_date = ?').run(isCompleted, isCompleted, assignmentId, taskDate);

    const updatedDayCheck = db.prepare('SELECT task_date, completed, completed_at FROM assignment_date_checks WHERE assignment_id = ? AND task_date = ?').get(assignmentId, taskDate);
    const completionStats = db.prepare('SELECT COUNT(*) AS total_dates, COALESCE(SUM(completed), 0) AS completed_dates FROM assignment_date_checks WHERE assignment_id = ?').get(assignmentId);

    const totalDates = Number(completionStats?.total_dates || 0);
    const completedDates = Number(completionStats?.completed_dates || 0);
    const allDatesCompleted = totalDates > 0 && completedDates === totalDates;

    if (allDatesCompleted) {
      db.prepare("UPDATE assignments SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE id = ?").run(assignmentId);
    } else {
      db.prepare("UPDATE assignments SET status = 'assigned', completed_at = NULL WHERE id = ?").run(assignmentId);
    }

    const updatedAssignment = db.prepare('SELECT id, title, status FROM assignments WHERE id = ?').get(assignmentId);

    if (previousStatus !== 'completed' && updatedAssignment?.status === 'completed') {
      emitToUser(assignment.teacher_id, 'assignment:completed', { assignmentId: updatedAssignment.id, title: updatedAssignment.title, studentId: assignment.student_id });
    }

    const statusPayload = { assignmentId: Number(assignmentId), title: updatedAssignment?.title || assignment.title, status: updatedAssignment?.status || assignment.status, studentId: assignment.student_id };
    emitToUser(assignment.teacher_id, 'assignment:status-updated', statusPayload);
    emitToUser(assignment.student_id, 'assignment:status-updated', statusPayload);

    const payload = { assignmentId: Number(assignmentId), dayCheck: updatedDayCheck, assignmentStatus: updatedAssignment?.status || assignment.status };
    emitToUser(assignment.teacher_id, 'assignment:date-check-updated', payload);
    emitToUser(assignment.student_id, 'assignment:date-check-updated', payload);

    res.json(updatedDayCheck);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/assignments/:id', requireAuth, (req, res) => {
  const assignmentId = req.params.id;
  const { teacherId } = req.body || {};
  if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.teacher_id) !== Number(teacherId)) return res.status(403).json({ error: 'Only assignment teacher can archive this assignment' });
    if (Number(assignment.is_archived) === 1) return res.status(400).json({ error: 'Assignment is already archived' });

    db.prepare('UPDATE assignments SET is_archived = 1, archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(assignmentId);

    const payload = { assignmentId: Number(assignmentId), title: assignment.title, studentId: assignment.student_id };
    emitToUser(assignment.teacher_id, 'assignment:deleted', payload);
    emitToUser(assignment.student_id, 'assignment:deleted', payload);

    res.json({ ok: true, assignmentId: Number(assignmentId), archived: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/assignments/:id/restore', requireAuth, (req, res) => {
  const assignmentId = req.params.id;
  const { teacherId } = req.body || {};
  if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.teacher_id) !== Number(teacherId)) return res.status(403).json({ error: 'Only assignment teacher can restore this assignment' });
    if (Number(assignment.is_archived) !== 1) return res.status(400).json({ error: 'Assignment is not archived' });

    db.prepare('UPDATE assignments SET is_archived = 0, archived_at = NULL WHERE id = ?').run(assignmentId);

    const payload = { assignmentId: Number(assignmentId), title: assignment.title, studentId: assignment.student_id };
    emitToUser(assignment.teacher_id, 'assignment:restored', payload);
    emitToUser(assignment.student_id, 'assignment:restored', payload);

    res.json({ ok: true, assignmentId: Number(assignmentId), restored: true, studentId: Number(assignment.student_id), teacherId: Number(assignment.teacher_id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/assignments/:id/permanent', requireAuth, (req, res) => {
  const assignmentId = req.params.id;
  const { teacherId } = req.body || {};
  if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.teacher_id) !== Number(teacherId)) return res.status(403).json({ error: 'Only assignment teacher can permanently delete this assignment' });
    if (Number(assignment.is_archived) !== 1) return res.status(400).json({ error: 'Only archived assignments can be permanently deleted' });

    const recordings = db.prepare('SELECT file_path FROM recordings WHERE assignment_id = ?').all(assignmentId);

    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM feedback WHERE assignment_id = ?').run(assignmentId);
      db.prepare('DELETE FROM assignment_date_checks WHERE assignment_id = ?').run(assignmentId);
      db.prepare('DELETE FROM assignment_daily_checks WHERE assignment_id = ?').run(assignmentId);
      db.prepare('DELETE FROM recordings WHERE assignment_id = ?').run(assignmentId);
      db.prepare('DELETE FROM assignments WHERE id = ?').run(assignmentId);
    });
    deleteAll();

    recordings.forEach((recording) => {
      const fileName = path.basename(String(recording.file_path || ''));
      if (!fileName) return;
      fs.unlink(path.join(uploadsDir, fileName), () => {});
    });

    const payload = { assignmentId: Number(assignmentId), title: assignment.title, studentId: assignment.student_id };
    emitToUser(assignment.teacher_id, 'assignment:purged', payload);
    emitToUser(assignment.student_id, 'assignment:purged', payload);

    res.json({ ok: true, assignmentId: Number(assignmentId), deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assignments/:id/recordings', requireAuth, upload.single('recording'), (req, res) => {
  const assignmentId = req.params.id;
  const { studentId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Recording file is required' });

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.student_id) !== Number(studentId)) return res.status(403).json({ error: 'Only assigned student can upload recordings' });

    const filePath = `/uploads/${req.file.filename}`;
    const result = db.prepare('INSERT INTO recordings (assignment_id, student_id, file_path, original_name) VALUES (?, ?, ?, ?)').run(assignmentId, studentId, filePath, req.file.originalname);
    const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(result.lastInsertRowid);

    emitToUser(assignment.teacher_id, 'recording:new', { assignmentId: Number(assignmentId), recording });
    res.status(201).json(recording);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assignments/:id/feedback', requireAuth, (req, res) => {
  const assignmentId = req.params.id;
  const { teacherId, recordingId, comment } = req.body;
  if (!teacherId || !comment) return res.status(400).json({ error: 'teacherId and comment are required' });

  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (Number(assignment.teacher_id) !== Number(teacherId)) return res.status(403).json({ error: 'Only assignment teacher can leave feedback' });

    const result = db.prepare('INSERT INTO feedback (assignment_id, recording_id, teacher_id, comment) VALUES (?, ?, ?, ?)').run(assignmentId, recordingId || null, teacherId, comment.trim());
    const feedback = db.prepare('SELECT f.*, u.name AS teacher_name FROM feedback f JOIN users u ON u.id = f.teacher_id WHERE f.id = ?').get(result.lastInsertRowid);

    emitToUser(assignment.student_id, 'feedback:new', { assignmentId: Number(assignmentId), feedback });
    res.status(201).json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat', requireAuth, (req, res) => {
  const { userA, userB } = req.query;
  if (!userA || !userB) return res.status(400).json({ error: 'userA and userB are required' });

  try {
    const messages = db.prepare(`
      SELECT m.*, s.name AS sender_name
      FROM chat_messages m JOIN users s ON s.id = m.sender_id
      WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at ASC
    `).all(userA, userB, userB, userA);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', requireAuth, (req, res) => {
  const { senderId, recipientId, message } = req.body;
  if (!senderId || !recipientId || !message) return res.status(400).json({ error: 'senderId, recipientId and message are required' });

  try {
    const result = db.prepare('INSERT INTO chat_messages (sender_id, recipient_id, message) VALUES (?, ?, ?)').run(senderId, recipientId, message.trim());
    const savedMessage = db.prepare('SELECT m.*, s.name AS sender_name FROM chat_messages m JOIN users s ON s.id = m.sender_id WHERE m.id = ?').get(result.lastInsertRowid);

    emitToUser(recipientId, 'chat:new', savedMessage);
    emitToUser(senderId, 'chat:new', savedMessage);
    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  socket.on('user:online', (userId) => {
    if (!userId) return;
    onlineUsers.set(String(userId), socket.id);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Music Practice Hub running on http://localhost:${PORT}`);
});
