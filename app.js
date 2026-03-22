const THEME_KEY = "wallet-counter-pro-theme";
const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:4173" : "";
const TRANSACTIONS_PER_PAGE = 10;
const APP_TIME_ZONE = "Asia/Yangon";

const state = {
  transactions: [],
  sessionUser: null,
  theme: loadTheme(),
  search: "",
  filterDate: "",
  filterType: "all",
  currentPage: 1,
  modalOpen: false,
  detailsId: "",
  deleteConfirmId: "",
  editingId: "",
  authTab: "login",
  loading: true
};

const app = document.getElementById("app");

function loadTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) || "light";
  } catch {
    return "light";
  }
}

function saveTheme(value) {
  window.localStorage.setItem(THEME_KEY, value);
}

function render() {
  document.body.setAttribute("data-theme", state.theme);

  if (state.loading) {
    app.innerHTML = `
      <main class="auth-shell">
        <section class="auth-hero">
          <div class="brand-badge">Wallet Counter Pro</div>
          <h1>Loading workspace</h1>
          <p>Connecting to your data and preparing the dashboard.</p>
        </section>
        <section class="auth-card">
          <div class="panel">
            <p class="subtle">Please wait...</p>
          </div>
        </section>
      </main>
    `;
    return;
  }

  const user = getCurrentUser();
  app.innerHTML = user ? renderDashboard(user) : renderAuth();
  bindEvents();
}

function getThemeIconSvg() {
  if (state.theme === "dark") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2"></path>
        <path d="M12 20v2"></path>
        <path d="M4.93 4.93l1.41 1.41"></path>
        <path d="M17.66 17.66l1.41 1.41"></path>
        <path d="M2 12h2"></path>
        <path d="M20 12h2"></path>
        <path d="M4.93 19.07l1.41-1.41"></path>
        <path d="M17.66 6.34l1.41-1.41"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path>
    </svg>
  `;
}

function getThemeButtonText() {
  return state.theme === "dark" ? "Light mode" : "Dark mode";
}

function getThemeLabel() {
  return state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

function getPaginationArrowSvg(direction) {
  const rotation = direction === "left" ? "180" : "0";
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5l7 7-7 7" transform="rotate(${rotation} 12 12)"></path>
    </svg>
  `;
}

function renderAuth() {
  return `
    <main class="auth-shell">
      <section class="auth-hero">
        <div class="brand-badge">Wallet Counter Pro</div>
        <h1>Counter app for KBZPay and WavePay teams</h1>
        <p>
          Sign in as admin or cashier, create daily transactions quickly, and keep profit visibility limited to admin accounts.
        </p>
        <div class="hero-points">
          <div><strong>Admin</strong><span>Can view profit and full dashboard metrics</span></div>
          <div><strong>Cashier</strong><span>Can create and manage transactions without profit visibility</span></div>
        </div>
      </section>

      <section class="auth-card">
        <div class="auth-topbar">
          <div class="auth-tabs">
            <button class="tab-button ${state.authTab === "login" ? "active" : ""}" data-auth-tab="login" type="button">Login</button>
            <button class="tab-button ${state.authTab === "signup" ? "active" : ""}" data-auth-tab="signup" type="button">Sign Up</button>
          </div>
          <button id="themeToggleAuth" class="theme-toggle-button icon-only" type="button" aria-label="${getThemeLabel()}" title="${getThemeLabel()}">
            <span class="theme-toggle-icon">${getThemeIconSvg()}</span>
          </button>
        </div>

        <form id="loginForm" class="auth-form ${state.authTab === "login" ? "" : "hidden"}">
          <h2>Welcome back</h2>
          <p class="subtle">Sign in to continue to the counter dashboard.</p>
          <label>
            <span>Username</span>
            <input id="loginUsername" type="text" required>
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input id="loginPassword" type="password" required>
              <button class="password-toggle" data-password-toggle="loginPassword" type="button">Show</button>
            </div>
          </label>
          <button class="primary-button auth-button" type="submit">Login</button>
          <p id="loginMessage" class="form-message"></p>
        </form>

        <form id="signupForm" class="auth-form ${state.authTab === "signup" ? "" : "hidden"}">
          <h2>Create account</h2>
          <p class="subtle">New sign ups create cashier accounts only.</p>
          <label>
            <span>Full Name</span>
            <input id="signupName" type="text" required>
          </label>
          <label>
            <span>Username</span>
            <input id="signupUsername" type="text" required>
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input id="signupPassword" type="password" required>
              <button class="password-toggle" data-password-toggle="signupPassword" type="button">Show</button>
            </div>
          </label>
          <button class="primary-button auth-button" type="submit">Create Account</button>
          <p id="signupMessage" class="form-message"></p>
        </form>
      </section>
    </main>
  `;
}

