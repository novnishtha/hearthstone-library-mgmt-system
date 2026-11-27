## 7. Error Handling and Validation

Implement centralized error handling.

Handle:
- Missing required fields.
- Invalid input formats.
- Duplicate ISBN, email or membership ID.
- Invalid MongoDB ObjectIds.
- Book or borrower not found.
- Insufficient available copies.
- Inactive borrower.
- Borrowing limit exceeded.
- Attempting to return an already returned book.
- Attempting to delete a book or borrower with active transactions.
- MongoDB connection failures.

Use consistent JSON response structures.

Example success response:

{
  "success": true,
  "message": "Book created successfully",
  "data": {}
}

Example error response:

{
  "success": false,
  "message": "No available copies of this book",
  "errors": []
}

Never expose internal stack traces, credentials or sensitive server information in production responses.

## 8. Authentication and Security

Implement a basic administrator login system using JWT authentication.

- Store hashed passwords using bcrypt.
- Protect administrative API routes.
- Keep JWT secrets in environment variables.
- Validate incoming data.
- Apply appropriate CORS configuration.
- Use Helmet and reasonable rate limiting.
- Do not commit .env files or credentials.

Only an authenticated administrator should be able to modify books, borrowers and issue records.

## 9. Testing

Write backend tests using Jest and Supertest.

Test at least:
- Creating, reading, updating and deleting books.
- Creating and updating borrowers.
- Issuing an available book.
- Rejecting an issue request when no copies are available.
- Rejecting an issue request for inactive borrowers.
- Enforcing the borrowing limit.
- Returning a book and updating inventory.
- Rejecting duplicate returns.
- Rejecting deletion when active issues exist.
- Maintaining inventory consistency during transactions.

Include instructions for running the tests.
