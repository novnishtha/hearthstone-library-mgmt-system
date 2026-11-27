# Library Management System Architecture

## Authentication and Authorization Workflow

```mermaid
flowchart TD
    Start["Staff opens the application"] --> Existing{"JWT stored in<br/>localStorage?"}

    Existing -->|"Yes"| Restore["Load lms_token"]
    Existing -->|"No"| LoginScreen["Show sign-in/register screen"]

    Restore --> Me["GET /api/auth/me<br/>Authorization: Bearer token"]
    Me --> VerifyRestore{"JWT valid and<br/>user exists?"}
    VerifyRestore -->|"Yes"| Dashboard["Load protected dashboard"]
    VerifyRestore -->|"No"| ClearToken["Remove stored JWT"]
    ClearToken --> LoginScreen

    LoginScreen --> Action{"Choose action"}

    Action -->|"Register"| RegisterInput["Enter name, email, password"]
    RegisterInput --> RegisterValidation["Validate registration fields"]
    RegisterValidation -->|"Invalid"| RegisterError["Return validation error"]
    RegisterError --> RegisterInput
    RegisterValidation -->|"Valid"| CheckEmail["Check for existing email"]
    CheckEmail -->|"Already exists"| Conflict["Return 409 conflict"]
    Conflict --> RegisterInput
    CheckEmail -->|"Available"| HashPassword["Hash password with bcrypt"]
    HashPassword --> CreateUser["Create user in MongoDB"]
    CreateUser --> IssueRegisterToken["Sign JWT with user ID"]
    IssueRegisterToken --> StoreRegisterToken["Return JWT to browser"]

    Action -->|"Sign in"| LoginInput["Enter email and password"]
    LoginInput --> LoginValidation["Validate login fields"]
    LoginValidation -->|"Invalid"| LoginError["Return validation error"]
    LoginError --> LoginInput
    LoginValidation -->|"Valid"| FindUser["Look up user by email"]
    FindUser --> ComparePassword{"Password matches<br/>hashed password?"}
    ComparePassword -->|"No"| Unauthorized["Return 401 unauthorized"]
    Unauthorized --> LoginInput
    ComparePassword -->|"Yes"| IssueLoginToken["Sign JWT with user ID"]
    IssueLoginToken --> StoreLoginToken["Return JWT to browser"]

    StoreRegisterToken --> SaveToken["Store JWT as lms_token"]
    StoreLoginToken --> SaveToken
    SaveToken --> Dashboard

    Dashboard --> ProtectedRequest["Call protected /api/books,<br/>/api/borrowers, or /api/issues"]
    ProtectedRequest --> ReadHeader{"Authorization header<br/>uses Bearer token?"}
    ReadHeader -->|"No"| MissingToken["Return 401 authentication required"]
    ReadHeader -->|"Yes"| VerifySignature["Verify JWT signature and expiry"]
    VerifySignature -->|"Invalid or expired"| InvalidToken["Return 401 invalid or expired token"]
    VerifySignature -->|"Valid"| LoadUser["Find user by token subject"]
    LoadUser -->|"User missing"| MissingUser["Return 401 user no longer exists"]
    LoadUser -->|"User found"| AttachUser["Attach user to req.user"]
    AttachUser --> ValidateRequest["Run route validation"]
    ValidateRequest -->|"Invalid"| ValidationError["Return 400 validation error"]
    ValidateRequest -->|"Valid"| Authorize{"Authenticated user allowed?"}
    Authorize -->|"Yes"| Controller["Run route controller"]
    Controller --> MongoDB["Read or update MongoDB"]
    MongoDB --> Response["Return success JSON"]

    MissingToken --> LoginScreen
    InvalidToken --> LoginScreen
    MissingUser --> LoginScreen
    ValidationError --> Dashboard
    Response --> Dashboard

    SignOut["Staff selects sign out"] --> RemoveToken["Remove lms_token"]
    RemoveToken --> LoginScreen
    Dashboard --> SignOut
```

### Authorization Rules

- Authentication is enforced by the `protect` middleware on `/api/books`, `/api/borrowers`, and `/api/issues`.
- `/api/auth/register` and `/api/auth/login` are public.
- The JWT contains the authenticated user's ID and expires after `JWT_EXPIRES_IN`, defaulting to `7d`.
- Protected routes verify the JWT, then load the current user and attach it to `req.user`.
- The application currently treats every authenticated user as authorized for every protected operation.
- Although `User.role` supports `librarian` and `admin`, no role-based authorization middleware or role check is currently enforced.

## System Context

```mermaid
flowchart LR
    User["Library staff<br/>Browser"]

    subgraph App["Library Management System"]
        Frontend["Vanilla JS SPA<br/>public/index.html<br/>public/app.js"]
        API["Node.js + Express API<br/>src/server.js / src/app.js"]
        Auth["JWT authentication<br/>bcrypt password hashing"]
        Routes["REST routes"]
        Controllers["Controllers"]
        Models["Mongoose models"]
    end

    Mongo[("MongoDB 7<br/>Replica set rs0")]

    User -->|"HTTP / HTTPS"| Frontend
    Frontend -->|"REST /api/*<br/>Bearer JWT"| API
    Frontend <-->|"Static assets"| API
    API --> Auth
    Auth --> Models
    API --> Routes
    Routes --> Controllers
    Controllers --> Models
    Models -->|"Mongoose ODM"| Mongo

    subgraph Docker["Docker Compose"]
        Mongo
        Volume[("mongo_data<br/>Persistent volume")]
    end

    Mongo --- Volume
```