function renderDashboard(user) {
  const visibleTransactions = getVisibleTransactions();
  const pagination = getPaginationState(visibleTransactions.length);
  const paginatedTransactions = visibleTransactions.slice(pagination.startIndex, pagination.endIndex);
  const summary = summarizeTransactions(visibleTransactions);
  const dateProfitSummary = summarizeTransactions(getDateProfitTransactions(visibleTransactions));
  const dateProfitLabel = getDateProfitLabel();
  const isAdmin = user.role === "admin";

  return `
    <div class="dashboard-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-badge">W</div>
          <div>
            <h2>Wallet Counter Pro</h2>
            <p>KBZPay / WavePay counter team</p>
          </div>
        </div>

        <div class="profile-card">
          <span class="profile-role">${escapeHtml(user.role)}</span>
          <strong>${escapeHtml(user.fullName)}</strong>
          <small>@${escapeHtml(user.username)}</small>
        </div>

        ${isAdmin ? `
          <div class="menu-card">
            <h3>Transaction Rules</h3>
            <ul class="rule-list">
              <li><strong>ငွေထုတ်</strong> under 100,000 MMK = 1% profit</li>
              <li><strong>ငွေထုတ်</strong> 100,000 MMK and above = 0.5% profit</li>
              <li><strong>ငွေသွင်း</strong> = 0.1% profit</li>
            </ul>
          </div>
        ` : ""}

        <div class="menu-card">
          <h3>Quick Filter</h3>
          <button class="filter-chip ${state.filterType === "all" ? "active" : ""}" data-filter="all" type="button">All</button>
          <button class="filter-chip ${state.filterType === "ငွေထုတ်" ? "active" : ""}" data-filter="ငွေထုတ်" type="button">ငွေထုတ်</button>
          <button class="filter-chip ${state.filterType === "ငွေသွင်း" ? "active" : ""}" data-filter="ငွေသွင်း" type="button">ငွေသွင်း</button>
        </div>

      </aside>

      <main class="content">
        <header class="topbar">
          <div class="topbar-main">
            <div class="topbar-heading">
              <p class="eyebrow dark">Operations Dashboard</p>
              <h1>Daily Transactions</h1>
              <p class="topbar-copy">Cashiers can create transactions. Admins can also view profit across the counter.</p>
            </div>
            <div class="topbar-actions">
              <button id="themeToggleDashboard" class="theme-toggle-button icon-only" type="button" aria-label="${getThemeLabel()}" title="${getThemeLabel()}">
                <span class="theme-toggle-icon">${getThemeIconSvg()}</span>
              </button>
              <button id="headerLogoutButton" class="secondary-button danger-button mobile-only-button" type="button">Logout</button>
            </div>
          </div>
          <div class="topbar-tools">
            <input id="searchInput" class="search-input" type="search" placeholder="Search by customer, phone, or user" value="${escapeHtml(state.search)}">
            <button
              id="dateFilterToggleButton"
              class="icon-button date-filter-toggle ${state.filterDate ? "active" : ""}"
              type="button"
              aria-label="${state.filterDate ? `Change date filter from ${escapeHtml(state.filterDate)}` : "Open date filter"}"
              title="${state.filterDate ? `Date filter: ${escapeHtml(state.filterDate)}` : "Filter by date"}"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                <path d="M16 3v4"></path>
                <path d="M8 3v4"></path>
                <path d="M3 10h18"></path>
              </svg>
            </button>
            <input id="dateFilterInput" class="date-filter-input" type="date" value="${escapeHtml(state.filterDate)}">
            <button id="clearDateFilterButton" class="secondary-button ${state.filterDate ? "" : "hidden"}" type="button">Clear Date</button>
          </div>
        </header>

        <section class="stats-grid">
          <article class="stat-card">
            <span>Total Transactions</span>
            <strong>${summary.count}</strong>
          </article>
          <article class="stat-card">
            <span>Total Amount</span>
            <strong>${formatAmount(summary.amount)}</strong>
          </article>
          <article class="stat-card">
            <span>ငွေထုတ် Amount</span>
            <strong>${formatAmount(summary.byType["ငွေထုတ်"] ? summary.byType["ငွေထုတ်"].amount : 0)}</strong>
          </article>
          <article class="stat-card">
            <span>ငွေသွင်း Amount</span>
            <strong>${formatAmount(summary.byType["ငွေသွင်း"] ? summary.byType["ငွေသွင်း"].amount : 0)}</strong>
          </article>
          <article class="stat-card accent">
            <span>${escapeHtml(dateProfitLabel)}</span>
            <strong>${isAdmin ? formatProfit(dateProfitSummary.profit) : "Admin Only"}</strong>
          </article>
          ${isAdmin ? `
            <article class="stat-card accent">
              <span>Total Profit</span>
              <strong>${formatProfit(summary.profit)}</strong>
            </article>
          ` : `
            <article class="stat-card restricted">
              <span>Total Profit</span>
              <strong>Admin Only</strong>
            </article>
          `}
        </section>

        ${isAdmin ? `
          <section class="panel compact-panel">
            <div class="section-heading">
              <h2>Profit By Transaction Type</h2>
              <p>Visible only to admin accounts.</p>
            </div>
            <div class="type-summary-grid">
              <article class="type-card">
                <span>ငွေထုတ် Profit</span>
                <strong>${formatProfit(summary.byType["ငွေထုတ်"] ? summary.byType["ငွေထုတ်"].profit : 0)}</strong>
              </article>
              <article class="type-card">
                <span>ငွေသွင်း Profit</span>
                <strong>${formatProfit(summary.byType["ငွေသွင်း"] ? summary.byType["ငွေသွင်း"].profit : 0)}</strong>
              </article>
            </div>
          </section>
        ` : ""}

        <section class="panel">
          <div class="section-heading">
            <h2>Transaction List</h2>
            <p>The plus button creates new transactions with name, amount, and optional phone number.</p>
          </div>
          <div class="table-toolbar">
            <div class="table-filter-group">
              <button id="tableFilterAll" class="mini-button ${state.filterType === "all" ? "active-filter" : ""}" type="button">All</button>
              <button id="tableFilterWithdraw" class="mini-button ${state.filterType === "ငွေထုတ်" ? "active-filter" : ""}" type="button">ငွေထုတ်</button>
              <button id="tableFilterDeposit" class="mini-button ${state.filterType === "ငွေသွင်း" ? "active-filter" : ""}" type="button">ငွေသွင်း</button>
            </div>
            <div class="pagination-actions">
              <button id="paginationPrevButton" class="secondary-button pagination-arrow" type="button" aria-label="Previous page" ${pagination.currentPage === 1 ? "disabled" : ""}>${getPaginationArrowSvg("left")}</button>
              <label class="pagination-input-group">
                <span>Page</span>
                <input id="paginationPageInput" class="pagination-page-input" type="number" min="1" max="${pagination.totalPages}" value="${pagination.currentPage}">
              </label>
              <span class="pagination-page">of ${pagination.totalPages}</span>
              <button id="paginationNextButton" class="secondary-button pagination-arrow" type="button" aria-label="Next page" ${pagination.currentPage === pagination.totalPages ? "disabled" : ""}>${getPaginationArrowSvg("right")}</button>
            </div>
          </div>
          <p class="pagination-copy">
            ${pagination.totalItems
              ? `Showing ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems} transactions`
              : "No transactions to show"}
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="column-date">Date</th>
                  <th class="column-type">Type</th>
                  <th class="column-name">Name</th>
                  <th class="column-phone">Phone</th>
                  <th class="column-amount">Amount</th>
                  ${isAdmin ? "<th class=\"column-profit\">Profit</th>" : ""}
                  <th class="column-created-by">Created By</th>
                  <th class="column-action">Action</th>
                </tr>
              </thead>
              <tbody>
                ${renderTransactionRows(paginatedTransactions, isAdmin)}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <button id="openModalButton" class="fab" type="button" aria-label="Create transaction">+</button>

      <div class="modal-backdrop ${state.modalOpen ? "visible" : ""}" id="modalBackdrop">
        <section class="modal-card">
          <div class="modal-header">
            <div>
              <p class="eyebrow dark">New Counter Transaction</p>
              <h2>${state.editingId ? "Edit Transaction" : "Create Transaction"}</h2>
            </div>
            <button id="closeModalButton" class="icon-button" type="button">x</button>
          </div>

          <form id="transactionForm" class="modal-form">
            <input id="transactionId" type="hidden" value="${escapeHtml(state.editingId)}">
            <label>
              <span>Transaction Type</span>
              <input id="transactionType" type="hidden" value="ငွေထုတ်">
              <div class="type-toggle-group" role="radiogroup" aria-label="Transaction Type">
                <button class="type-toggle-button active" data-transaction-type="ငွေထုတ်" aria-pressed="true" type="button">ငွေထုတ်</button>
                <button class="type-toggle-button" data-transaction-type="ငွေသွင်း" aria-pressed="false" type="button">ငွေသွင်း</button>
              </div>
            </label>
            <label>
              <span>Name</span>
              <input id="customerName" type="text" required placeholder="Customer name">
            </label>
            <label>
              <span>Money (MMK)</span>
              <input id="amount" type="number" min="0" step="0.01" required placeholder="Enter amount">
            </label>
            <label>
              <span>Phone Number (Optional)</span>
              <input id="phoneNumber" type="text" placeholder="09xxxxxxxxx">
            </label>
            <div class="image-import-card">
              <div>
                <span class="image-import-label">Image OCR Import</span>
                <p class="image-import-copy">Upload a receipt or screenshot and let the app create the transaction automatically.</p>
              </div>
              <button id="imageImportButton" class="secondary-button full-width" type="button">Upload Image And Create</button>
              <input id="imageImportInput" class="visually-hidden-input" type="file" accept="image/*">
            </div>
            <div class="preview-card">
              <span>Profit Rule Preview</span>
              <strong id="profitPreview">${isAdmin ? "0.00 MMK" : "Admin Only"}</strong>
            </div>
            <button class="primary-button full-width" type="submit">${state.editingId ? "Update Transaction" : "Save Transaction"}</button>
            <p id="transactionMessage" class="form-message"></p>
          </form>
        </section>
      </div>

      ${renderDetailsModal(isAdmin)}
      ${renderDeleteConfirmModal()}
    </div>
  `;
}

