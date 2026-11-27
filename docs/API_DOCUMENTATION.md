# Library Management System — API Documentation

- **Base URL:** `http://localhost:5000/api`
- **Content-Type:** `application/json`
- **Authentication:** JWT Bearer token in the `Authorization` header (`Authorization: Bearer <token>`) for all endpoints except `/api/health`, `/api/auth/register`, and `/api/auth/login`.

---

## Standard Error Format

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

Common status codes: `200 OK`, `201 Created`, `400 Bad Request` (validation or business rule failure), `401 Unauthorized`, `404 Not Found`, `409 Conflict` (duplicate email/ISBN), `500 Internal Server Error`.

---

## 1. Health

### `GET /api/health`
Public endpoint to verify server availability.
- **Response (`200`):**
```json
{ "success": true, "status": "ok" }
```

---

## 2. Authentication (`/api/auth`)

### `POST /api/auth/register`
Register a new librarian/staff account (`bcrypt` hashed password).
- **Body:**
```json
{
  "name": "Asha Verma",
  "email": "asha@example.com",
  "password": "secret123"
}
```
- **Response (`201`):** Returns `{ success: true, token, data: { id, name, email, role } }`.

### `POST /api/auth/login`
Authenticate staff credentials and obtain a JWT.
- **Body:**
```json
{
  "email": "asha@example.com",
  "password": "secret123"
}
```
- **Response (`200`):** Returns `{ success: true, token, data: { id, name, email, role } }`.

### `GET /api/auth/me` *(Protected)*
Returns the currently authenticated user profile.

---

## 3. Books (`/api/books`) *(Protected)*

### `GET /api/books`
List, search, and filter books.
- **Query Params:**
  - `q` — Case-insensitive search across `title`, `author`, and `isbn`
  - `category` — Filter by exact category (omit or `all` for all)
  - `available` — `true` (in stock) or `false` (0 copies available)
- **Response (`200`):** `{ success: true, count, data: [ ...books ] }`

### `GET /api/books/:id`
Retrieve a single book by MongoDB `_id`.

### `POST /api/books`
Add a new book (`availableCopies` initializes to `totalCopies`).
- **Body:**
```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "978-0132350884",
  "category": "Software Engineering",
  "publishedYear": 2008,
  "totalCopies": 3,
  "description": "Optional summary"
}
```
- **Response (`201`):** `{ success: true, data: book }`

### `PUT /api/books/:id`
Update book details. Adjusting `totalCopies` automatically recalculates `availableCopies` and rejects values below the number of currently issued copies.

### `DELETE /api/books/:id`
Delete a book. Fails with `400` if any copies are currently `issued`.

---

## 4. Borrowers (`/api/borrowers`) *(Protected)*

### `GET /api/borrowers`
List, search, and filter borrowers.
- **Query Params:**
  - `q` — Case-insensitive search across `name`, `email`, `phone`, and `membershipId`
  - `status` — `active` or `inactive`

### `GET /api/borrowers/:id`
Get borrower details along with their `issueHistory`.

### `GET /api/borrowers/:id/history`
Get all `IssueRecord` entries for the borrower, populated with book info.

### `POST /api/borrowers`
Register a new borrower (`membershipId` auto-generates as `LIB-XXXXXX` if omitted; `isActive` defaults to `true`).
- **Body:**
```json
{
  "name": "Rohan Mehta",
  "email": "rohan@example.com",
  "phone": "9876543210",
  "address": "42 MG Road"
}
```

### `PUT /api/borrowers/:id`
Update borrower profile fields.

### `PATCH /api/borrowers/:id/status`
Activate or deactivate a borrower. Pass `{ "isActive": true|false }` or `{}` to toggle.

### `DELETE /api/borrowers/:id`
Delete a borrower. Fails with `400` if the borrower has unreturned (`issued`) books.

---

## 5. Issue & Return (`/api/issues`) *(Protected)*

### `GET /api/issues`
List issue records.
- **Query Params:** `status` (`issued` or `returned`), `borrowerId`, `bookId`.

### `GET /api/issues/:id`
Get a single issue record with populated `book` and `borrower`.

### `POST /api/issues`
Issue a book inside a **MongoDB ACID transaction** (`session.withTransaction`):
1. Verifies borrower exists and `isActive === true`.
2. Atomically decrements `book.availableCopies` by `1` (requires `availableCopies > 0`).
3. Creates an `IssueRecord` with `status: "issued"` (`dueDate` defaults to +14 days if omitted).
- **Body:**
```json
{
  "bookId": "<bookObjectId>",
  "borrowerId": "<borrowerObjectId>",
  "dueDate": "2026-12-10",
  "notes": "Optional remark"
}
```

### `PATCH /api/issues/:id/return`
Return an issued book inside a **MongoDB ACID transaction**:
1. Finds `IssueRecord` and verifies `status === "issued"`.
2. Sets `returnDate = now`, `status = "returned"`, and `returnedLate = now > dueDate`.
3. Atomically increments `book.availableCopies` by `1`.