## Application Layers

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["Dashboard UI<br/>Books, Borrowers, Issues"]
        State["In-memory state"]
        Storage["localStorage<br/>lms_token"]
        Fetch["Fetch API wrapper"]
    end

    subgraph Server["Express Application"]
        Static["Static file middleware"]
        Health["GET /api/health"]
        Security["Helmet + CORS"]
        Parser["JSON request parser"]
        Logger["Morgan"]

        subgraph AuthLayer["Authentication"]
            Register["POST /api/auth/register"]
            Login["POST /api/auth/login"]
            Me["GET /api/auth/me"]
            JWT["JWT verification<br/>protect middleware"]
        end

        subgraph ResourceAPIs["Protected Resources"]
            Books["/api/books"]
            Borrowers["/api/borrowers"]
            Issues["/api/issues"]
        end

        Validation["express-validator"]
        Errors["Central error handler"]
    end

    subgraph Persistence["MongoDB"]
        UserDB[("users")]
        BookDB[("books")]
        BorrowerDB[("borrowers")]
        IssueDB[("issuerecords")]
    end

    UI --> State
    State --> Fetch
    Fetch --> Storage
    Fetch -->|"Authorization: Bearer token"| Security
    Static --> UI
    Security --> Parser
    Parser --> Logger
    Logger --> Health
    Logger --> AuthLayer
    Logger --> JWT
    JWT --> ResourceAPIs
    ResourceAPIs --> Validation
    AuthLayer --> UserDB
    Books --> BookDB
    Borrowers --> BorrowerDB
    Issues --> IssueDB
    Issues -->|"MongoDB transaction"| BookDB
    Issues -->|"MongoDB transaction"| IssueDB
    Validation --> Errors
```

## Request Flow

```mermaid
sequenceDiagram
    actor Staff
    participant UI as Browser SPA
    participant API as Express API
    participant Auth as protect Middleware
    participant Ctrl as Controller
    participant DB as MongoDB

    Staff->>UI: Sign in
    UI->>API: POST /api/auth/login
    API->>DB: Find user + password
    DB-->>API: User record
    API-->>UI: JWT and staff profile
    UI->>UI: Store JWT in localStorage

    Staff->>UI: Manage books, borrowers, or issues
    UI->>API: REST request + Bearer JWT
    API->>Auth: Verify signature and user
    Auth->>DB: Find user
    DB-->>Auth: Active user
    Auth->>Ctrl: Attach req.user and continue
    Ctrl->>DB: Mongoose query or transaction
    DB-->>Ctrl: Result
    Ctrl-->>API: Success or AppError
    API-->>UI: JSON response
    UI-->>Staff: Render updated view
```

## Issue and Return Transaction Flow

```mermaid
sequenceDiagram
    participant API as Issue Controller
    participant Session as Mongoose Session
    participant Borrower as Borrowers
    participant Book as Books
    participant Issue as Issue Records

    API->>Session: startSession()
    API->>Session: withTransaction()
    Session->>Borrower: Find borrower
    Borrower-->>Session: Borrower status
    alt Inactive or missing borrower
        Session-->>API: Transaction error
    else Active borrower
        Session->>Book: Conditional decrement<br/>availableCopies > 0
        Book-->>Session: Updated book or null
        alt No copy available
            Session-->>API: 400 No available copies
        else Copy available
            Session->>Issue: Create issue record
            Issue-->>Session: Created record
            Session-->>API: Commit transaction
            API-->>API: Populate book and borrower
        end
    end
    API->>Session: endSession()
```

Returning a book uses the same transaction pattern:

1. Load the issue record.
2. Reject it if it is already returned.
3. Set `returnDate`, `status`, and `returnedLate`.
4. Increment `availableCopies` only while it remains below `totalCopies`.
5. Commit both updates atomically, or roll back on failure.

## Data Model

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string name
        string email UK
        string password
        string role
        date createdAt
        date updatedAt
    }

    BOOK {
        ObjectId _id PK
        string title
        string author
        string isbn UK
        string category
        number publishedYear
        number totalCopies
        number availableCopies
        string description
    }

    BORROWER {
        ObjectId _id PK
        string name
        string email UK
        string phone
        string membershipId UK
        string address
        boolean isActive
    }

    ISSUE_RECORD {
        ObjectId _id PK
        ObjectId book FK
        ObjectId borrower FK
        ObjectId issuedBy FK
        date issueDate
        date dueDate
        date returnDate
        string status
        boolean returnedLate
        string notes
    }

    USER ||--o{ ISSUE_RECORD : "issues"
    BORROWER ||--o{ ISSUE_RECORD : "has"
    BOOK ||--o{ ISSUE_RECORD : "tracks"
```

## Deployment Notes

- `src/server.js` connects to MongoDB before starting the Express listener.
- The default HTTP port is `5000`.
- Express serves the browser SPA from `public/` and provides `/api/*` routes.
- MongoDB runs as the `rs0` replica set because circulation operations use MongoDB transactions.
- Docker Compose persists MongoDB data in the `mongo_data` volume.
- The frontend keeps the JWT in `localStorage` and adds it to protected API requests.
- Validation errors, Mongoose validation/cast errors, duplicate keys, and application errors pass through the central error middleware.