function renderTransactionRows(items, isAdmin) {
  if (!items.length) {
    return `<tr class="empty-row"><td colspan="${isAdmin ? 8 : 7}">No transactions yet. Click the plus button to create one.</td></tr>`;
  }

  return items.map((tx) => `
    <tr>
      <td class="column-date" data-label="Date">${escapeHtml(tx.createdAt)}</td>
      <td class="column-type" data-label="Type"><span class="type-badge ${tx.type === "ငွေထုတ်" ? "withdraw" : "deposit"}">${escapeHtml(tx.type)}</span></td>
      <td class="column-name" data-label="Name">${escapeHtml(tx.customerName)}</td>
      <td class="column-phone" data-label="Phone">${escapeHtml(tx.phoneNumber || "-")}</td>
      <td class="column-amount" data-label="Amount">${formatAmount(tx.amount)}</td>
      ${isAdmin ? `<td class="column-profit money-positive" data-label="Profit">${formatProfit(tx.profit)}</td>` : ""}
      <td class="column-created-by" data-label="Created By">${escapeHtml(tx.createdByName)}</td>
      <td class="column-action" data-label="Action">
        <div class="row-actions">
          <button class="icon-action-button" data-action="details" data-id="${escapeHtml(tx.id)}" type="button" aria-label="View details" title="View details">${getActionIconSvg("details")}</button>
          <button class="icon-action-button" data-action="edit" data-id="${escapeHtml(tx.id)}" type="button" aria-label="Edit transaction" title="Edit transaction">${getActionIconSvg("edit")}</button>
          <button class="icon-action-button danger" data-action="delete" data-id="${escapeHtml(tx.id)}" type="button" aria-label="Delete transaction" title="Delete transaction">${getActionIconSvg("delete")}</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderDetailsModal(isAdmin) {
  const tx = state.detailsId ? state.transactions.find((item) => item.id === state.detailsId) : null;
  return `
    <div class="modal-backdrop ${tx ? "visible" : ""}" id="detailsBackdrop">
      ${tx ? getDetailsModalContent(tx, isAdmin) : ""}
    </div>
  `;
}

function renderDeleteConfirmModal() {
  const tx = state.deleteConfirmId ? state.transactions.find((item) => item.id === state.deleteConfirmId) : null;
  return `
    <div class="modal-backdrop ${tx ? "visible" : ""}" id="deleteConfirmBackdrop">
      ${tx ? getDeleteConfirmModalContent(tx) : ""}
    </div>
  `;
}

function getActionIconSvg(type) {
  if (type === "edit") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10-10-4-4L4 16v4Z"></path>
        <path d="M13 7l4 4"></path>
      </svg>
    `;
  }

  if (type === "delete") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18"></path>
        <path d="M8 6V4h8v2"></path>
        <path d="M19 6l-1 14H6L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
}

