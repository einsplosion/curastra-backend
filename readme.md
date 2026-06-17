# CURASTRA BACKEND

Curastra is an AI-powered health assistant application. This repository contains the Express.js API service, which handles user authentication, medical record management, and secure integration with ABHA (Ayushman Bharat Health Account).

---

# Technical Stack

*   Runtime: Node.js (CommonJS modules)
*   Framework: Express.js (v5.x)
*   Database: PostgreSQL (using `pg` connection pooling)
*   File Storage: Cloudinary (via `multer` stream parsing)
*   APIs & Protocols: RESTful APIs, JWT, HTTPS, Cryptographic RSA-OAEP encryption

---

# Directory Structure

The project follows a modular, layered MVC architecture:

src/
├── config/       # Databases & Third-Party Service Configurations
├── controllers/  # API Routers / Request-Response Handlers
├── middlewares/  # Express middlewares (JWT auth, file size/type validation)
├── routes/       # Endpoint definitions
├── services/     # Core Business logic, DB operations, & API communications
├── utils/        # Crypto helpers and header factories
└── server.js     # Express App Bootstrapper

---

# Prerequisites

Before starting, make sure you have the following installed on your local machine:
*   [Node.js] (v18.x or higher recommended)
*   [PostgreSQL] (Running instance with a configured database)

You will also need credentials for:
1. Cloudinary (For testing file uploads)
2. ABDM Sandbox Account (For testing Aadhaar-linked OTP and ABHA enrollment endpoints)

---

# Getting Started

1. Clone & Install Dependencies

*  Navigate to your project root and run: "npm install"

2. Configure Environment Variables

*  Create a .env file in the root directory based on the .env.example template: cp .env.example .env (Open `.env` and fill in your local PostgreSQL connection URI, Cloudinary API credentials, and ABDM Sandbox endpoints.) 

3. Initialize the Database

*  Ensure your local PostgreSQL instance is running and has the schema loaded. You will need a `users` table and a `records` table. Below are the basic schemas to get started:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    abha_number VARCHAR(100),
    abha_address VARCHAR(255),
    abha_linked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE records (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_public_id VARCHAR(255) NOT NULL,
    notes TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

4. Run Locally

*  Development Mode (using Nodemon for auto-reload): "npm run dev"

*  Production Mode: "npm start"

---

# API Summary & Endpoints

1. Authentication (`/api/auth`)
*   `POST /api/auth/register`: Create a new user profile.
*   `POST /api/auth/login`: Log in to retrieve a JWT.
*   `GET /api/auth/me`: Fetch authenticated user profile data (Requires Bearer Token).

2. Health Records Management (`/api/records`)
*Requires standard JWT Authentication Bearer Token*
*   `POST /api/records/upload`: Upload a PDF/PNG/JPEG/JPG document (maximum size 10MB).
*   `GET /api/records`: List all documents belonging to the user (can filter using `?type=value`).
*   `GET /api/records/:recordId`: Retrieve details of a specific record.
*   `DELETE /api/records/:recordId`: Delete a record from database and Cloudinary storage.

3. ABHA Enrollment (`/api/abha`)
*Requires standard JWT Authentication Bearer Token*
*   `POST /api/abha/enroll/initiate`: Triggers Aadhaar OTP verification to start ABHA registration.
*   `POST /api/abha/enroll/verify`: Verifies Aadhaar-linked OTP and registers ABHA ID to the user.