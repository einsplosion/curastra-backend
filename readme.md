# Curastra Backend

The REST API server for **Curastra** — an AI-powered personal health assistant. It manages user authentication, multi-profile family accounts, medical record storage, AI-generated care plans, medication tracking, vitals monitoring, lab report analysis, reminders with adherence logging, an AI health chat assistant, caregiver delegation, ABHA (Ayushman Bharat Health Account) enrollment, and emergency triage cards.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js (CommonJS) |
| **Framework** | Express.js v5 |
| **Database** | PostgreSQL (connection pooling via `pg`, SSL-enabled) |
| **Migrations** | node-pg-migrate |
| **File Storage** | Cloudinary (streamed uploads via `multer`) |
| **Authentication** | JWT access tokens (15 min) + SHA-256 hashed refresh tokens (30 days) |
| **Validation** | Joi (schema-based, request stripping) |
| **Security** | Helmet, CORS, bcrypt (12 rounds), express-rate-limit, BOLA/IDOR ownership middleware |
| **Logging** | Winston (structured JSON — error, audit, combined logs) + Morgan (HTTP request logging) |
| **AI Engine** | Communicates with an external Active Care Engine (ACE) microservice for OCR, care plan generation, lab analysis, medication safety checks, and conversational health chat |

---

## Project Structure

```
src/
├── config/           # Database pool, Cloudinary SDK, Winston logger
├── controllers/      # Request handlers — one per domain module
├── middlewares/       # Auth, ownership (BOLA), rate limiting, file upload, validation, audit logging
├── mockABHA/         # Mock ABHA enrollment flow for development (env-switchable)
├── routes/           # Express router definitions
├── services/         # Core business logic, database operations, ACE integration
├── utils/            # Token helpers, ACE HTTP client, chat pipeline (intent, safety, prompts), metric ranges
├── validations/      # Joi schemas for every endpoint
└── server.js         # Application entry point & middleware stack

migrations/           # node-pg-migrate migration files
logs/                 # Winston log output (error.log, audit.log, combined.log)
```

---

## Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** — a running instance (local or hosted, e.g. Neon)
- **Cloudinary** account — for document and image storage
- **ABDM Sandbox** credentials *(optional)* — for ABHA enrollment; set `ABHA_MODE=mock` to skip

---

## Getting Started

### 1. Clone & Install

```bash
git clone <repository-url>
cd curastra-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in the `.env` file with your values:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@host:port/database_name

# Authentication
JWT_SECRET=your_jwt_signing_secret_here

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# ABHA (set ABHA_MODE=mock for development without ABDM credentials)
ABHA_MODE=mock
ABDM_BASE_URL=https://dev.abdm.gov.in
ABDM_CLIENT_ID=...
ABDM_CLIENT_SECRET=...

# Active Care Engine
ACE_URL=http://localhost:8000
```

### 3. Initialize the Database

Run the migrations against your PostgreSQL instance:

```bash
npm run migrate
```

To roll back the last migration:

```bash
npm run migrate:down
```

### 4. Start the Server

**Development** (auto-reload with Nodemon):

```bash
npm run dev
```

**Production**:

```bash
npm start
```

The server will verify database connectivity and ACE service availability on startup.

---

## Database Schema

The application uses **14 tables** managed via node-pg-migrate. All primary keys are UUIDs.

| Table | Purpose |
|---|---|
| `users` | User accounts (email, hashed password) |
| `profiles` | Family member profiles (self, spouse, parent, child, sibling) with demographics, ABHA, allergies, onboarding status |
| `refresh_tokens` | SHA-256 hashed refresh tokens with expiry tracking |
| `records` | Uploaded medical documents (prescriptions, lab reports) stored in Cloudinary with OCR extracted text |
| `care_plans` | AI-generated care plans with medications, diet, lifestyle, symptoms to watch, follow-up appointments |
| `care_plan_tasks` | Actionable tasks within a care plan (medication, lifestyle, diet, symptom check, appointment) |
| `medications` | Active medications — sourced from care plans or manually added — with drug safety checks |
| `reminders` | Scheduled reminders (medication, appointment, lifestyle, exercise, etc.) with recurrence rules |
| `reminder_logs` | Adherence tracking logs (taken, missed, snoozed, completed, skipped) |
| `vitals` | Self-monitored health metrics (blood pressure, glucose, weight, temperature, heart rate, SpO₂) |
| `lab_results` | Extracted lab parameters with values, reference ranges, status flags, grouped into 11 clinical categories |
| `symptom_logs` | Logged symptoms with severity tracking |
| `chat_conversations` | AI chat sessions (general, care plan, lab report, medication, symptoms) |
| `chat_messages` | Message history (user + assistant) with context snapshots and safety flags |
| `caregiver_access` | Permission-based caregiver delegation for family profiles |

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require a `Bearer` token in the `Authorization` header. Multi-profile routes accept an optional `X-Profile-ID` header (defaults to the primary profile).

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Returns server status and timestamp |