function bindEvents() {
  bindAuthEvents();
  bindDashboardEvents();
}

function bindAuthEvents() {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const themeToggleAuth = document.getElementById("themeToggleAuth");
  const passwordToggles = document.querySelectorAll("[data-password-toggle]");

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authTab = button.dataset.authTab;
      render();
    });
  });

  passwordToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) {
        return;
      }

      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "Show" : "Hide";
    });
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = normalizeText(document.getElementById("loginUsername").value);
      const password = document.getElementById("loginPassword").value;
      const message = document.getElementById("loginMessage");

      message.textContent = "";

      try {
        const payload = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });

        state.sessionUser = payload.user;
        state.transactions = payload.transactions;
        state.modalOpen = false;
        state.editingId = "";
        render();
      } catch (error) {
        message.textContent = error.message;
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fullName = document.getElementById("signupName").value.trim();
      const username = document.getElementById("signupUsername").value.trim();
      const password = document.getElementById("signupPassword").value;
      const message = document.getElementById("signupMessage");

      message.textContent = "";

      try {
        const payload = await api("/api/signup", {
          method: "POST",
          body: JSON.stringify({ fullName, username, password })
        });

        message.textContent = payload.message;
        signupForm.reset();
        state.authTab = "login";
        setTimeout(() => render(), 350);
      } catch (error) {
        message.textContent = error.message;
      }
    });
  }

  if (themeToggleAuth) {
    themeToggleAuth.addEventListener("click", toggleTheme);
  }
}

