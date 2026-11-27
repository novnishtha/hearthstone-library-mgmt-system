# Hearthstone Library Management System

A modular Library Management System built with **Node.js**, **Express.js**, **MongoDB** (Mongoose ODM with ACID transactions), and a warm-themed **HTML5 / CSS3 / Vanilla JS** frontend.

## Features
- **Staff Authentication:** Register and sign in with `bcrypt` password hashing and `jsonwebtoken` (JWT) route protection.
- **Books Management:** Full CRUD, search (`title`, `author`, `isbn`), category & availability filters, and Gemini AI auto-generated book descriptions (`POST /api/ai/book-description`).
- **Borrowers Management:** Register, update, search, filter, activate/deactivate, delete, and view per-borrower issue history.
- **Atomic Issue & Return:** Separate `IssueRecord` collection using MongoDB replica-set transactions (`session.withTransaction`) to keep `availableCopies` and issue records in sync.
- **API Docs & Postman:** See [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) and [postman/](postman/).

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. **Start MongoDB (Docker Replica Set `rs0`):**
   ```bash
   docker compose up -d
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5000` in your browser.
