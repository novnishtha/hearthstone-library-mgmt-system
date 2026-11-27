const state = {
  token: localStorage.getItem('lms_token') || null,
  user: null,
  books: [],
  borrowers: [],
  issues: [],
};

const els = {
  toast: document.getElementById('toast'),
  authView: document.getElementById('auth-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  showLoginBtn: document.getElementById('show-login-btn'),
  showRegisterBtn: document.getElementById('show-register-btn'),
  userGreeting: document.getElementById('user-greeting'),
  logoutBtn: document.getElementById('logout-btn'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
};

function showToast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast.className = 'toast hidden';
  }, 3200);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && state.token) {
      logout();
    }
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function openModal(title, html) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modalBackdrop.classList.remove('hidden');
}

function closeModal() {
  els.modalBackdrop.classList.add('hidden');
  els.modalBody.innerHTML = '';
}

els.modalCloseBtn.addEventListener('click', closeModal);
els.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});

// Auth Switching
els.showLoginBtn.addEventListener('click', () => {
  els.showLoginBtn.classList.add('active');
  els.showRegisterBtn.classList.remove('active');
  els.loginForm.classList.remove('hidden');
  els.registerForm.classList.add('hidden');
});

els.showRegisterBtn.addEventListener('click', () => {
  els.showRegisterBtn.classList.add('active');
  els.showLoginBtn.classList.remove('active');
  els.registerForm.classList.remove('hidden');
  els.loginForm.classList.add('hidden');
});

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    setSession(res.token, res.data);
    showToast(`Welcome back, ${res.data.name}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

els.registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('reg-name').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
      }),
    });
    setSession(res.token, res.data);
    showToast('Account created');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('lms_token', token);
  els.userGreeting.textContent = `${user.name} (${user.role})`;
  els.authView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  setDefaultDueDate();
  refreshAll();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('lms_token');
  els.appView.classList.add('hidden');
  els.authView.classList.remove('hidden');
}

els.logoutBtn.addEventListener('click', logout);

// Navigation Tabs
document.querySelectorAll('.nav-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    ['books', 'borrowers', 'issues'].forEach((name) => {
      document.getElementById(`tab-${name}`).classList.toggle('hidden', name !== target);
    });
  });
});

async function refreshAll() {
  await Promise.all([loadBooks(), loadBorrowers(), loadIssues()]);
  updateStats();
  populateIssueDropdowns();
}

function updateStats() {
  document.getElementById('stat-books').textContent = state.books.length;
  const totalAvailable = state.books.reduce((sum, b) => sum + (b.availableCopies || 0), 0);
  document.getElementById('stat-copies').textContent = totalAvailable;
  const activeBorrowers = state.borrowers.filter((b) => b.isActive).length;
  document.getElementById('stat-borrowers').textContent = activeBorrowers;
  const issuedCount = state.issues.filter((r) => r.status === 'issued').length;
  document.getElementById('stat-issued').textContent = issuedCount;
}

// ---------------- BOOKS ----------------
const BOOK_CATEGORIES = [
  'Fiction',
  'Non-Fiction',
  'Science',
  'Technology',
  'Software Engineering',
  'History',
  'Fantasy',
  'Mystery',
  'Thriller',
  'Action',
  'Philosophy',
  'Literature',
  'Young Adult',
  'Self-Help',
  'General',
];

function getBookCategories(book) {
  if (Array.isArray(book?.categories) && book.categories.length) {
    return book.categories;
  }
  return book?.category ? [book.category] : ['General'];
}

async function loadBooks() {
  const q = document.getElementById('book-search').value.trim();
  const category = document.getElementById('book-category-filter').value;
  const available = document.getElementById('book-availability-filter').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category && category !== 'all') params.set('category', category);
  if (available) params.set('available', available);

  const res = await api(`/books?${params.toString()}`);
  state.books = res.data;
  renderBooks();
  refreshCategoryFilter();
}

function refreshCategoryFilter() {
  const select = document.getElementById('book-category-filter');
  const current = select.value;
  const categories = [
    ...new Set([...BOOK_CATEGORIES, ...state.books.flatMap((b) => getBookCategories(b))]),
  ].sort();

  const existingOptions = new Set([...select.options].map((o) => o.value));
  categories.forEach((cat) => {
    if (!existingOptions.has(cat)) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    }
  });
  select.value = current;
}

function renderBooks() {
  const tbody = document.getElementById('books-tbody');
  if (!state.books.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No books found.</td></tr>';
    return;
  }

  tbody.innerHTML = state.books
    .map((book) => {
      const badgeClass = book.availableCopies > 0 ? 'badge-sage' : 'badge-danger';
      const categoryBadges = getBookCategories(book)
        .map((c) => `<span class="badge badge-amber">${escapeHtml(c)}</span>`)
        .join(' ');
      return `
        <tr>
          <td><strong>${escapeHtml(book.title)}</strong></td>
          <td>${escapeHtml(book.author)}</td>
          <td>${escapeHtml(book.isbn)}</td>
          <td><div class="category-list">${categoryBadges}</div></td>
          <td><span class="badge ${badgeClass}">${book.availableCopies} / ${book.totalCopies}</span></td>
          <td class="actions-cell">
            <button class="btn btn-outline btn-sm" onclick="viewBook('${book._id}')">View</button>
            <button class="btn btn-outline btn-sm" onclick="openBookModal('${book._id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteBook('${book._id}')">Delete</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

window.viewBook = async function viewBook(id) {
  try {
    const { data: b } = await api(`/books/${id}`);
    const categoryBadges = getBookCategories(b)
      .map((c) => `<span class="badge badge-amber">${escapeHtml(c)}</span>`)
      .join(' ');
    openModal(
      b.title,
      `
        <div class="stack">
          <p><strong>Author:</strong> ${escapeHtml(b.author)}</p>
          <p><strong>ISBN:</strong> ${escapeHtml(b.isbn)}</p>
          <p><strong>Categories / Genres:</strong> ${categoryBadges}</p>
          <p><strong>Published Year:</strong> ${b.publishedYear || '—'}</p>
          <p><strong>Copies:</strong> ${b.availableCopies} available of ${b.totalCopies} total</p>
          <p><strong>Description:</strong> ${escapeHtml(b.description || 'No description provided.')}</p>
        </div>
      `
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.openBookModal = function openBookModal(id = null) {
  const book = id ? state.books.find((b) => b._id === id) : null;
  const selected = new Set(book ? getBookCategories(book) : ['General']);
  const options = [...new Set([...BOOK_CATEGORIES, ...selected])].sort();
  const categoryOptionsHtml = options
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${selected.has(cat) ? 'selected' : ''}>${escapeHtml(cat)}</option>`
    )
    .join('');

  openModal(
    book ? 'Edit Book' : 'Add New Book',
    `
      <form id="book-modal-form" class="stack">
        <label class="field"><span>Title</span><input name="title" required value="${escapeHtml(book?.title || '')}" /></label>
        <label class="field"><span>Author</span><input name="author" required value="${escapeHtml(book?.author || '')}" /></label>
        <label class="field"><span>ISBN</span><input name="isbn" required value="${escapeHtml(book?.isbn || '')}" /></label>
        <label class="field">
          <span>Categories / Genres</span>
          <select name="categories" multiple size="5" required>${categoryOptionsHtml}</select>
          <small class="muted">Hold Ctrl (Windows) or Cmd (Mac) to select multiple genres.</small>
        </label>
        <label class="field"><span>Published Year</span><input name="publishedYear" type="number" min="1000" max="2030" value="${book?.publishedYear || ''}" /></label>
        <label class="field"><span>Total Copies</span><input name="totalCopies" type="number" min="1" required value="${book?.totalCopies || 1}" /></label>
        <div class="field">
          <div class="field-header">
            <span>Description</span>
            <button type="button" id="ai-desc-btn" class="btn btn-outline btn-sm">Auto-Generate (AI)</button>
          </div>
          <textarea name="description" rows="3">${escapeHtml(book?.description || '')}</textarea>
        </div>
        <button type="submit" class="btn btn-primary">${book ? 'Save Changes' : 'Add Book'}</button>
      </form>
    `
  );

  const bookForm = document.getElementById('book-modal-form');
  const aiDescBtn = document.getElementById('ai-desc-btn');
  aiDescBtn.addEventListener('click', async () => {
    const title = bookForm.title.value.trim();
    const author = bookForm.author.value.trim();
    if (!title || !author) {
      showToast('Enter Title and Author first', 'error');
      return;
    }

    aiDescBtn.disabled = true;
    aiDescBtn.textContent = 'Generating...';
    try {
      const selectedCategories = [...bookForm.categories.selectedOptions].map((o) => o.value);
      const res = await api('/ai/book-description', {
        method: 'POST',
        body: JSON.stringify({
          title,
          author,
          categories: selectedCategories,
          publishedYear: bookForm.publishedYear.value ? Number(bookForm.publishedYear.value) : undefined,
        }),
      });
      bookForm.description.value = res.data.description;
      showToast('Description generated');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      aiDescBtn.disabled = false;
      aiDescBtn.textContent = 'Auto-Generate (AI)';
    }
  });

  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const selectedCategories = [...form.categories.selectedOptions].map((o) => o.value);
    if (!selectedCategories.length) {
      showToast('Select at least one category', 'error');
      return;
    }

    const payload = {
      title: form.title.value.trim(),
      author: form.author.value.trim(),
      isbn: form.isbn.value.trim(),
      categories: selectedCategories,
      publishedYear: form.publishedYear.value ? Number(form.publishedYear.value) : undefined,
      totalCopies: Number(form.totalCopies.value),
      description: form.description.value.trim(),
    };

    try {
      if (book) {
        await api(`/books/${book._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Book updated');
      } else {
        await api('/books', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Book added');
      }
      closeModal();
      await refreshAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

window.deleteBook = async function deleteBook(id) {
  if (!confirm('Delete this book from the catalog?')) return;
  try {
    await api(`/books/${id}`, { method: 'DELETE' });
    showToast('Book deleted');
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('add-book-btn').addEventListener('click', () => openBookModal());
document.getElementById('book-search').addEventListener('input', loadBooks);
document.getElementById('book-category-filter').addEventListener('change', loadBooks);
document.getElementById('book-availability-filter').addEventListener('change', loadBooks);

// ---------------- BORROWERS ----------------
async function loadBorrowers() {
  const q = document.getElementById('borrower-search').value.trim();
  const status = document.getElementById('borrower-status-filter').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const res = await api(`/borrowers?${params.toString()}`);
  state.borrowers = res.data;
  renderBorrowers();
}

function renderBorrowers() {
  const tbody = document.getElementById('borrowers-tbody');
  if (!state.borrowers.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No borrowers found.</td></tr>';
    return;
  }

  tbody.innerHTML = state.borrowers
    .map((b) => {
      const statusBadge = b.isActive
        ? '<span class="badge badge-sage">Active</span>'
        : '<span class="badge badge-danger">Inactive</span>';
      return `
        <tr>
          <td><code>${escapeHtml(b.membershipId || '—')}</code></td>
          <td><strong>${escapeHtml(b.name)}</strong></td>
          <td>${escapeHtml(b.email)}</td>
          <td>${escapeHtml(b.phone)}</td>
          <td>${statusBadge}</td>
          <td class="actions-cell">
            <button class="btn btn-outline btn-sm" onclick="viewBorrowerHistory('${b._id}')">History</button>
            <button class="btn btn-outline btn-sm" onclick="openBorrowerModal('${b._id}')">Edit</button>
            <button class="btn btn-sage btn-sm" onclick="toggleBorrower('${b._id}')">${b.isActive ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteBorrower('${b._id}')">Delete</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

window.openBorrowerModal = function openBorrowerModal(id = null) {
  const borrower = id ? state.borrowers.find((b) => b._id === id) : null;
  openModal(
    borrower ? 'Edit Borrower' : 'Register Borrower',
    `
      <form id="borrower-modal-form" class="stack">
        <label class="field"><span>Full Name</span><input name="name" required minlength="2" value="${escapeHtml(borrower?.name || '')}" /></label>
        <label class="field"><span>Email</span><input name="email" type="email" required value="${escapeHtml(borrower?.email || '')}" /></label>
        <label class="field"><span>Phone</span><input name="phone" required minlength="7" value="${escapeHtml(borrower?.phone || '')}" /></label>
        <label class="field"><span>Address</span><textarea name="address" rows="2">${escapeHtml(borrower?.address || '')}</textarea></label>
        <button type="submit" class="btn btn-primary">${borrower ? 'Save Changes' : 'Register Borrower'}</button>
      </form>
    `
  );

  document.getElementById('borrower-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
    };

    try {
      if (borrower) {
        await api(`/borrowers/${borrower._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Borrower updated');
      } else {
        await api('/borrowers', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Borrower registered');
      }
      closeModal();
      await refreshAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

window.toggleBorrower = async function toggleBorrower(id) {
  try {
    const res = await api(`/borrowers/${id}/status`, { method: 'PATCH', body: JSON.stringify({}) });
    showToast(res.message);
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.viewBorrowerHistory = async function viewBorrowerHistory(id) {
  try {
    const res = await api(`/borrowers/${id}/history`);
    const rows = res.data.length
      ? res.data
        .map(
          (r) => `
          <tr>
            <td>${escapeHtml(r.book?.title || 'Deleted Book')}</td>
            <td>${formatDate(r.issueDate)}</td>
            <td>${formatDate(r.dueDate)}</td>
            <td>${formatDate(r.returnDate)}</td>
            <td><span class="badge ${r.status === 'returned' ? 'badge-sage' : 'badge-amber'}">${r.status}</span></td>
          </tr>
        `
        )
        .join('')
      : '<tr><td colspan="5" class="muted">No issue history yet.</td></tr>';

    openModal(
      `History — ${res.borrower.name} (${res.borrower.membershipId})`,
      `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteBorrower = async function deleteBorrower(id) {
  if (!confirm('Delete this borrower?')) return;
  try {
    await api(`/borrowers/${id}`, { method: 'DELETE' });
    showToast('Borrower deleted');
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('add-borrower-btn').addEventListener('click', () => openBorrowerModal());
document.getElementById('borrower-search').addEventListener('input', loadBorrowers);
document.getElementById('borrower-status-filter').addEventListener('change', loadBorrowers);

// ---------------- ISSUE & RETURN ----------------
function setDefaultDueDate() {
  const input = document.getElementById('issue-due-date');
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  input.value = inTwoWeeks.toISOString().split('T')[0];
}

function populateIssueDropdowns() {
  const bookSelect = document.getElementById('issue-book-select');
  const borrowerSelect = document.getElementById('issue-borrower-select');

  const availableBooks = state.books.filter((b) => b.availableCopies > 0);
  bookSelect.innerHTML = availableBooks.length
    ? availableBooks
      .map((b) => `<option value="${b._id}">${escapeHtml(b.title)} (${b.availableCopies} avail)</option>`)
      .join('')
    : '<option value="">No books available</option>';

  const activeBorrowers = state.borrowers.filter((b) => b.isActive);
  borrowerSelect.innerHTML = activeBorrowers.length
    ? activeBorrowers
      .map((b) => `<option value="${b._id}">${escapeHtml(b.name)} (${escapeHtml(b.membershipId)})</option>`)
      .join('')
    : '<option value="">No active borrowers</option>';
}

async function loadIssues() {
  const status = document.getElementById('issue-status-filter').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const res = await api(`/issues?${params.toString()}`);
  state.issues = res.data;
  renderIssues();
}

function renderIssues() {
  const tbody = document.getElementById('issues-tbody');
  if (!state.issues.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">No issue records found.</td></tr>';
    return;
  }

  tbody.innerHTML = state.issues
    .map((r) => {
      const isOverdue = r.status === 'issued' && new Date() > new Date(r.dueDate);
      const badge =
        r.status === 'returned'
          ? `<span class="badge badge-sage">${r.returnedLate ? 'Returned (Late)' : 'Returned'}</span>`
          : `<span class="badge ${isOverdue ? 'badge-danger' : 'badge-amber'}">${isOverdue ? 'Overdue' : 'Issued'}</span>`;

      const action =
        r.status === 'issued'
          ? `<button class="btn btn-primary btn-sm" onclick="returnIssue('${r._id}')">Return Book</button>`
          : '<span class="muted">Completed</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(r.book?.title || 'Unknown')}</strong></td>
          <td>${escapeHtml(r.borrower?.name || 'Unknown')}</td>
          <td>${formatDate(r.issueDate)}</td>
          <td>${formatDate(r.dueDate)}</td>
          <td>${formatDate(r.returnDate)}</td>
          <td>${badge}</td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join('');
}

document.getElementById('issue-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bookId = document.getElementById('issue-book-select').value;
  const borrowerId = document.getElementById('issue-borrower-select').value;
  const dueDate = document.getElementById('issue-due-date').value;
  const notes = document.getElementById('issue-notes').value.trim();

  if (!bookId || !borrowerId) {
    showToast('Select both an available book and an active borrower', 'error');
    return;
  }

  try {
    await api('/issues', {
      method: 'POST',
      body: JSON.stringify({ bookId, borrowerId, dueDate, notes }),
    });
    document.getElementById('issue-notes').value = '';
    showToast('Book issued successfully');
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

window.returnIssue = async function returnIssue(id) {
  try {
    const res = await api(`/issues/${id}/return`, { method: 'PATCH' });
    showToast(res.message);
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('issue-status-filter').addEventListener('change', loadIssues);

// Boot
(async function init() {
  if (!state.token) return;
  try {
    const res = await api('/auth/me');
    setSession(state.token, res.data);
  } catch {
    logout();
  }
})();