function bindDashboardEvents() {
  const user = getCurrentUser();
  if (!user) {
    return;
  }

  const headerLogoutButton = document.getElementById("headerLogoutButton");
  const openModalButton = document.getElementById("openModalButton");
  const closeModalButton = document.getElementById("closeModalButton");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const detailsBackdrop = document.getElementById("detailsBackdrop");
  const closeDetailsButton = document.getElementById("closeDetailsButton");
  const deleteConfirmBackdrop = document.getElementById("deleteConfirmBackdrop");
  const closeDeleteConfirmButton = document.getElementById("closeDeleteConfirmButton");
  const cancelDeleteConfirmButton = document.getElementById("cancelDeleteConfirmButton");
  const confirmDeleteButton = document.getElementById("confirmDeleteButton");
  const transactionForm = document.getElementById("transactionForm");
  const searchInput = document.getElementById("searchInput");
  const dateFilterToggleButton = document.getElementById("dateFilterToggleButton");
  const dateFilterInput = document.getElementById("dateFilterInput");
  const clearDateFilterButton = document.getElementById("clearDateFilterButton");
  const themeToggleDashboard = document.getElementById("themeToggleDashboard");
  const imageImportButton = document.getElementById("imageImportButton");
  const imageImportInput = document.getElementById("imageImportInput");
  const typeSelect = document.getElementById("transactionType");
  const typeToggleButtons = document.querySelectorAll("[data-transaction-type]");
  const amountInput = document.getElementById("amount");
  const tableFilterAll = document.getElementById("tableFilterAll");
  const tableFilterWithdraw = document.getElementById("tableFilterWithdraw");
  const tableFilterDeposit = document.getElementById("tableFilterDeposit");
  const paginationPrevButton = document.getElementById("paginationPrevButton");
  const paginationNextButton = document.getElementById("paginationNextButton");
  const paginationPageInput = document.getElementById("paginationPageInput");

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filterType = button.dataset.filter;
      state.currentPage = 1;
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === "delete") {
        openDeleteConfirm(id);
        return;
      }

      if (action === "edit") {
        const tx = state.transactions.find((item) => item.id === id);
        if (!tx) {
          return;
        }

        openEditModal(tx);
      }

      if (action === "details") {
        openDetailsModal(id);
      }
    });
  });

  if (headerLogoutButton) {
    headerLogoutButton.addEventListener("click", async () => {
      try {
        await api("/api/logout", { method: "POST" });
      } finally {
        state.sessionUser = null;
        state.transactions = [];
        state.modalOpen = false;
        state.editingId = "";
        render();
      }
    });
  }

  if (openModalButton) {
    openModalButton.addEventListener("click", () => {
      openCreateModal();
    });
  }

  if (closeModalButton) {
    closeModalButton.addEventListener("click", closeModal);
  }

  if (closeDetailsButton) {
    closeDetailsButton.addEventListener("click", closeDetailsModal);
  }

  if (closeDeleteConfirmButton) {
    closeDeleteConfirmButton.addEventListener("click", closeDeleteConfirm);
  }

  if (cancelDeleteConfirmButton) {
    cancelDeleteConfirmButton.addEventListener("click", closeDeleteConfirm);
  }

  if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener("click", confirmDeleteTransaction);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (event) => {
      if (event.target === modalBackdrop) {
        closeModal();
      }
    });
  }

  if (detailsBackdrop) {
    detailsBackdrop.addEventListener("click", (event) => {
      if (event.target === detailsBackdrop) {
        closeDetailsModal();
      }
    });
  }

  if (deleteConfirmBackdrop) {
    deleteConfirmBackdrop.addEventListener("click", (event) => {
      if (event.target === deleteConfirmBackdrop) {
        closeDeleteConfirm();
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      const nextValue = event.target.value;
      if (!nextValue.trim()) {
        state.search = "";
        render();
      }
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        state.search = event.target.value.trim();
        state.currentPage = 1;
        render();
      }
    });
  }

  if (dateFilterInput) {
    dateFilterInput.addEventListener("input", (event) => {
      state.filterDate = event.target.value;
      state.currentPage = 1;
      render();
    });
  }

  if (dateFilterToggleButton && dateFilterInput) {
    dateFilterToggleButton.addEventListener("click", () => {
      if (typeof dateFilterInput.showPicker === "function") {
        dateFilterInput.showPicker();
        return;
      }

      dateFilterInput.click();
    });
  }

  if (clearDateFilterButton) {
    clearDateFilterButton.addEventListener("click", () => {
      state.filterDate = "";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterAll) {
    tableFilterAll.addEventListener("click", () => {
      state.filterType = "all";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterWithdraw) {
    tableFilterWithdraw.addEventListener("click", () => {
      state.filterType = "ငွေထုတ်";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterDeposit) {
    tableFilterDeposit.addEventListener("click", () => {
      state.filterType = "ငွေသွင်း";
      state.currentPage = 1;
      render();
    });
  }

  if (paginationPrevButton) {
    paginationPrevButton.addEventListener("click", () => {
      state.currentPage = Math.max(1, state.currentPage - 1);
      render();
    });
  }

  if (paginationNextButton) {
    paginationNextButton.addEventListener("click", () => {
      const pagination = getPaginationState(getVisibleTransactions().length);
      state.currentPage = Math.min(pagination.totalPages, state.currentPage + 1);
      render();
    });
  }

  if (paginationPageInput) {
    const applyPageInput = () => {
      const pagination = getPaginationState(getVisibleTransactions().length);
      const rawValue = Number(paginationPageInput.value);
      if (!Number.isFinite(rawValue)) {
        paginationPageInput.value = String(state.currentPage);
        return;
      }

      state.currentPage = Math.min(pagination.totalPages, Math.max(1, Math.trunc(rawValue)));
      render();
    };

    paginationPageInput.addEventListener("change", applyPageInput);
    paginationPageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyPageInput();
      }
    });
  }

  if (themeToggleDashboard) {
    themeToggleDashboard.addEventListener("click", toggleTheme);
  }

  typeToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTransactionType(button.dataset.transactionType);
      updateProfitPreview();
    });
  });

  if (typeSelect) {
    updateTransactionTypeButtons(typeSelect.value);
  }

  if (amountInput) {
    amountInput.addEventListener("input", updateProfitPreview);
  }

  if (transactionForm) {
    transactionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const type = document.getElementById("transactionType").value;
      const customerName = document.getElementById("customerName").value.trim();
      const amount = toNumber(document.getElementById("amount").value);
      const phoneNumber = document.getElementById("phoneNumber").value.trim();
      const message = document.getElementById("transactionMessage");

      if (!customerName || amount <= 0) {
        message.textContent = "Name and money are required.";
        return;
      }

      message.textContent = "";

      try {
        const endpoint = state.editingId
          ? `/api/transactions/${encodeURIComponent(state.editingId)}`
          : "/api/transactions";
        const method = state.editingId ? "PUT" : "POST";
        const payload = await api(endpoint, {
          method,
          body: JSON.stringify({ type, customerName, amount, phoneNumber })
        });

        if (state.editingId) {
          state.transactions = state.transactions.map((tx) => (
            tx.id === payload.transaction.id ? payload.transaction : tx
          ));
        } else {
          state.transactions.unshift(payload.transaction);
          state.currentPage = 1;
        }

        closeModal();
        render();
      } catch (error) {
        message.textContent = error.message;
      }
    });
  }

  if (imageImportButton && imageImportInput) {
    imageImportButton.addEventListener("click", () => {
      imageImportInput.click();
    });

    imageImportInput.addEventListener("change", async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";

      if (!file) {
        return;
      }

      const message = document.getElementById("transactionMessage");
      const originalLabel = imageImportButton.textContent;

      imageImportButton.disabled = true;
      imageImportButton.textContent = "Reading image...";
      if (message) {
        message.textContent = "Scanning image and creating transaction...";
      }

      try {
        const imageDataUrl = await prepareImageForUpload(file);
        imageImportButton.textContent = "Creating transaction...";
        const payload = await api("/api/transactions/import-image", {
          method: "POST",
          body: JSON.stringify({ imageDataUrl })
        });

        const importedTransactions = Array.isArray(payload.transactions)
          ? payload.transactions
          : (payload.transaction ? [payload.transaction] : []);

        if (!importedTransactions.length) {
          throw new Error("No transactions were created from that image.");
        }

        state.transactions = [...importedTransactions, ...state.transactions];
        closeModal();
        render();
        window.alert(
          importedTransactions.length === 1
            ? `Transaction created from image for ${importedTransactions[0].customerName}.`
            : `${importedTransactions.length} transactions were created from the uploaded image.`
        );
      } catch (error) {
        if (message) {
          message.textContent = error.message;
        }
      } finally {
        imageImportButton.disabled = false;
        imageImportButton.textContent = originalLabel;
      }
    });
  }

  updateProfitPreview();
}