---

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account (rate limited: 10/hr) |
| `POST` | `/auth/login` | — | Login & receive JWT tokens (rate limited: 10/15min on failures) |
| `POST` | `/auth/refresh` | — | Rotate access & refresh tokens (rate limited: 30/15min) |
| `POST` | `/auth/logout` | ✓ | Invalidate refresh token |
| `GET` | `/auth/me` | ✓ | Get current user & active profile |
| `PATCH` | `/auth/onboarding` | ✓ | Complete health onboarding (DOB, gender, blood group, height, weight, allergies) |

---

### Profiles — `/api/profiles`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/profiles` | ✓ | List all active family profiles |
| `GET` | `/profiles/active` | ✓ | Get currently active profile |
| `POST` | `/profiles` | ✓ | Create a family member profile |
| `GET` | `/profiles/:profileId` | ✓ | Get profile by ID |
| `PATCH` | `/profiles/:profileId` | ✓ | Update profile (ownership enforced) |
| `DELETE` | `/profiles/:profileId` | ✓ | Archive profile (primary profile protected) |
| `POST` | `/profiles/switch/:profileId` | ✓ | Switch active profile context |

---

### Medical Records — `/api/records`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/records/upload` | ✓ | Upload document (PDF/JPEG/PNG, max 10 MB) |
| `GET` | `/records` | ✓ | List records (filter: `?type=prescription\|lab_report`) |
| `GET` | `/records/:recordId` | ✓ | Get record details with lab results |
| `POST` | `/records/:recordId/extract` | ✓ | OCR text extraction via ACE |
| `POST` | `/records/:recordId/analyze-lab` | ✓ | AI lab report analysis & parameter extraction |
| `DELETE` | `/records/:recordId` | ✓ | Delete record from DB and Cloudinary |

---

### Lab Results — `/api/lab-results`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/lab-results/grouped` | ✓ | Lab parameters grouped by 11 clinical categories |

---

### Care Plans — `/api/care-plans`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/care-plans/generate` | ✓ | Generate AI care plan from verified text |
| `POST` | `/care-plans/simplify` | ✓ | Simplify clinical instructions to plain language |
| `GET` | `/care-plans` | ✓ | List care plans (filter: `?status=`) |
| `GET` | `/care-plans/:id` | ✓ | Get care plan with tasks & medications |
| `PATCH` | `/care-plans/:id/status` | ✓ | Update status (active / completed / archived) |
| `PATCH` | `/care-plans/:id/tasks/:taskId/complete` | ✓ | Toggle task completion & recalculate progress |
| `DELETE` | `/care-plans/:id` | ✓ | Delete care plan (cascades to tasks, medications, reminders) |

---

### Medications — `/api/medications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/medications` | ✓ | List medications (filter: `?care_plan_id=`, `?is_active=`) |
| `POST` | `/medications` | ✓ | Add medication (duplicate detection + AI drug interaction check) |
| `PATCH` | `/medications/:medicationId` | ✓ | Update medication (re-triggers safety check) |
| `PATCH` | `/medications/:medicationId/toggle` | ✓ | Toggle active status |
| `DELETE` | `/medications/:medicationId` | ✓ | Delete medication & linked reminders |

---

### Vitals / Metrics — `/api/vitals`

