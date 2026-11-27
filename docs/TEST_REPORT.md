# Library Management System — Test Report (Initial Run)

**Test Runner:** Node.js built-in test runner (`node --test --test-reporter=spec tests/*.test.js`)  
**Database:** Docker MongoDB 7 Replica Set (`rs0` on `localhost:27017`)  
**Summary:** **21 tests** | **19 passed** | **2 failed** | Duration: `2334.32 ms`

---

## 1. Unit Tests (`tests/unit.test.js`)

| ID | Test Case | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `UNIT-01` | `Book` defaults `availableCopies` to `totalCopies` on new instance (`validateSync()`) | `availableCopies === 4`, no validation error | `availableCopies` remained `undefined` (`validateSync()` skips async `pre('validate')` hook) | **FAIL** |
| `UNIT-02` | `Book` rejects `availableCopies > totalCopies` (`validateSync()`) | Validation error on `availableCopies` | `validateSync()` returned `undefined` (no error, as `pre('validate')` hook is skipped) | **FAIL** |
| `UNIT-03` | `Book` rejects empty `categories` array | Validation error on `categories` | Validation error returned on `categories` | **PASS** |
| `UNIT-04` | `Book` rejects non-integer `totalCopies` (`1.5`) | Validation error on `totalCopies` | Validation error returned on `totalCopies` | **PASS** |
| `UNIT-05` | `Borrower` rejects invalid email and short phone (`123`) | Validation errors on `email` and `phone` | Validation errors returned on both fields | **PASS** |
| `UNIT-06` | `IssueRecord` rejects invalid `status` enum (`lost`) | Validation error on `status` | Validation error returned on `status` | **PASS** |
| `UNIT-07` | `User` rejects short password (`< 6` chars) and invalid email | Validation errors on `email` and `password` | Validation errors returned on both fields | **PASS** |
| `UNIT-08` | `protect` middleware rejects missing `Authorization` header | `401` JSON response, `next()` not called | Returned `401`, `next()` not called | **PASS** |
| `UNIT-09` | `protect` middleware rejects invalid JWT token | `401` with `"Invalid or expired token"` | Returned `401` with `"Invalid or expired token"` | **PASS** |
| `UNIT-10` | `errorHandler` maps `CastError` (`400`), duplicate `11000` (`409`), and `AppError` (`422`) | Matching HTTP status codes and messages | Returned `400`, `409`, and `422` respectively | **PASS** |
| `UNIT-11` | `aiService.generateBookDescription` without `GEMINI_API_KEY` | Throws `AppError` with `statusCode: 503` | Threw `AppError` (`503`) | **PASS** |

---

## 2. Integration & API Tests (`tests/api-integration.test.js`)

| ID | Test Case | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `API-01` | `GET /api/health` | `200` with `{ status: "ok" }` | Returned `200`, `status: "ok"` | **PASS** |
| `API-02` | Unauthenticated `GET /api/books` | `401 Unauthorized` | Returned `401` | **PASS** |
| `API-03` | Register (`201`), duplicate email (`409`), bad password (`401`), login (`200`), `GET /api/auth/me` (`200`) | All status codes match and JWT works on `/auth/me` | All assertions passed | **PASS** |
| `API-04` | Books CRUD: create multi-category (`201`), duplicate ISBN (`409`), search/filter (`200`), bad ID (`400`), missing ID (`404`), update copies/categories (`200`) | `availableCopies` updates with `totalCopies` and all error codes match | All assertions passed | **PASS** |
| `API-05` | Borrowers CRUD: invalid input (`400`), register (`201`, `LIB-XXXXXX`), filter (`200`), status toggle (`false` -> `true`) | Status toggles and validation errors behave as expected | All assertions passed | **PASS** |
| `API-06` | Edge cases: issue to inactive borrower (`400`), 0 copies (`400`), delete active book/borrower (`400`), dashboard overdue count, overdue return (`returnedLate: true`), duplicate return (`400`), AI validation (`400`) | All guards block invalid operations and dashboard counts overdue issues | All assertions passed | **PASS** |

---

## 3. End-to-End & Concurrency Tests (`tests/e2e-concurrency.test.js`)

| ID | Test Case | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `E2E-01` | Static frontend assets (`/`, `/styles.css`, `/app.js`) | All return `200`, HTML contains `"Hearthstone Library"` | All returned `200` and matched title | **PASS** |
| `E2E-02` | Full lifecycle: Register -> Add Book -> Add Borrower -> Dashboard -> Issue -> Dashboard -> Return -> History -> Delete | Inventory & dashboard counts update accurately at every step | All lifecycle assertions passed | **PASS** |
| `CONC-01` | 5 concurrent `POST /api/issues` requests for a 1-copy book (`Promise.all`) | Exactly `1` succeeds (`201`), `4` fail (`400`/conflict), `availableCopies === 0` | `1` succeeded (`201`), `4` failed, `availableCopies === 0` | **PASS** |
| `CONC-02` | 3 concurrent `PATCH /api/issues/:id/return` requests for the same issue (`Promise.all`) | Exactly `1` succeeds (`200`), `availableCopies` incremented only once (`2`) | `1` succeeded (`200`), `availableCopies === 2` | **PASS** |

---

## 4. Findings from Initial Run
- All **Integration, API, E2E, and Concurrency** tests (`10/10`) passed against the live MongoDB replica set, confirming atomic transaction behavior under concurrent issue and return load.
- **2 Unit Tests (`UNIT-01`, `UNIT-02`) failed** because `Book.js` relies on a `pre('validate')` hook (`syncAvailableCopies`) to default `availableCopies` and enforce `availableCopies <= totalCopies`, which Mongoose only executes during async `validate()` / `save()`, not synchronous `validateSync()`.

---

## 5. Post-Fix Verification Run
- **Fix Applied (`src/models/Book.js`):** Replaced the `pre('validate')` hook with a schema `default` function on `availableCopies` (`return this.totalCopies`) and a schema-level `validate` rule (`v <= this.totalCopies`), ensuring both synchronous `validateSync()` and asynchronous `validate()`/`save()` enforce the rules.
- **Re-Run Command:** `node --test --test-reporter=spec tests/*.test.js`
- **Result:** **21 tests** | **21 passed** | **0 failed** | Duration: `2083.57 ms` (`UNIT-01` and `UNIT-02` now **PASS**).