function closeModal() {
  state.modalOpen = false;
  state.editingId = "";
  render();
}

function closeDetailsModal() {
  state.detailsId = "";
  const detailsBackdrop = document.getElementById("detailsBackdrop");
  if (detailsBackdrop) {
    detailsBackdrop.classList.remove("visible");
    detailsBackdrop.innerHTML = "";
  }
}

function getDetailsModalContent(tx, isAdmin) {
  return `
    <section class="modal-card details-card">
      <div class="modal-header">
        <div>
          <p class="eyebrow dark">Transaction Details</p>
          <h2>${escapeHtml(tx.customerName)}</h2>
        </div>
        <button id="closeDetailsButton" class="icon-button" type="button" aria-label="Close details">x</button>
      </div>
      <div class="details-grid">
        <div class="details-item"><span>Date</span><strong>${escapeHtml(tx.createdAt)}</strong></div>
        <div class="details-item"><span>Type</span><strong>${escapeHtml(tx.type)}</strong></div>
        <div class="details-item"><span>Name</span><strong>${escapeHtml(tx.customerName)}</strong></div>
        <div class="details-item"><span>Phone</span><strong>${escapeHtml(tx.phoneNumber || "-")}</strong></div>
        <div class="details-item"><span>Amount</span><strong>${formatAmount(tx.amount)}</strong></div>
        ${isAdmin ? `<div class="details-item"><span>Profit</span><strong class="money-positive">${formatProfit(tx.profit)}</strong></div>` : ""}
        <div class="details-item"><span>Created By</span><strong>${escapeHtml(tx.createdByName)}</strong></div>
      </div>
    </section>
  `;
}

function openDeleteConfirm(id) {
  const tx = state.transactions.find((item) => item.id === id);
  const deleteConfirmBackdrop = document.getElementById("deleteConfirmBackdrop");

  state.deleteConfirmId = id;

  if (!tx || !deleteConfirmBackdrop) {
    render();
    return;
  }

  deleteConfirmBackdrop.innerHTML = getDeleteConfirmModalContent(tx);
  deleteConfirmBackdrop.classList.add("visible");

  const closeButton = document.getElementById("closeDeleteConfirmButton");
  const cancelButton = document.getElementById("cancelDeleteConfirmButton");
  const confirmButton = document.getElementById("confirmDeleteButton");

  if (closeButton) {
    closeButton.addEventListener("click", closeDeleteConfirm);
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", closeDeleteConfirm);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", confirmDeleteTransaction);
  }

  window.requestAnimationFrame(() => {
    const nextConfirmButton = document.getElementById("confirmDeleteButton");
    if (nextConfirmButton) {
      nextConfirmButton.focus({ preventScroll: true });
    }
  });
}