Supports 6 metric types: `blood_pressure`, `blood_glucose`, `weight`, `temperature`, `heart_rate`, `oxygen_saturation`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/vitals/summary` | ✓ | Dashboard cards with latest readings, status, and 7-day sparklines |
| `GET` | `/vitals/history/:type` | ✓ | Trend chart data & full history for a metric type |
| `POST` | `/vitals` | ✓ | Log a new reading (auto-evaluated against reference ranges) |
| `POST` | `/vitals/sync-from-lab` | ✓ | Convert a lab result into a tracked metric |
| `DELETE` | `/vitals/:id` | ✓ | Delete a reading |

> Alias: all vitals endpoints are also available under `/api/metrics`.

---

### Reminders — `/api/reminders`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/reminders` | ✓ | List reminders (filter: `?date=`, `?is_active=`, `?type=`) |
| `GET` | `/reminders/adherence` | ✓ | 7-day & 30-day adherence summary with per-medication breakdown |
| `POST` | `/reminders` | ✓ | Create a reminder (medication, appointment, lifestyle, exercise, etc.) |
| `PATCH` | `/reminders/:reminderId` | ✓ | Update reminder schedule & fields |
| `PATCH` | `/reminders/:reminderId/toggle` | ✓ | Toggle active state |
| `DELETE` | `/reminders/:reminderId` | ✓ | Delete reminder & adherence logs |
| `POST` | `/reminders/:reminderId/log` | ✓ | Log adherence (taken / missed / snoozed / completed / skipped) |

---

### AI Chat — `/api/chat`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/chat/conversations` | ✓ | Create a new conversation |
| `GET` | `/chat/conversations` | ✓ | List conversations with message previews |
| `GET` | `/chat/conversations/:id` | ✓ | Get conversation details |
| `DELETE` | `/chat/conversations/:id` | ✓ | Delete conversation & messages |
| `GET` | `/chat/conversations/:id/messages` | ✓ | Get message history |
| `POST` | `/chat/conversations/:id/messages` | ✓ | Send a message (rate limited: 15/min) |
| `POST` | `/chat/send` | ✓ | Quick send (auto-creates conversation) |

**Chat Pipeline**: Message → Safety pre-screen → Intent classification → Dynamic context assembly → Prompt construction → ACE LLM → Safety post-processing → Response with medical disclaimer.

---

### Caregiver Access — `/api/caregivers`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/caregivers/invite` | ✓ | Invite caregiver by email with granular permissions |
| `GET` | `/caregivers` | ✓ | List caregivers for current profile |
| `PATCH` | `/caregivers/:accessId/permissions` | ✓ | Update caregiver permissions |
| `PATCH` | `/caregivers/:accessId/accept` | ✓ | Accept caregiver invitation |
| `PATCH` | `/caregivers/:accessId/decline` | ✓ | Decline caregiver invitation |
| `DELETE` | `/caregivers/:accessId` | ✓ | Revoke caregiver access |
| `GET` | `/caregivers/my-patients` | ✓ | List profiles where user is an active caregiver |
| `GET` | `/caregivers/patient-data/:profileId` | ✓ | View patient overview (permission-filtered) |

**Permissions**: `view_records`, `add_records`, `view_care_plans`, `manage_reminders`.

---

### ABHA Enrollment — `/api/abha`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/abha/enroll/initiate` | ✓ | Initiate Aadhaar OTP verification (rate limited: 5/hr) |
| `POST` | `/abha/enroll/verify` | ✓ | Verify OTP & link ABHA number to profile |

> Set `ABHA_MODE=mock` in `.env` to use the built-in mock enrollment flow during development.

---

### Emergency Card — `/api/emergency-card`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/emergency-card` | ✓ | Consolidated emergency triage card (demographics, medications, allergies, vitals, care plan summary) |

---

## Security

- **Authentication**: Short-lived JWT access tokens (15 min) with rotating SHA-256 hashed refresh tokens (30 days). Constant-time password comparison to mitigate timing attacks.
- **Authorization**: BOLA/IDOR prevention via `ownership` middleware on all resource-specific endpoints. Multi-profile access validated per request. Caregiver access is permission-scoped.
- **Rate Limiting**: Per-IP rate limits on auth endpoints, ABHA enrollment, and chat messages. Uses `express-rate-limit` with `standardHeaders`.
- **Input Validation**: Joi schemas on all mutating endpoints with `stripUnknown` and `abortEarly: false`.
- **Audit Logging**: All mutating requests are logged with sanitized payloads (passwords, OTPs, Aadhaar numbers, API keys, and tokens are redacted) and response timing.
- **AI Safety**: Chat messages pass through a pre-screen for suicidal ideation, medical emergencies, diagnostic requests, and medication change requests. AI responses are post-processed to catch attempted diagnoses and enforce medical disclaimers.
- **HTTP Security**: Helmet headers, CORS, trust proxy for reverse proxy deployments.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with Nodemon (auto-reload) |
| `npm start` | Production start |
| `npm run migrate` | Run pending database migrations |
| `npm run migrate:down` | Roll back last migration |
| `npm run migrate:create` | Create a new migration file |

---

## License

ISC

---

*Built by [einsplosion](https://github.com/einsplosion)*