# Abugida School Management System — Frontend



> Modern web interface for the Abugida School Management System (ASMS), a WithUnion product for managing school academic and administrative operations.



**Development Status:** 🚧 Active Development — approximately 55% complete  

**Version:** 0.1.0  

**Frontend:** HTML5 + CSS3 + JavaScript



---

███████████░░░░░░░░░ 55%



## 📌 Overview



The Abugida School Management System (ASMS) frontend provides the web-based interface for administrators, teachers, students, and parents to interact with the school management platform.



The frontend is designed as a modular dashboard-based application and communicates with the ASMS backend through a REST API.



The project is currently under active development. Features, layouts, components, and API integrations will continue to evolve as ASMS moves toward its first stable release.



---



## ✨ Current Modules



The current frontend includes interfaces for:



- Login

- Admin dashboard

- Parent dashboard

- Student management

- Student details

- Teacher management

- Academic years

- Attendance

- Grades

- Examination schedules

- Finance

- Timetable

- Documents

- Analytics

- Parent portal



Additional functionality and improvements are being developed continuously.



---



## 🏗️ Frontend Architecture



The frontend currently follows a lightweight modular structure:



```text

Browser

   │

   ▼

HTML Pages

   │

   ├── CSS

   │

   └── JavaScript

          │

          ▼

       API Layer

          │

          ▼

ASMS Backend REST API

```

---

## ⚙️ Configuration — `assets/js/config.js`

`assets/js/config.js` is the **only** place the backend address is set. By default it points to the same hostname as the page, on port `3000`:

```js
API_BASE: `${window.location.protocol}//${window.location.hostname}:3000/api`
```

- Keep the page and the API on the **same hostname** (`localhost` with `localhost`, `127.0.0.1` with `127.0.0.1`). The refresh-token cookie is `SameSite=Strict`, so the browser does not send it between different hostnames, and users would be logged out every 15 minutes. Different ports are fine.
- For production, set `API_BASE` to the real API URL, e.g. `'https://api.myschool.et/api'`, and add the frontend's origin to the backend's `CORS_ORIGINS`.
- Serve the pages over HTTP (for example VS Code Live Server on port 5500). Opening the files directly from disk (`file://`) is not supported.

Every page loads the shared scripts in this order:

```html
<script src="assets/js/config.js"></script>
<script src="assets/js/escape.js"></script>
<script src="assets/js/api.js"></script>
```

- `escape.js` provides `escapeHtml()`. Wrap every API value placed into `innerHTML` with it; inside inline handlers use `escapeHtml(JSON.stringify(value))`.
- `api.js` adds the access token to requests, refreshes it automatically on `401` (one shared refresh for parallel requests), logs out only if the refresh fails, and offers `downloadFile()` for protected downloads. The parent portal sets `window.ASMS_SESSION = 'parent'` before loading it.
- Finance screens are admin-only; `api.js` hides finance links and elements marked `data-finance` for other roles.

---

## 🔑 Change Password Page — `change-password.html`

New teacher accounts get a one-time temporary password, shown once to the admin in a popup on the Teachers page (with a copy button). When a user who must change their password calls the API, `api.js` redirects them to `change-password.html`. After a successful change they return to the dashboard (or the parent portal) and other sessions are signed out.

---

## 🏫 Class Assignments Page — `teacher-assignments.html`

Admin-only screen, opened from **Teachers → 🏫 Class Assignments**. Choose a teacher, class and subject from dropdowns to assign, and use **Remove** in the table to unassign.

**Teachers can create exams and enter grades only for the class + subject pairs assigned here**, so assign every teacher before they start entering grades.