function closeDeleteConfirm() {
  state.deleteConfirmId = "";
  const deleteConfirmBackdrop = document.getElementById("deleteConfirmBackdrop");
  if (deleteConfirmBackdrop) {
    deleteConfirmBackdrop.classList.remove("visible");
    deleteConfirmBackdrop.innerHTML = "";
  }
}

async function confirmDeleteTransaction() {
  const id = state.deleteConfirmId;
  if (!id) {
    return;
  }

  try {
    await api(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.transactions = state.transactions.filter((tx) => tx.id !== id);
    state.deleteConfirmId = "";
    state.detailsId = state.detailsId === id ? "" : state.detailsId;
    render();
  } catch (error) {
    window.alert(error.message);
  }
}

function getDeleteConfirmModalContent(tx) {
  return `
    <section class="modal-card confirm-card">
      <div class="modal-header">
        <div>
          <p class="eyebrow dark">Delete Transaction</p>
          <h2>Delete this transaction?</h2>
        </div>
        <button id="closeDeleteConfirmButton" class="icon-button" type="button" aria-label="Close delete confirmation">x</button>
      </div>
      <p class="confirm-copy">
        Are you sure you want to delete <strong>${escapeHtml(tx.customerName)}</strong> for <strong>${formatAmount(tx.amount)}</strong>?
      </p>
      <div class="confirm-actions">
        <button id="cancelDeleteConfirmButton" class="secondary-button" type="button">Cancel</button>
        <button id="confirmDeleteButton" class="secondary-button danger-button" type="button">Delete</button>
      </div>
    </section>
  `;
}

function openDetailsModal(id) {
  const tx = state.transactions.find((item) => item.id === id);
  const detailsBackdrop = document.getElementById("detailsBackdrop");
  const user = getCurrentUser();

  state.detailsId = id;

  if (!tx || !detailsBackdrop) {
    render();
    return;
  }

  detailsBackdrop.innerHTML = getDetailsModalContent(tx, user?.role === "admin");
  detailsBackdrop.classList.add("visible");

  const closeButton = document.getElementById("closeDetailsButton");
  if (closeButton) {
    closeButton.addEventListener("click", closeDetailsModal);
  }

  window.requestAnimationFrame(() => {
    const nextCloseButton = document.getElementById("closeDetailsButton");
    if (nextCloseButton) {
      nextCloseButton.focus({ preventScroll: true });
    }
  });
}

function openCreateModal() {
  state.modalOpen = true;
  state.editingId = "";

  const modalBackdrop = document.getElementById("modalBackdrop");
  const transactionForm = document.getElementById("transactionForm");
  const transactionId = document.getElementById("transactionId");
  const transactionType = document.getElementById("transactionType");
  const customerName = document.getElementById("customerName");
  const amount = document.getElementById("amount");
  const phoneNumber = document.getElementById("phoneNumber");
  const message = document.getElementById("transactionMessage");

  if (!modalBackdrop || !transactionForm || !transactionType || !customerName || !amount || !phoneNumber) {
    render();
    updateProfitPreview();
    return;
  }

  transactionForm.reset();
  if (transactionId) {
    transactionId.value = "";
  }
  transactionType.value = "ငွေထုတ်";
  customerName.value = "";
  amount.value = "";
  phoneNumber.value = "";
  if (message) {
    message.textContent = "";
  }
  const imageImportInput = document.getElementById("imageImportInput");
  if (imageImportInput) {
    imageImportInput.value = "";
  }

  modalBackdrop.classList.add("visible");

  window.requestAnimationFrame(() => {
    updateProfitPreview();
    customerName.focus({ preventScroll: true });
  });
}

function openEditModal(tx) {
  state.modalOpen = true;
  state.editingId = tx.id;

  const modalBackdrop = document.getElementById("modalBackdrop");
  const transactionId = document.getElementById("transactionId");
  const transactionType = document.getElementById("transactionType");
  const customerName = document.getElementById("customerName");
  const amount = document.getElementById("amount");
  const phoneNumber = document.getElementById("phoneNumber");
  const heading = document.querySelector("#modalBackdrop .modal-header h2");
  const submitButton = document.querySelector("#transactionForm button[type=\"submit\"]");
  const message = document.getElementById("transactionMessage");

  if (!modalBackdrop || !transactionType || !customerName || !amount || !phoneNumber) {
    render();
    window.requestAnimationFrame(() => {
      const nextCustomerName = document.getElementById("customerName");
      const nextAmount = document.getElementById("amount");
      const nextPhoneNumber = document.getElementById("phoneNumber");

      if (nextCustomerName && nextAmount && nextPhoneNumber) {
        setTransactionType(tx.type);
        nextCustomerName.value = tx.customerName;
        nextAmount.value = tx.amount;
        nextPhoneNumber.value = tx.phoneNumber || "";
        updateProfitPreview();
      }
    });
    return;
  }

  modalBackdrop.classList.add("visible");
  if (transactionId) {
    transactionId.value = tx.id;
  }
  transactionType.value = tx.type;
  customerName.value = tx.customerName;
  amount.value = tx.amount;
  phoneNumber.value = tx.phoneNumber || "";
  if (heading) {
    heading.textContent = "Edit Transaction";
  }
  if (submitButton) {
    submitButton.textContent = "Update Transaction";
  }
  if (message) {
    message.textContent = "";
  }

  window.requestAnimationFrame(() => {
    setTransactionType(tx.type);
    updateProfitPreview();
    customerName.focus({ preventScroll: true });
  });
}

function toggleTheme() {
  document.body.classList.add("theme-switching");
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveTheme(state.theme);
  render();
  window.setTimeout(() => {
    document.body.classList.remove("theme-switching");
  }, 420);
}

function updateProfitPreview() {
  const user = getCurrentUser();
  const preview = document.getElementById("profitPreview");
  const typeInput = document.getElementById("transactionType");
  const amountInput = document.getElementById("amount");

  if (!preview || !typeInput || !amountInput) {
    return;
  }

  if (!user || user.role !== "admin") {
    preview.textContent = "Admin Only";
    return;
  }

  preview.textContent = formatProfit(calculateProfit(typeInput.value, amountInput.value));
}

async function prepareImageForUpload(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  const image = await loadImageElement(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image processing is not supported in this browser.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Could not read that image."));
    };

    image.src = imageUrl;
  });
}

