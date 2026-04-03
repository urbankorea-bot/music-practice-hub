# Music Practice Hub

A full-stack app for music teachers and students to manage assignments, progress, recordings, feedback, and chat.

## Features
- Teacher/student sign-in includes password (first sign-in creates account, later sign-ins validate password).
- Teacher creates assignments for students.
- Assignment can include a YouTube reference link.
- Teacher dashboard assigns practice using selected dates only.
- Teacher sets practice goal as either minutes or times with targets: 5, 10, or 30.
- Student can check off completion for each assigned date.
- Assignment status is completed when all assigned dates are checked, and becomes assigned again if any date is unchecked.
- Teacher sees daily practice checkmarks update in real time.
- Teacher receives real-time completion notifications.
- Teacher can archive any assignment, and view archived assignments in the Archives section.
- Built-in real-time chat between teacher and student.
- Student uploads audio recording for an assignment.
- Student can either upload an existing audio file or record directly from device microphone.
- Student dashboard includes a built-in metronome and microphone tuner.
- Tuner includes instrument presets (chromatic, violin, guitar, ukulele, cello, bass, voice).
- Teacher listens and leaves written feedback/comments.

## Tech Stack
- Backend: Node.js, Express, Socket.IO, SQLite
- Frontend: Vanilla HTML/CSS/JS
- Storage: SQLite database (`music_hub.db`) and local uploaded files (`/uploads`)

## Run
1. Install dependencies:
```bash
npm install
```
2. Start server:
```bash
npm start
```
3. Open:
```text
http://localhost:3000
```

## Basic Usage
1. Open app in two browser tabs.
2. In tab 1, sign in as `Teacher`.
3. In tab 2, sign in as `Student`.
4. Teacher creates assignment and optionally adds YouTube link.
5. Student uploads recording + marks assignment complete.
6. Teacher gets notification and can leave feedback.
7. Use chat panel for live teacher-student messaging.

## Project Structure
- `server.js` - API + Socket.IO + SQLite setup
- `public/index.html` - UI markup
- `public/styles.css` - app styling
- `public/app.js` - client logic
- `uploads/` - stored recordings
- `music_hub.db` - SQLite database (auto-created at runtime)