function setTransactionType(type) {
  const input = document.getElementById("transactionType");
  if (!input) {
    return;
  }

  input.value = type;
  updateTransactionTypeButtons(type);
}

function updateTransactionTypeButtons(activeType) {
  document.querySelectorAll("[data-transaction-type]").forEach((button) => {
    const isActive = button.dataset.transactionType === activeType;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getCurrentUser() {
  return state.sessionUser;
}

function getVisibleTransactions() {
  return state.transactions
    .filter((tx) => {
      const typeMatch = state.filterType === "all" || tx.type === state.filterType;
      const haystack = normalizeText(`${tx.customerName} ${tx.phoneNumber} ${tx.type} ${tx.createdByName}`);
      const searchMatch = !state.search || haystack.includes(normalizeText(state.search));
      const dateMatch = !state.filterDate || getTransactionDate(tx.createdAt) === state.filterDate;
      return typeMatch && searchMatch && dateMatch;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getPaginationState(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / TRANSACTIONS_PER_PAGE));
  const currentPage = Math.min(state.currentPage, totalPages);
  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = startIndex + TRANSACTIONS_PER_PAGE;

  state.currentPage = currentPage;

  return {
    totalItems,
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    startItem: totalItems ? startIndex + 1 : 0,
    endItem: totalItems ? Math.min(endIndex, totalItems) : 0
  };
}

function summarizeTransactions(items) {
  return items.reduce((summary, tx) => {
    const amount = toNumber(tx.amount);
    const profit = toNumber(tx.profit);

    summary.count += 1;
    summary.amount += amount;
    summary.profit += profit;

    if (!summary.byType[tx.type]) {
      summary.byType[tx.type] = { count: 0, amount: 0, profit: 0 };
    }

    summary.byType[tx.type].count += 1;
    summary.byType[tx.type].amount += amount;
    summary.byType[tx.type].profit += profit;
    return summary;
  }, {
    count: 0,
    amount: 0,
    profit: 0,
    byType: {}
  });
}

function getTransactionDate(createdAt) {
  return String(createdAt || "").slice(0, 10);
}

function getDateProfitTransactions(items) {
  if (state.filterDate) {
    return items;
  }

  const todayPrefix = getTodayDatePrefix();
  return items.filter((tx) => getTransactionDate(tx.createdAt) === todayPrefix);
}

function getTodayDatePrefix() {
  return getDatePartsInAppTimeZone().date;
}

function getDatePartsInAppTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function getDateProfitLabel() {
  if (state.filterDate) {
    return `Profit On ${state.filterDate}`;
  }

  return `Profit On ${getTodayDatePrefix()}`;
}

async function hydrateSession() {
  try {
    const payload = await api("/api/session");
    state.sessionUser = payload.user;
    state.transactions = payload.transactions || [];
  } catch {
    state.sessionUser = null;
    state.transactions = [];
  } finally {
    state.loading = false;
    render();
  }
}

async function api(url, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${url}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      credentials: API_BASE ? "include" : "same-origin",
      body: options.body
    });
  } catch (error) {
    throw new Error("Cannot reach the server. Open the app from http://127.0.0.1:4173 or make sure npm start is running.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numeric = Number(String(value).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAmount(value) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)} MMK`;
}

function formatProfit(value) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)} MMK`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function calculateProfit(type, amount) {
  const numericAmount = toNumber(amount);

  if (type === "ငွေထုတ်") {
    return numericAmount < 100000 ? numericAmount * 0.01 : numericAmount * 0.005;
  }

  if (type === "ငွေသွင်း") {
    return numericAmount * 0.001;
  }

  return 0;
}

render();
hydrateSession();
