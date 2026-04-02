const THEME_KEY = "wallet-counter-pro-theme";
const LANGUAGE_KEY = "wallet-counter-pro-language";
const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:4173" : "";
const TRANSACTIONS_PER_PAGE = 10;
const APP_TIME_ZONE = "Asia/Yangon";
const MAX_NAME_LENGTH = 40;
const MAX_AMOUNT_DIGITS = 12;
const MAX_PHONE_DIGITS = 11;
const LANGUAGE_SWITCH_ANIMATION_MS = 220;

const state = {
  transactions: [],
  sessionUser: null,
  theme: loadTheme(),
  language: loadLanguage(),
  search: "",
  filterDate: "",
  filterTimeFrom: "",
  filterTimeTo: "",
  pendingFilterTimeFrom: "",
  pendingFilterTimeTo: "",
  timeFilterDraftActive: false,
  timePickerOpen: "",
  calendarOpen: false,
  calendarMonth: "",
  historyScope: "today",
  filterType: "all",
  currentPage: 1,
  modalOpen: false,
  navMenuOpen: false,
  detailsId: "",
  deleteConfirmId: "",
  editingId: "",
  authTab: "login",
  loading: true,
  pendingDuplicate: null
};

const app = document.getElementById("app");
const duplicateIndexCache = {
  transactions: null,
  counts: new Map()
};
let languageSwitchRenderTimer = 0;

const translations = {
  en: {
    loadingWorkspace: "Loading workspace",
    connectingData: "Connecting to your data and preparing the dashboard.",
    pleaseWait: "Please wait...",
    counterAppTitle: "Counter app for KBZPay and WavePay teams",
    counterAppCopy: "Sign in as admin or cashier, create daily transactions quickly, and keep profit visibility limited to admin accounts.",
    admin: "Admin",
    adminCopy: "Can view profit and full dashboard metrics",
    cashier: "Cashier",
    cashierCopy: "Can create and manage transactions without profit visibility",
    login: "Login",
    signUp: "Sign Up",
    welcomeBack: "Welcome back",
    signInContinue: "Sign in to continue to the counter dashboard.",
    username: "Username",
    password: "Password",
    show: "Show",
    hide: "Hide",
    createAccount: "Create account",
    newSignupsCashierOnly: "New sign ups create cashier accounts only.",
    fullName: "Full Name",
    createAccountButton: "Create Account",
    logout: "Logout",
    operationsDashboard: "Operations Dashboard",
    dailyTransactions: "Daily Transactions",
    searchPlaceholder: "Search by customer, phone, or user",
    totalTransactions: "Total Transactions",
    totalAmount: "Total Amount",
    withdrawAmount: "Withdraw Amount",
    depositAmount: "Deposit Amount",
    adminOnly: "Admin Only",
    totalProfit: "Total Profit",
    profitByTransactionType: "Profit By Transaction Type",
    visibleOnlyAdmin: "Visible only to admin accounts.",
    withdrawProfit: "Withdraw Profit",
    depositProfit: "Deposit Profit",
    transactionList: "Transaction List",
    transactionListCopy: "The plus button creates new transactions with name, amount, and optional phone number.",
    today: "Today",
    allDates: "All Dates",
    all: "All",
    duplicated: "Duplicated",
    page: "Page",
    of: "of",
    showingTransactions: "Showing {start}-{end} of {total} transactions",
    noTransactionsToShow: "No transactions to show",
    date: "Date",
    type: "Type",
    name: "Name",
    phone: "Phone",
    amount: "Amount",
    profit: "Profit",
    createdBy: "Created By",
    action: "Action",
    noTransactionsYet: "No transactions yet. Click the plus button to create one.",
    viewDetails: "View details",
    editTransaction: "Edit transaction",
    deleteTransaction: "Delete transaction",
    openDateFilter: "Open date filter",
    changeDateFilterFrom: "Change date filter from {date}",
    dateFilterTitle: "Date filter: {date}",
    filterByDate: "Filter by date",
    dateFilter: "Date Filter",
    clear: "Clear",
    newCounterTransaction: "New Counter Transaction",
    editTransactionTitle: "Edit Transaction",
    createTransactionTitle: "Create Transaction",
    updateTransaction: "Update Transaction",
    saveTransaction: "Save Transaction",
    transactionType: "Transaction Type",
    customerName: "Name",
    customerNamePlaceholder: "Customer name",
    moneyMmk: "Money (MMK)",
    enterAmount: "Enter amount",
    phoneOptional: "Phone Number (Optional)",
    imageOcrImport: "Image OCR Import",
    imageOcrCopy: "Upload a receipt or screenshot, or take a photo, and let the app create the transaction automatically.",
    uploadImage: "Upload Image",
    takePhoto: "Take Photo",
    openingCamera: "Opening camera...",
    readingImage: "Reading image...",
    creatingTransaction: "Creating transaction...",
    scanningImage: "Scanning image and creating the transaction...",
    ocrNoDetails: "No transaction details were found in that image.",
    ocrNameUnclear: "OCR found the transaction, but the name was not clear. Please fill the name and save.",
    profitRulePreview: "Profit Rule Preview",
    detailsTitle: "Transaction Details",
    closeDetails: "Close details",
    duplicateStatus: "Duplicate Status",
    noDuplicateMatch: "No duplicate match",
    deleteTransactionHeading: "Delete Transaction",
    deleteQuestion: "Delete this transaction?",
    deleteCopy: "Are you sure you want to delete {name} for {amount}?",
    cancel: "Cancel",
    delete: "Delete",
    duplicateWarning: "Duplicate Warning",
    possibleDuplicate: "Possible duplicate transaction",
    duplicateCopy: "A transaction with the {basis} was already saved earlier on {date} at {time}.",
    goBack: "Go Back",
    saveAnyway: "Save Anyway",
    continueOnlyIfNew: "Continue only if this is really a new transaction.",
    sameNamePhoneAmount: "same name, phone number, and amount",
    sameNameAmountNoPhone: "same name, amount, and no phone number",
    profitOn: "Profit On {date}",
    nameRequired: "Name is required.",
    nameTooLong: "Name is too long. Please keep it within {count} characters.",
    nameInvalid: "Name can only contain letters and spaces.",
    nameNeedsSpaces: "Please add space btw words for the name.",
    amountRequired: "Amount must be greater than 0.",
    amountTooLarge: "Amount is too large. Please keep it within {count} digits.",
    phoneInvalid: "Phone number must start with 09 and have 9 to 11 digits.",
    cashierDuplicateBlocked: "This exact transaction was already saved within the last 10 minutes. Please check the list before saving again.",
    uploadImageOnly: "Please upload an image file.",
    imageProcessingUnsupported: "Image processing is not supported in this browser.",
    serverUnreachable: "Cannot reach the server. Open the app from http://127.0.0.1:4173 or make sure npm start is running.",
    requestFailed: "Request failed.",
    languageEnglish: "English",
    languageBurmese: "မြန်မာ",
    withdraw: "Withdraw",
    deposit: "Deposit"
  },
  my: {
    loadingWorkspace: "စနစ်ကို ဖွင့်နေသည်",
    connectingData: "ဒေတာများကို ချိတ်ဆက်ပြီး dashboard ကို ပြင်ဆင်နေသည်။",
    pleaseWait: "ခဏစောင့်ပါ...",
    counterAppTitle: "KBZPay နှင့် WavePay အဖွဲ့အတွက် ကောင်တာအက်ပ်",
    counterAppCopy: "Admin သို့မဟုတ် Cashier အဖြစ် ဝင်ရောက်ပြီး နေ့စဉ် transaction များကို မြန်မြန်ဆန်ဆန် ဖန်တီးနိုင်ပြီး profit ကို admin အကောင့်များသာ မြင်နိုင်ပါသည်။",
    admin: "Admin",
    adminCopy: "Profit နှင့် dashboard metrics အပြည့်အစုံကို ကြည့်နိုင်သည်",
    cashier: "Cashier",
    cashierCopy: "Profit မမြင်ဘဲ transaction များကို ဖန်တီးနှင့် စီမံနိုင်သည်",
    login: "အကောင့်ဝင်ရန်",
    signUp: "အကောင့်ဖွင့်ရန်",
    welcomeBack: "ပြန်လည်ကြိုဆိုပါသည်",
    signInContinue: "Counter dashboard ကို ဆက်လက်အသုံးပြုရန် အကောင့်ဝင်ပါ။",
    username: "Username",
    password: "Password",
    show: "ပြရန်",
    hide: "ဖျောက်ရန်",
    createAccount: "အကောင့်ဖွင့်ရန်",
    newSignupsCashierOnly: "အသစ်ဖွင့်သော account များသည် cashier account များသာ ဖြစ်မည်။",
    fullName: "အမည်အပြည့်အစုံ",
    createAccountButton: "အကောင့်ဖန်တီးရန်",
    logout: "ထွက်ရန်",
    operationsDashboard: "လုပ်ငန်းဆိုင်ရာ Dashboard",
    dailyTransactions: "နေ့စဉ် Transactions",
    searchPlaceholder: "အမည်၊ ဖုန်း၊ သို့မဟုတ် အသုံးပြုသူဖြင့် ရှာရန်",
    totalTransactions: "စုစုပေါင်း Transactions",
    totalAmount: "စုစုပေါင်း Amount",
    withdrawAmount: "ငွေထုတ် Amount",
    depositAmount: "ငွေသွင်း Amount",
    adminOnly: "Admin သီးသန့်",
    totalProfit: "စုစုပေါင်း Profit",
    profitByTransactionType: "Transaction အမျိုးအစားအလိုက် Profit",
    visibleOnlyAdmin: "Admin account များသာ မြင်နိုင်ပါသည်။",
    withdrawProfit: "ငွေထုတ် Profit",
    depositProfit: "ငွေသွင်း Profit",
    transactionList: "Transaction စာရင်း",
    transactionListCopy: "အပေါင်းခလုတ်ဖြင့် အမည်၊ amount နှင့် optional phone number ပါသော transaction အသစ်များ ဖန်တီးနိုင်သည်။",
    today: "ယနေ့",
    allDates: "ရက်စွဲအားလုံး",
    all: "အားလုံး",
    duplicated: "ထပ်နေသော",
    page: "စာမျက်နှာ",
    of: " / ",
    showingTransactions: "Transaction {total} ခုတွင် {start}-{end} ကို ပြနေသည်",
    noTransactionsToShow: "ပြရန် transaction မရှိသေးပါ",
    date: "ရက်စွဲ",
    type: "အမျိုးအစား",
    name: "အမည်",
    phone: "ဖုန်း",
    amount: "Amount",
    profit: "Profit",
    createdBy: "ဖန်တီးသူ",
    action: "လုပ်ဆောင်ချက်",
    noTransactionsYet: "Transaction မရှိသေးပါ။ အသစ်ဖန်တီးရန် plus button ကိုနှိပ်ပါ။",
    viewDetails: "အသေးစိတ်ကြည့်ရန်",
    editTransaction: "Transaction ပြင်ရန်",
    deleteTransaction: "Transaction ဖျက်ရန်",
    openDateFilter: "ရက်စွဲ filter ဖွင့်ရန်",
    changeDateFilterFrom: "{date} မှ ရက်စွဲ filter ပြောင်းရန်",
    dateFilterTitle: "ရက်စွဲ filter: {date}",
    filterByDate: "ရက်စွဲဖြင့် filter လုပ်ရန်",
    dateFilter: "ရက်စွဲ Filter",
    clear: "ရှင်းရန်",
    newCounterTransaction: "Counter Transaction အသစ်",
    editTransactionTitle: "Transaction ပြင်ရန်",
    createTransactionTitle: "Transaction ဖန်တီးရန်",
    updateTransaction: "Transaction ကို Update လုပ်ရန်",
    saveTransaction: "Transaction သိမ်းရန်",
    transactionType: "Transaction အမျိုးအစား",
    customerName: "အမည်",
    customerNamePlaceholder: "Customer name ကိုထည့်ပါ",
    moneyMmk: "ငွေပမာဏ (MMK)",
    enterAmount: "Amount ထည့်ပါ",
    phoneOptional: "ဖုန်းနံပါတ် (မဖြစ်မနေမဟုတ်)",
    imageOcrImport: "Image OCR Import",
    imageOcrCopy: "Voucher သို့မဟုတ် screenshot တင်ပါ၊ မဟုတ်လျှင် ဓာတ်ပုံရိုက်ပြီး app က transaction ကို အလိုအလျောက်ဖန်တီးပေးမည်။",
    uploadImage: "ပုံတင်ရန်",
    takePhoto: "ဓာတ်ပုံရိုက်ရန်",
    openingCamera: "ကင်မရာဖွင့်နေသည်...",
    readingImage: "ပုံကို ဖတ်နေသည်...",
    creatingTransaction: "Transaction ဖန်တီးနေသည်...",
    scanningImage: "ပုံကို scan လုပ်ပြီး transaction ဖန်တီးနေသည်...",
    ocrNoDetails: "ဤပုံထဲတွင် transaction အသေးစိတ်ကို မတွေ့ပါ။",
    ocrNameUnclear: "OCR က transaction ကို တွေ့ခဲ့ပေမယ့် အမည်က မရှင်းလင်းပါ။ အမည်ဖြည့်ပြီး save လုပ်ပါ။",
    profitRulePreview: "Profit ကြိုတင်ကြည့်ရှုမှု",
    detailsTitle: "Transaction အသေးစိတ်",
    closeDetails: "အသေးစိတ်ပိတ်ရန်",
    duplicateStatus: "ထပ်နေမှု အခြေအနေ",
    noDuplicateMatch: "ထပ်နေမှု မတွေ့ပါ",
    deleteTransactionHeading: "Transaction ဖျက်ရန်",
    deleteQuestion: "ဤ transaction ကို ဖျက်မလား?",
    deleteCopy: "{name} ၏ {amount} transaction ကို ဖျက်ချင်ပါသလား?",
    cancel: "မလုပ်တော့ပါ",
    delete: "ဖျက်ရန်",
    duplicateWarning: "ထပ်နေမှု သတိပေးချက်",
    possibleDuplicate: "ထပ်နေသော transaction ဖြစ်နိုင်သည်",
    duplicateCopy: "{basis} တူညီသော transaction ကို {date} ရက် {time} အချိန်တွင် သိမ်းထားပြီးဖြစ်သည်။",
    goBack: "နောက်သို့",
    saveAnyway: "သိမ်းမည်",
    continueOnlyIfNew: "တကယ်အသစ်ဖြစ်မှသာ ဆက်လုပ်ပါ။",
    sameNamePhoneAmount: "အမည်၊ ဖုန်းနံပါတ် နှင့် amount တူညီသော",
    sameNameAmountNoPhone: "အမည်၊ amount တူပြီး ဖုန်းမပါသော",
    profitOn: "{date} ရက် Profit",
    nameRequired: "အမည် လိုအပ်ပါသည်။",
    nameTooLong: "အမည်သည် အရမ်းရှည်နေပါသည်။ {count} လုံးအတွင်းသာ ထည့်ပါ။",
    nameInvalid: "အမည်တွင် စာလုံးများနှင့် space များသာ ထည့်နိုင်ပါသည်။",
    nameNeedsSpaces: "အမည်အတွက် စကားလုံးများကြား space ထည့်ပေးပါ။",
    amountRequired: "Amount သည် 0 ထက် ကြီးရပါမည်။",
    amountTooLarge: "Amount အရမ်းကြီးနေပါသည်။ {count} လုံးအတွင်းသာ ထည့်ပါ။",
    phoneInvalid: "ဖုန်းနံပါတ်သည် 09 ဖြင့် စပြီး 9 မှ 11 လုံးရှိရပါမည်။",
    cashierDuplicateBlocked: "ဤ transaction တူညီမှုကို နောက်ဆုံး ၁၀ မိနစ်အတွင်း သိမ်းထားပြီးဖြစ်ပါသည်။ ပြန်မသိမ်းမီ စာရင်းကို စစ်ဆေးပါ။",
    uploadImageOnly: "Image ဖိုင်ကိုသာ တင်ပါ။",
    imageProcessingUnsupported: "ဤ browser တွင် image processing မပံ့ပိုးပါ။",
    serverUnreachable: "Server ကို မချိတ်ဆက်နိုင်ပါ။ http://127.0.0.1:4173 မှ ဖွင့်ထားကြောင်း သို့မဟုတ် npm start အလုပ်လုပ်နေကြောင်း စစ်ပါ။",
    requestFailed: "Request မအောင်မြင်ပါ။",
    languageEnglish: "English",
    languageBurmese: "မြန်မာ",
    withdraw: "ငွေထုတ်",
    deposit: "ငွေသွင်း"
  }
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  });
}

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

function loadLanguage() {
  try {
    const value = window.localStorage.getItem(LANGUAGE_KEY);
    return value === "en" ? "en" : "my";
  } catch {
    return "my";
  }
}

function saveLanguage(value) {
  window.localStorage.setItem(LANGUAGE_KEY, value);
}

function syncLanguageSwitchUi(nextLanguage) {
  document.querySelectorAll(".language-switch-shell").forEach((element) => {
    element.classList.toggle("english-active", nextLanguage === "en");
    element.classList.toggle("myanmar-active", nextLanguage !== "en");
  });

  document.querySelectorAll("[data-language-switch]").forEach((button) => {
    const isActive = button.dataset.languageSwitch === nextLanguage;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setLanguage(nextLanguage) {
  const normalizedLanguage = nextLanguage === "en" ? "en" : "my";
  if (normalizedLanguage === state.language) {
    return;
  }

  if (languageSwitchRenderTimer) {
    window.clearTimeout(languageSwitchRenderTimer);
  }

  syncLanguageSwitchUi(normalizedLanguage);

  languageSwitchRenderTimer = window.setTimeout(() => {
    state.navMenuOpen = false;
    state.language = normalizedLanguage;
    saveLanguage(normalizedLanguage);
    languageSwitchRenderTimer = 0;
    render();
  }, LANGUAGE_SWITCH_ANIMATION_MS);
}

function t(key, vars = {}) {
  const languagePack = translations[state.language] || translations.my;
  const fallbackPack = translations.en;
  let template = languagePack[key] || fallbackPack[key] || key;
  Object.entries(vars).forEach(([name, value]) => {
    template = template.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  });
  return template;
}

function translateTransactionType(value) {
  if (value === "ငွေထုတ်") {
    return state.language === "en" ? t("withdraw") : "ငွေထုတ်";
  }
  if (value === "ငွေသွင်း") {
    return state.language === "en" ? t("deposit") : "ငွေသွင်း";
  }
  return value;
}

function translateRole(value) {
  const normalized = normalizeText(value);
  if (normalized === "admin") {
    return t("admin");
  }
  if (normalized === "cashier") {
    return t("cashier");
  }
  return value;
}

function renderLanguageSelect(selectId) {
  const isEnglish = state.language === "en";
  return `
    <div id="${selectId}" class="language-switch-shell ${isEnglish ? "english-active" : "myanmar-active"}" role="group" aria-label="Language">
      <button class="language-orbit-button language-orbit-button-myanmar ${state.language === "my" ? "active" : ""}" data-language-switch="my" type="button" aria-pressed="${state.language === "my"}" title="${t("languageBurmese")}">
        <span class="language-flag-orbit myanmar-orbit-flag">
          <span class="language-flag myanmar-flag"></span>
        </span>
      </button>
      <button class="language-orbit-button language-orbit-button-english ${state.language === "en" ? "active" : ""}" data-language-switch="en" type="button" aria-pressed="${state.language === "en"}" title="${t("languageEnglish")}">
        <span class="language-flag-orbit english-orbit-flag">
          <span class="language-flag english-flag"></span>
        </span>
      </button>
    </div>
  `;
}

function render() {
  document.body.setAttribute("data-theme", state.theme);

  if (state.loading) {
    app.innerHTML = `
      <main class="auth-shell">
        <section class="auth-hero">
          ${renderBrandLockup("hero-brand-lockup")}
          <h1>${t("loadingWorkspace")}</h1>
          <p>${t("connectingData")}</p>
        </section>
        <section class="auth-card">
          <div class="panel">
            <p class="subtle">${t("pleaseWait")}</p>
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

function getCloseIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12"></path>
      <path d="M18 6l-12 12"></path>
    </svg>
  `;
}

function getHamburgerIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16"></path>
      <path d="M4 12h16"></path>
      <path d="M4 17h16"></path>
    </svg>
  `;
}

function getBrandLogoSvg() {
  return `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g transform="translate(-3 0)">
        <path fill="currentColor" d="M18 18h6l5 23h18l7-19H27.5l-1.5-7H18z"></path>
        <circle cx="29" cy="48" r="4.5" fill="currentColor"></circle>
        <circle cx="45" cy="48" r="4.5" fill="currentColor"></circle>
        <rect x="30" y="14" width="6" height="8" rx="1.5" fill="currentColor"></rect>
        <rect x="38" y="12" width="8" height="10" rx="2" fill="currentColor"></rect>
        <path fill="currentColor" d="M24 20l3-9h7l-2 9z"></path>
        <path fill="currentColor" d="M47 14h5l-1 8h-5z"></path>
      </g>
    </svg>
  `;
}

function renderBrandLockup(extraClass = "") {
  const className = ["brand-lockup", extraClass].filter(Boolean).join(" ");
  return `
    <div class="${className}">
      <div class="brand-badge brand-logo-badge" aria-hidden="true">${getBrandLogoSvg()}</div>
      <div class="brand-wordmark">
        <strong>ZAW KHIN</strong>
        <span>Taste The Joy</span>
      </div>
    </div>
  `;
}

function renderAuth() {
  return `
    <main class="auth-shell">
      <section class="auth-hero">
        ${renderBrandLockup("hero-brand-lockup")}
        <h1>${t("counterAppTitle")}</h1>
        <p>${t("counterAppCopy")}</p>
        <div class="hero-points">
          <div><strong>${t("admin")}</strong><span>${t("adminCopy")}</span></div>
          <div><strong>${t("cashier")}</strong><span>${t("cashierCopy")}</span></div>
        </div>
      </section>

      <section class="auth-card">
        <div class="auth-topbar">
          <div class="auth-tabs">
            <button class="tab-button ${state.authTab === "login" ? "active" : ""}" data-auth-tab="login" type="button">${t("login")}</button>
            <button class="tab-button ${state.authTab === "signup" ? "active" : ""}" data-auth-tab="signup" type="button">${t("signUp")}</button>
          </div>
          <div class="auth-topbar-actions">
            ${renderLanguageSelect("languageSelectAuth")}
            <button id="themeToggleAuth" class="theme-toggle-button icon-only" type="button" aria-label="${getThemeLabel()}" title="${getThemeLabel()}">
              <span class="theme-toggle-icon">${getThemeIconSvg()}</span>
            </button>
          </div>
        </div>

        <form id="loginForm" class="auth-form ${state.authTab === "login" ? "" : "hidden"}">
          <h2>${t("welcomeBack")}</h2>
          <p class="subtle">${t("signInContinue")}</p>
          <label>
            <span>${t("username")}</span>
            <input id="loginUsername" type="text" required>
          </label>
          <label>
            <span>${t("password")}</span>
            <div class="password-field">
              <input id="loginPassword" type="password" required>
              <button class="password-toggle" data-password-toggle="loginPassword" type="button">${t("show")}</button>
            </div>
          </label>
          <button class="primary-button auth-button" type="submit">${t("login")}</button>
          <p id="loginMessage" class="form-message"></p>
        </form>

        <form id="signupForm" class="auth-form ${state.authTab === "signup" ? "" : "hidden"}">
          <h2>${t("createAccount")}</h2>
          <p class="subtle">${t("newSignupsCashierOnly")}</p>
          <label>
            <span>${t("fullName")}</span>
            <input id="signupName" type="text" required>
          </label>
          <label>
            <span>${t("username")}</span>
            <input id="signupUsername" type="text" required>
          </label>
          <label>
            <span>${t("password")}</span>
            <div class="password-field">
              <input id="signupPassword" type="password" required>
              <button class="password-toggle" data-password-toggle="signupPassword" type="button">${t("show")}</button>
            </div>
          </label>
          <button class="primary-button auth-button" type="submit">${t("createAccountButton")}</button>
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
  const closingSummary = summarizeClosingTransactions(getClosingSummaryTransactions(state.transactions));
  const closingSummaryLabel = getClosingSummaryLabel();
  const dateProfitLabel = getDateProfitLabel();
  const isAdmin = user.role === "admin";

  return `
    <div class="dashboard-page">
      <div class="dashboard-navbar-shell">
      <header class="dashboard-navbar">
        <div class="navbar-brand">${renderBrandLockup()}</div>
        <button id="navbarMenuButton" class="navbar-menu-button" type="button" aria-label="Toggle navigation menu" aria-expanded="${state.navMenuOpen ? "true" : "false"}">
          ${getHamburgerIconSvg()}
        </button>
        <div class="navbar-meta ${state.navMenuOpen ? "menu-open" : ""}">
          <div class="navbar-profile">
            <span class="profile-role">${escapeHtml(translateRole(user.role))}</span>
            <div>
              <strong>${escapeHtml(user.fullName)}</strong>
              <small>@${escapeHtml(user.username)}</small>
            </div>
          </div>
          <div class="navbar-actions">
            ${renderLanguageSelect("languageSelectDashboard")}
            <button id="themeToggleDashboard" class="theme-toggle-button icon-only" type="button" aria-label="${getThemeLabel()}" title="${getThemeLabel()}">
              <span class="theme-toggle-icon">${getThemeIconSvg()}</span>
            </button>
            <button id="headerLogoutButton" class="secondary-button danger-button" type="button">${t("logout")}</button>
          </div>
        </div>
      </header>
      </div>

      <div class="dashboard-shell navbar-layout">
      <main class="content">
        <header class="topbar">
          <div class="topbar-main">
            <div class="topbar-heading">
              <p class="eyebrow dark">${t("operationsDashboard")}</p>
              <h1>${t("dailyTransactions")}</h1>
            </div>
          </div>
          <div class="topbar-tools ${isAdmin ? "admin-tools" : ""}">
            <input id="searchInput" class="search-input" type="search" placeholder="${t("searchPlaceholder")}" value="${escapeHtml(state.search)}">
            ${isAdmin ? renderTimeFilterControls() : ""}
            <div class="date-filter-shell">
              <button
                id="dateFilterToggleButton"
                class="icon-button date-filter-toggle ${state.filterDate ? "active" : ""}"
                type="button"
                aria-label="${state.filterDate ? t("changeDateFilterFrom", { date: escapeHtml(state.filterDate) }) : t("openDateFilter")}"
                title="${state.filterDate ? t("dateFilterTitle", { date: escapeHtml(state.filterDate) }) : t("filterByDate")}"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                  <path d="M16 3v4"></path>
                  <path d="M8 3v4"></path>
                  <path d="M3 10h18"></path>
                </svg>
              </button>
              <input id="dateFilterInput" class="date-filter-input" type="hidden" value="${escapeHtml(state.filterDate)}">
              ${renderDateFilterPopover()}
            </div>
          </div>
        </header>

        <section class="stats-grid dashboard-stats-section">
          <article class="stat-card">
            <span>${t("totalTransactions")}</span>
            <strong>${summary.count}</strong>
          </article>
          <article class="stat-card">
            <span>${t("totalAmount")}</span>
            <strong>${formatAmount(summary.amount)}</strong>
          </article>
          <article class="stat-card">
            <span>${t("withdrawAmount")}</span>
            <strong>${formatAmount(summary.byType["ငွေထုတ်"] ? summary.byType["ငွေထုတ်"].amount : 0)}</strong>
          </article>
          <article class="stat-card">
            <span>${t("depositAmount")}</span>
            <strong>${formatAmount(summary.byType["ငွေသွင်း"] ? summary.byType["ငွေသွင်း"].amount : 0)}</strong>
          </article>
          <article class="stat-card accent">
            <span>${escapeHtml(dateProfitLabel)}</span>
            <strong>${isAdmin ? formatProfit(dateProfitSummary.profit) : t("adminOnly")}</strong>
          </article>
          ${isAdmin ? `
            <article class="stat-card accent total-profit-card">
              <span>${t("totalProfit")}</span>
              <strong>${formatProfit(summary.profit)}</strong>
            </article>
          ` : `
            <article class="stat-card restricted total-profit-card">
              <span>${t("totalProfit")}</span>
              <strong>${t("adminOnly")}</strong>
            </article>
          `}
        </section>

        ${isAdmin ? `
          <section class="panel compact-panel profit-summary-section">
            <div class="section-heading">
              <h2>${t("profitByTransactionType")}</h2>
              <p>${t("visibleOnlyAdmin")}</p>
            </div>
            <div class="type-summary-grid">
              <article class="type-card">
                <span>${t("withdrawProfit")}</span>
                <strong>${formatProfit(summary.byType["ငွေထုတ်"] ? summary.byType["ငွေထုတ်"].profit : 0)}</strong>
              </article>
              <article class="type-card">
                <span>${t("depositProfit")}</span>
                <strong>${formatProfit(summary.byType["ငွေသွင်း"] ? summary.byType["ငွေသွင်း"].profit : 0)}</strong>
              </article>
            </div>
          </section>
        ` : ""}

        <section class="panel transaction-list-section">
          <div class="section-heading">
            <h2>${t("transactionList")}</h2>
            <p>${t("transactionListCopy")}</p>
          </div>
          <div class="table-toolbar">
            <div class="table-toolbar-filters">
              <div class="table-filter-group">
                <button id="tableScopeToday" class="mini-button ${state.historyScope === "today" && !state.filterDate ? "active-filter" : ""}" type="button">${t("today")}</button>
                <button id="tableScopeAllDates" class="mini-button ${state.historyScope === "all" && !state.filterDate ? "active-filter" : ""}" type="button">${t("allDates")}</button>
              </div>
              <div class="table-filter-group">
                <button id="tableFilterAll" class="mini-button ${state.filterType === "all" ? "active-filter" : ""}" type="button">${t("all")}</button>
                <button id="tableFilterWithdraw" class="mini-button ${state.filterType === "ငွေထုတ်" ? "active-filter" : ""}" type="button">${translateTransactionType("ငွေထုတ်")}</button>
                <button id="tableFilterDeposit" class="mini-button ${state.filterType === "ငွေသွင်း" ? "active-filter" : ""}" type="button">${translateTransactionType("ငွေသွင်း")}</button>
                ${isAdmin ? `<button id="tableFilterDuplicated" class="mini-button ${state.filterType === "duplicated" ? "active-filter" : ""}" type="button">${t("duplicated")}</button>` : ""}
              </div>
            </div>
            <div class="pagination-actions">
              <button id="paginationPrevButton" class="secondary-button pagination-arrow" type="button" aria-label="Previous page" ${pagination.currentPage === 1 ? "disabled" : ""}>${getPaginationArrowSvg("left")}</button>
              <div class="pagination-center-group">
                <label class="pagination-input-group">
                  <span>${t("page")}</span>
                  <input id="paginationPageInput" class="pagination-page-input" type="number" min="1" max="${pagination.totalPages}" value="${pagination.currentPage}">
                </label>
                <span class="pagination-page">${t("of")} ${pagination.totalPages}</span>
              </div>
              <button id="paginationNextButton" class="secondary-button pagination-arrow" type="button" aria-label="Next page" ${pagination.currentPage === pagination.totalPages ? "disabled" : ""}>${getPaginationArrowSvg("right")}</button>
            </div>
          </div>
          <p class="pagination-copy">
            ${pagination.totalItems
              ? t("showingTransactions", { start: pagination.startItem, end: pagination.endItem, total: pagination.totalItems })
              : t("noTransactionsToShow")}
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="column-date">${t("date")}</th>
                  <th class="column-type">${t("type")}</th>
                  <th class="column-name">${t("name")}</th>
                  <th class="column-phone">${t("phone")}</th>
                  <th class="column-amount">${t("amount")}</th>
                  ${isAdmin ? `<th class="column-profit">${t("profit")}</th>` : ""}
                  <th class="column-created-by">${t("createdBy")}</th>
                  <th class="column-action">${t("action")}</th>
                </tr>
              </thead>
              <tbody>
                ${renderTransactionRows(paginatedTransactions, isAdmin)}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <button id="openModalButton" class="fab" type="button" aria-label="${t("createTransactionTitle")}">+</button>

      <div class="modal-backdrop ${state.modalOpen ? "visible" : ""}" id="modalBackdrop">
        <section class="modal-card">
          <div class="modal-header">
            <div>
              <p class="eyebrow dark">${t("newCounterTransaction")}</p>
              <h2>${state.editingId ? t("editTransactionTitle") : t("createTransactionTitle")}</h2>
            </div>
            <button id="closeModalButton" class="icon-button" type="button" aria-label="${t("clear")}">${getCloseIconSvg()}</button>
          </div>

          <form id="transactionForm" class="modal-form">
            <input id="transactionId" type="hidden" value="${escapeHtml(state.editingId)}">
            <label>
              <span>${t("transactionType")}</span>
              <input id="transactionType" type="hidden" value="ငွေထုတ်">
              <div class="type-toggle-group" role="radiogroup" aria-label="${t("transactionType")}">
                <button class="type-toggle-button active" data-transaction-type="ငွေထုတ်" aria-pressed="true" type="button">${translateTransactionType("ငွေထုတ်")}</button>
                <button class="type-toggle-button" data-transaction-type="ငွေသွင်း" aria-pressed="false" type="button">${translateTransactionType("ငွေသွင်း")}</button>
              </div>
            </label>
            <label>
              <span>${t("customerName")}</span>
              <input id="customerName" type="text" maxlength="40" required placeholder="${t("customerNamePlaceholder")}">
            </label>
            <label>
              <span>${t("moneyMmk")}</span>
              <input id="amount" type="text" inputmode="decimal" autocomplete="off" maxlength="15" required placeholder="${t("enterAmount")}">
            </label>
            <label>
              <span>${t("phoneOptional")}</span>
              <input id="phoneNumber" type="text" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="09xxxxxxxxx">
            </label>
            <div class="image-import-card">
              <div>
                <span class="image-import-label">${t("imageOcrImport")}</span>
                <p class="image-import-copy">${t("imageOcrCopy")}</p>
              </div>
              <div class="image-import-actions">
                <button id="imageImportButton" class="secondary-button full-width" type="button">${t("uploadImage")}</button>
                <button id="cameraImportButton" class="secondary-button full-width" type="button">${t("takePhoto")}</button>
              </div>
              <input id="imageImportInput" class="visually-hidden-input" type="file" accept="image/*">
              <input id="cameraImportInput" class="visually-hidden-input" type="file" accept="image/*" capture="environment">
            </div>
            <div class="preview-card">
              <span>${t("profitRulePreview")}</span>
              <strong id="profitPreview">${isAdmin ? "0.00 MMK" : t("adminOnly")}</strong>
            </div>
            <p id="transactionMessage" class="form-message transaction-message-banner hidden" role="alert" aria-live="polite"></p>
            <button class="primary-button full-width" type="submit">${state.editingId ? t("updateTransaction") : t("saveTransaction")}</button>
          </form>
        </section>
      </div>

      ${renderDetailsModal(isAdmin)}
      ${renderDeleteConfirmModal()}
      ${renderDuplicateConfirmModal()}
      </div>
    </div>
  `;
}

function renderTransactionRows(items, isAdmin) {
  if (!items.length) {
    return `<tr class="empty-row"><td colspan="${isAdmin ? 8 : 7}">${t("noTransactionsYet")}</td></tr>`;
  }

  return items.map((tx) => `
    <tr>
      <td class="column-date" data-label="${t("date")}">${escapeHtml(tx.createdAt)}</td>
      <td class="column-type" data-label="${t("type")}"><span class="type-badge ${tx.type === "ငွေထုတ်" ? "withdraw" : "deposit"}">${escapeHtml(translateTransactionType(tx.type))}</span></td>
      <td class="column-name" data-label="${t("name")}">
        ${renderTransactionNameCell(tx, isAdmin)}
      </td>
      <td class="column-phone" data-label="${t("phone")}">${escapeHtml(tx.phoneNumber || "-")}</td>
      <td class="column-amount" data-label="${t("amount")}">${formatAmount(tx.amount)}</td>
      ${isAdmin ? `<td class="column-profit money-positive" data-label="${t("profit")}">${formatProfit(tx.profit)}</td>` : ""}
      <td class="column-created-by" data-label="${t("createdBy")}">${escapeHtml(tx.createdByName)}</td>
      <td class="column-action" data-label="${t("action")}">
        <div class="row-actions">
          <button class="icon-action-button" data-action="details" data-id="${escapeHtml(tx.id)}" type="button" aria-label="${t("viewDetails")}" title="${t("viewDetails")}">${getActionIconSvg("details")}</button>
          <button class="icon-action-button" data-action="edit" data-id="${escapeHtml(tx.id)}" type="button" aria-label="${t("editTransaction")}" title="${t("editTransaction")}">${getActionIconSvg("edit")}</button>
          <button class="icon-action-button danger" data-action="delete" data-id="${escapeHtml(tx.id)}" type="button" aria-label="${t("deleteTransaction")}" title="${t("deleteTransaction")}">${getActionIconSvg("delete")}</button>
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

function renderDuplicateConfirmModal() {
  return `
    <div class="modal-backdrop ${state.pendingDuplicate ? "visible" : ""}" id="duplicateConfirmBackdrop">
      ${state.pendingDuplicate ? getDuplicateConfirmModalContent(state.pendingDuplicate) : ""}
    </div>
  `;
}

function renderDateFilterPopover() {
  const viewDate = getCalendarViewDate();
  const viewYear = viewDate.getUTCFullYear();
  const viewMonth = viewDate.getUTCMonth();
  const label = viewDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });

  return `
    <div class="date-popover ${state.calendarOpen ? "visible" : ""}" id="dateFilterPopover">
      <div class="date-popover-header">
        <button id="calendarPrevButton" class="icon-button date-nav-button" type="button" aria-label="Previous month">
          ${getPaginationArrowSvg("left")}
        </button>
        <div class="date-popover-title">
          <span>${t("dateFilter")}</span>
            <strong id="datePopoverLabel">${escapeHtml(label)}</strong>
        </div>
        <button id="calendarNextButton" class="icon-button date-nav-button" type="button" aria-label="Next month">
          ${getPaginationArrowSvg("right")}
        </button>
      </div>
      <div class="date-weekdays">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
        <div class="date-grid" id="dateGrid">
          ${buildCalendarDayButtons(viewYear, viewMonth)}
      </div>
      <div class="date-popover-actions">
        <button id="calendarClearButton" class="secondary-button ghost-button" type="button">${t("clear")}</button>
        <button id="calendarTodayButton" class="secondary-button" type="button">${t("today")}</button>
      </div>
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
      if (state.authTab === button.dataset.authTab) {
        return;
      }
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
      button.textContent = visible ? t("show") : t("hide");
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

  document.querySelectorAll("[data-language-switch]").forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.languageSwitch);
    });
  });
}

function bindDashboardEvents() {
  const user = getCurrentUser();
  if (!user) {
    return;
  }

  const headerLogoutButton = document.getElementById("headerLogoutButton");
  const navbarMenuButton = document.getElementById("navbarMenuButton");
  const navbarMeta = document.querySelector(".navbar-meta");
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
  const timeFilterFrom = document.getElementById("timeFilterFrom");
  const timeFilterTo = document.getElementById("timeFilterTo");
  const clearTimeFilterButton = document.getElementById("clearTimeFilterButton");
  const dateFilterToggleButton = document.getElementById("dateFilterToggleButton");
  const dateFilterInput = document.getElementById("dateFilterInput");
  const dateFilterPopover = document.getElementById("dateFilterPopover");
  const calendarPrevButton = document.getElementById("calendarPrevButton");
  const calendarNextButton = document.getElementById("calendarNextButton");
  const calendarTodayButton = document.getElementById("calendarTodayButton");
  const calendarClearButton = document.getElementById("calendarClearButton");
  const themeToggleDashboard = document.getElementById("themeToggleDashboard");
  const imageImportButton = document.getElementById("imageImportButton");
  const imageImportInput = document.getElementById("imageImportInput");
  const cameraImportButton = document.getElementById("cameraImportButton");
  const cameraImportInput = document.getElementById("cameraImportInput");
  const typeSelect = document.getElementById("transactionType");
  const typeToggleButtons = document.querySelectorAll("[data-transaction-type]");
  const amountInput = document.getElementById("amount");
  const tableFilterAll = document.getElementById("tableFilterAll");
  const tableFilterWithdraw = document.getElementById("tableFilterWithdraw");
  const tableFilterDeposit = document.getElementById("tableFilterDeposit");
  const tableFilterDuplicated = document.getElementById("tableFilterDuplicated");
  const tableScopeToday = document.getElementById("tableScopeToday");
  const tableScopeAllDates = document.getElementById("tableScopeAllDates");
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

  if (dateFilterToggleButton) {
    dateFilterToggleButton.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      event.stopPropagation();
      toggleCalendarPopover();
    });
  }

  if (navbarMenuButton) {
    navbarMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.navMenuOpen = !state.navMenuOpen;
      render();
    });
  }

  if (navbarMeta) {
    navbarMeta.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  if (dateFilterPopover) {
    dateFilterPopover.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      event.stopPropagation();

      const target = event.target.closest("button");
      if (!target) {
        return;
      }

      if (target.id === "calendarPrevButton") {
        state.calendarMonth = shiftCalendarMonth(-1);
        syncCalendarControls();
        return;
      }

      if (target.id === "calendarNextButton") {
        state.calendarMonth = shiftCalendarMonth(1);
        syncCalendarControls();
        return;
      }

      if (target.id === "calendarTodayButton") {
        applyDateFilter(getTodayDatePrefix());
        return;
      }

      if (target.id === "calendarClearButton") {
        clearDateFilter();
        return;
      }

      if (target.dataset.calendarDate) {
        applyDateFilter(target.dataset.calendarDate);
      }
    });
  }

  if (timeFilterFrom) {
    timeFilterFrom.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTimeFilterPopover("from");
    });
  }

  if (timeFilterTo) {
    timeFilterTo.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTimeFilterPopover("to");
    });
  }

    if (clearTimeFilterButton) {
      clearTimeFilterButton.addEventListener("click", () => {
        state.filterTimeFrom = "";
        state.filterTimeTo = "";
        state.pendingFilterTimeFrom = "";
        state.pendingFilterTimeTo = "";
        state.timeFilterDraftActive = false;
        state.timePickerOpen = "";
        state.currentPage = 1;
        render();
      });
    }

  document.querySelectorAll("[data-time-filter-popover]").forEach((popover) => {
    popover.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.querySelectorAll("[data-time-option]").forEach((button) => {
    button.addEventListener("click", () => {
      applyTimeFilter(button.dataset.timeOption, button.dataset.timeValue);
    });
  });

  if (tableScopeToday) {
    tableScopeToday.addEventListener("click", () => {
      if (state.historyScope === "today" && !state.filterDate) {
        return;
      }
      state.historyScope = "today";
      state.filterDate = "";
      state.currentPage = 1;
      render();
    });
  }

  if (tableScopeAllDates) {
    tableScopeAllDates.addEventListener("click", () => {
      if (state.historyScope === "all" && !state.filterDate) {
        return;
      }
      state.historyScope = "all";
      state.filterDate = "";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterAll) {
    tableFilterAll.addEventListener("click", () => {
      if (state.filterType === "all") {
        return;
      }
      state.filterType = "all";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterWithdraw) {
    tableFilterWithdraw.addEventListener("click", () => {
      if (state.filterType === "ငွေထုတ်") {
        return;
      }
      state.filterType = "ငွေထုတ်";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterDeposit) {
    tableFilterDeposit.addEventListener("click", () => {
      if (state.filterType === "ငွေသွင်း") {
        return;
      }
      state.filterType = "ငွေသွင်း";
      state.currentPage = 1;
      render();
    });
  }

  if (tableFilterDuplicated) {
    tableFilterDuplicated.addEventListener("click", () => {
      if (state.filterType === "duplicated") {
        return;
      }
      state.filterType = "duplicated";
      state.currentPage = 1;
      render();
    });
  }

  if (paginationPrevButton) {
    paginationPrevButton.addEventListener("click", () => {
      const nextPage = Math.max(1, state.currentPage - 1);
      if (nextPage === state.currentPage) {
        return;
      }
      state.currentPage = nextPage;
      render();
    });
  }

  if (paginationNextButton) {
    paginationNextButton.addEventListener("click", () => {
      const pagination = getPaginationState(getVisibleTransactions().length);
      const nextPage = Math.min(pagination.totalPages, state.currentPage + 1);
      if (nextPage === state.currentPage) {
        return;
      }
      state.currentPage = nextPage;
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

      const nextPage = Math.min(pagination.totalPages, Math.max(1, Math.trunc(rawValue)));
      if (nextPage === state.currentPage) {
        paginationPageInput.value = String(state.currentPage);
        return;
      }
      state.currentPage = nextPage;
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
    themeToggleDashboard.addEventListener("click", () => {
      state.navMenuOpen = false;
      toggleTheme();
    });
  }

  document.querySelectorAll("[data-language-switch]").forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.languageSwitch);
    });
  });

  typeToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (document.getElementById("transactionType")?.value === button.dataset.transactionType) {
        return;
      }
      setTransactionType(button.dataset.transactionType);
      updateProfitPreview();
    });
  });

  if (typeSelect) {
    updateTransactionTypeButtons(typeSelect.value);
  }

  if (amountInput) {
    amountInput.addEventListener("input", () => {
      amountInput.value = formatEditableAmount(amountInput.value);
      updateProfitPreview();
    });
  }

  const customerNameInput = document.getElementById("customerName");
  if (customerNameInput) {
    customerNameInput.addEventListener("input", () => {
      customerNameInput.value = sanitizeCustomerName(customerNameInput.value);
    });
  }

  const phoneNumberInput = document.getElementById("phoneNumber");
  if (phoneNumberInput) {
    phoneNumberInput.addEventListener("input", () => {
      phoneNumberInput.value = phoneNumberInput.value.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
    });
  }

  if (transactionForm) {
    transactionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitTransactionForm();
    });
  }

  if (imageImportButton && imageImportInput) {
    imageImportButton.addEventListener("click", () => {
      imageImportInput.click();
    });
  }

  if (cameraImportButton && cameraImportInput) {
    cameraImportButton.addEventListener("click", () => {
      cameraImportInput.click();
    });
  }

  const handleImageImport = async (event, sourceButton) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";

      if (!file || !sourceButton) {
        return;
      }

      const message = document.getElementById("transactionMessage");
      const originalLabel = sourceButton.textContent;

      imageImportButton && (imageImportButton.disabled = true);
      cameraImportButton && (cameraImportButton.disabled = true);
      sourceButton.textContent = sourceButton === cameraImportButton ? t("openingCamera") : t("readingImage");
      setTransactionMessage(message, t("scanningImage"));

        try {
          const imagePayload = await prepareImageForUpload(file);
          sourceButton.textContent = t("creatingTransaction");
          const payload = await api("/api/transactions/import-image", {
            method: "POST",
            body: JSON.stringify(imagePayload)
        });

        const importedDrafts = Array.isArray(payload.drafts)
          ? payload.drafts
          : (payload.draft ? [payload.draft] : []);

          if (!importedDrafts.length) {
            throw new Error(t("ocrNoDetails"));
          }

          const importedDraft = importedDrafts[0];
          if (!String(importedDraft.customerName || "").trim()) {
            applyImportedDraft(importedDraft);
            setTransactionMessage(message, t("ocrNameUnclear"));
            return;
          }

          await submitTransactionForm({ draft: importedDraft });
        } catch (error) {
          setTransactionMessage(message, error.message);
        } finally {
        imageImportButton && (imageImportButton.disabled = false);
        cameraImportButton && (cameraImportButton.disabled = false);
        sourceButton.textContent = originalLabel;
      }
    };

  if (imageImportInput) {
    imageImportInput.addEventListener("change", (event) => handleImageImport(event, imageImportButton));
  }

  if (cameraImportInput) {
    cameraImportInput.addEventListener("change", (event) => handleImageImport(event, cameraImportButton));
  }

  updateProfitPreview();
}

function closeModal() {
  state.modalOpen = false;
  state.editingId = "";
  state.pendingDuplicate = null;
  render();
}

function toggleCalendarPopover() {
  state.calendarOpen = !state.calendarOpen;
  if (state.calendarOpen) {
    syncCalendarMonth();
  }
  syncCalendarControls();
}

function closeCalendarPopover() {
  if (!state.calendarOpen) {
    return;
  }
  state.calendarOpen = false;
  syncCalendarControls();
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
  const duplicateInfo = isAdmin ? getTransactionDuplicateInfo(tx) : null;
  return `
    <section class="modal-card details-card">
      <div class="modal-header">
        <div>
          <p class="eyebrow dark">${t("detailsTitle")}</p>
          <h2>${escapeHtml(tx.customerName)}</h2>
        </div>
        <button id="closeDetailsButton" class="icon-button" type="button" aria-label="${t("closeDetails")}">${getCloseIconSvg()}</button>
      </div>
      <div class="details-grid">
        <div class="details-item"><span>${t("date")}</span><strong>${escapeHtml(tx.createdAt)}</strong></div>
        <div class="details-item"><span>${t("type")}</span><strong>${escapeHtml(translateTransactionType(tx.type))}</strong></div>
        <div class="details-item"><span>${t("name")}</span><strong>${escapeHtml(tx.customerName)}</strong></div>
        <div class="details-item"><span>${t("phone")}</span><strong>${escapeHtml(tx.phoneNumber || "-")}</strong></div>
        <div class="details-item"><span>${t("amount")}</span><strong>${formatAmount(tx.amount)}</strong></div>
        ${isAdmin ? `<div class="details-item"><span>${t("profit")}</span><strong class="money-positive">${formatProfit(tx.profit)}</strong></div>` : ""}
        ${isAdmin ? `
          <div class="details-item">
            <span>${t("duplicateStatus")}</span>
            <strong class="${duplicateInfo ? "duplicate-text" : ""}">${duplicateInfo ? `${t("duplicated")} x${duplicateInfo.count}` : t("noDuplicateMatch")}</strong>
          </div>
        ` : ""}
        <div class="details-item"><span>${t("createdBy")}</span><strong>${escapeHtml(tx.createdByName)}</strong></div>
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

function openDuplicateConfirm(payload, duplicate) {
  state.pendingDuplicate = {
    payload,
    duplicate
  };

  const duplicateConfirmBackdrop = document.getElementById("duplicateConfirmBackdrop");
  if (!duplicateConfirmBackdrop) {
    render();
    return;
  }

  duplicateConfirmBackdrop.innerHTML = getDuplicateConfirmModalContent(state.pendingDuplicate);
  duplicateConfirmBackdrop.classList.add("visible");

  const closeButton = document.getElementById("closeDuplicateConfirmButton");
  const cancelButton = document.getElementById("cancelDuplicateConfirmButton");
  const confirmButton = document.getElementById("confirmDuplicateButton");

  if (closeButton) {
    closeButton.addEventListener("click", closeDuplicateConfirm);
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", closeDuplicateConfirm);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", confirmDuplicateTransaction);
  }
}

function closeDuplicateConfirm() {
  state.pendingDuplicate = null;
  const duplicateConfirmBackdrop = document.getElementById("duplicateConfirmBackdrop");
  if (duplicateConfirmBackdrop) {
    duplicateConfirmBackdrop.classList.remove("visible");
    duplicateConfirmBackdrop.innerHTML = "";
  }
}

async function confirmDuplicateTransaction() {
  const pendingDuplicate = state.pendingDuplicate;
  if (!pendingDuplicate) {
    return;
  }

  await submitTransactionForm({ allowDuplicate: true, draft: pendingDuplicate.payload });
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
          <p class="eyebrow dark">${t("deleteTransactionHeading")}</p>
          <h2>${t("deleteQuestion")}</h2>
        </div>
        <button id="closeDeleteConfirmButton" class="icon-button" type="button" aria-label="Close delete confirmation">${getCloseIconSvg()}</button>
      </div>
      <p class="confirm-copy">
        ${t("deleteCopy", { name: escapeHtml(tx.customerName), amount: formatAmount(tx.amount) })}
      </p>
      <div class="confirm-actions">
        <button id="cancelDeleteConfirmButton" class="secondary-button" type="button">${t("cancel")}</button>
        <button id="confirmDeleteButton" class="secondary-button danger-button" type="button">${t("delete")}</button>
      </div>
    </section>
  `;
}

function getDuplicateConfirmModalContent(pendingDuplicate) {
  const duplicate = pendingDuplicate.duplicate;
  const hasPhoneNumber = normalizePhoneNumber(pendingDuplicate.payload?.phoneNumber || duplicate.phoneNumber);
  const duplicateBasis = hasPhoneNumber
    ? t("sameNamePhoneAmount")
    : t("sameNameAmountNoPhone");
  return `
    <section class="modal-card confirm-card">
      <div class="modal-header">
        <div>
          <p class="eyebrow dark">${t("duplicateWarning")}</p>
          <h2>${t("possibleDuplicate")}</h2>
        </div>
        <button id="closeDuplicateConfirmButton" class="icon-button" type="button" aria-label="Close duplicate warning">${getCloseIconSvg()}</button>
      </div>
      <p class="confirm-copy">
        ${t("duplicateCopy", { basis: duplicateBasis, date: escapeHtml(getTransactionDate(duplicate.createdAt)), time: escapeHtml(getTransactionTime(duplicate.createdAt)) })}
      </p>
      <div class="details-grid confirm-match-card">
        <div class="details-item"><span>${t("name")}</span><strong>${escapeHtml(duplicate.customerName)}</strong></div>
        <div class="details-item"><span>${t("phone")}</span><strong>${escapeHtml(duplicate.phoneNumber || "-")}</strong></div>
        <div class="details-item"><span>${t("amount")}</span><strong>${formatAmount(duplicate.amount)}</strong></div>
        <div class="details-item"><span>${t("createdBy")}</span><strong>${escapeHtml(duplicate.createdByName)}</strong></div>
      </div>
      <p class="confirm-copy confirm-note">${t("continueOnlyIfNew")}</p>
      <div class="confirm-actions">
        <button id="cancelDuplicateConfirmButton" class="secondary-button" type="button">${t("goBack")}</button>
        <button id="confirmDuplicateButton" class="secondary-button danger-button" type="button">${t("saveAnyway")}</button>
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
  clearTransactionMessage(message);
  closeDuplicateConfirm();
  state.calendarOpen = false;
  const imageImportInput = document.getElementById("imageImportInput");
  const cameraImportInput = document.getElementById("cameraImportInput");
  if (imageImportInput) {
    imageImportInput.value = "";
  }
  if (cameraImportInput) {
    cameraImportInput.value = "";
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
        nextCustomerName.value = sanitizeCustomerName(tx.customerName);
        nextAmount.value = tx.amount;
        nextPhoneNumber.value = tx.phoneNumber || "";
        updateProfitPreview();
      }
    });
    return;
  }

  closeDuplicateConfirm();
  state.calendarOpen = false;

  modalBackdrop.classList.add("visible");
  if (transactionId) {
    transactionId.value = tx.id;
  }
  transactionType.value = tx.type;
  customerName.value = sanitizeCustomerName(tx.customerName);
  amount.value = formatEditableAmount(String(tx.amount));
  phoneNumber.value = tx.phoneNumber || "";
  if (heading) {
    heading.textContent = "Edit Transaction";
  }
  if (submitButton) {
    submitButton.textContent = "Update Transaction";
  }
  if (message) {
    clearTransactionMessage(message);
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
    preview.textContent = t("adminOnly");
    return;
  }

  preview.textContent = formatProfit(calculateProfit(typeInput.value, amountInput.value));
}

function renderTimeFilterControls() {
  const displayedFrom = getDisplayedTimeFilterValue("from");
  const displayedTo = getDisplayedTimeFilterValue("to");
  const hasAnyTimeFilter = state.filterTimeFrom || state.filterTimeTo || state.pendingFilterTimeFrom || state.pendingFilterTimeTo;
  return `
      <div class="time-filter-group">
        <div class="time-filter-field">
          <span>From</span>
          <div class="time-filter-shell">
          <button
              id="timeFilterFrom"
              class="time-filter-input time-filter-trigger ${state.timePickerOpen === "from" ? "active" : ""}"
              type="button"
              data-time-picker-toggle="from"
            >
              <span>${escapeHtml(displayedFrom || "From")}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"></path></svg>
            </button>
            ${renderTimeFilterPopover("from", displayedFrom)}
          </div>
        </div>
        <div class="time-filter-field">
          <span>To</span>
          <div class="time-filter-shell">
          <button
              id="timeFilterTo"
              class="time-filter-input time-filter-trigger ${state.timePickerOpen === "to" ? "active" : ""}"
              type="button"
              data-time-picker-toggle="to"
            >
              <span>${escapeHtml(displayedTo || "To")}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"></path></svg>
            </button>
            ${renderTimeFilterPopover("to", displayedTo)}
          </div>
        </div>
        <button
          id="clearTimeFilterButton"
          class="secondary-button ghost-button time-filter-clear ${hasAnyTimeFilter ? "" : "hidden"}"
          type="button"
        >
          Clear
        </button>
      </div>
  `;
}

function renderTimeFilterPopover(edge, selectedValue) {
  return `
    <div class="time-filter-popover ${state.timePickerOpen === edge ? "visible" : ""}" data-time-filter-popover="${edge}">
      <div class="time-filter-options">
        ${buildTimeFilterOptions(edge, selectedValue)}
      </div>
    </div>
  `;
}

function buildTimeFilterOptions(edge, selectedValue) {
  const options = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push(`
        <button
          class="time-option-button ${selectedValue === value ? "active" : ""}"
          type="button"
          data-time-option="${edge}"
          data-time-value="${value}"
        >
          ${value}
        </button>
      `);
    }
  }

  return options.join("");
}

function getDisplayedTimeFilterValue(edge) {
  if (edge === "from") {
    return state.pendingFilterTimeFrom || state.filterTimeFrom;
  }

  return state.pendingFilterTimeTo || state.filterTimeTo;
}

function syncCalendarControls() {
  const toggleButton = document.getElementById("dateFilterToggleButton");
  const hiddenInput = document.getElementById("dateFilterInput");
  const popover = document.getElementById("dateFilterPopover");
  const label = document.getElementById("datePopoverLabel");
  const grid = document.getElementById("dateGrid");

  if (toggleButton) {
    toggleButton.classList.toggle("active", Boolean(state.filterDate));
    const ariaLabel = state.filterDate ? `Change date filter from ${state.filterDate}` : "Open date filter";
    const title = state.filterDate ? `Date filter: ${state.filterDate}` : "Filter by date";
    toggleButton.setAttribute("aria-label", ariaLabel);
    toggleButton.setAttribute("title", title);
  }

  if (hiddenInput) {
    hiddenInput.value = state.filterDate;
  }

  if (popover) {
    popover.classList.toggle("visible", state.calendarOpen);
  }

  const viewDate = getCalendarViewDate();
  if (label) {
    label.textContent = viewDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  if (grid) {
    grid.innerHTML = buildCalendarDayButtons(viewDate.getUTCFullYear(), viewDate.getUTCMonth());
  }
}

function syncTimeFilterControls() {
  const fromButton = document.getElementById("timeFilterFrom");
  const toButton = document.getElementById("timeFilterTo");
  const clearButton = document.getElementById("clearTimeFilterButton");
  const fromPopover = document.querySelector('[data-time-filter-popover="from"]');
  const toPopover = document.querySelector('[data-time-filter-popover="to"]');

  if (fromButton) {
    fromButton.classList.toggle("active", state.timePickerOpen === "from");
    const label = fromButton.querySelector("span");
    if (label) {
      label.textContent = getDisplayedTimeFilterValue("from") || "From";
    }
  }

  if (toButton) {
    toButton.classList.toggle("active", state.timePickerOpen === "to");
    const label = toButton.querySelector("span");
    if (label) {
      label.textContent = getDisplayedTimeFilterValue("to") || "To";
    }
  }

  if (fromPopover) {
    fromPopover.classList.toggle("visible", state.timePickerOpen === "from");
  }

  if (toPopover) {
    toPopover.classList.toggle("visible", state.timePickerOpen === "to");
  }

  if (clearButton) {
    const hasAnyTimeFilter = state.filterTimeFrom || state.filterTimeTo || state.pendingFilterTimeFrom || state.pendingFilterTimeTo;
    clearButton.classList.toggle("hidden", !hasAnyTimeFilter);
  }

  document.querySelectorAll('[data-time-option="from"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.timeValue === getDisplayedTimeFilterValue("from"));
  });

  document.querySelectorAll('[data-time-option="to"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.timeValue === getDisplayedTimeFilterValue("to"));
  });
}

function setTransactionMessage(message, text) {
  if (!message) {
    return;
  }

  message.textContent = text;
  message.classList.remove("hidden");
}

function clearTransactionMessage(message) {
  if (!message) {
    return;
  }

  message.textContent = "";
  message.classList.add("hidden");
}

function applyImportedDraft(draft) {
  const typeInput = document.getElementById("transactionType");
  const customerNameInput = document.getElementById("customerName");
  const amountInput = document.getElementById("amount");
  const phoneNumberInput = document.getElementById("phoneNumber");

  if (!draft || !typeInput || !customerNameInput || !amountInput || !phoneNumberInput) {
    return;
  }

  const nextType = normalizeTransactionType(draft.type) || "ငွေထုတ်";
  typeInput.value = nextType;
  updateTransactionTypeButtons(nextType);
  customerNameInput.value = sanitizeCustomerName(draft.customerName);
  amountInput.value = formatEditableAmount(String(draft.amount || ""));
  phoneNumberInput.value = String(draft.phoneNumber || "").replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
  updateProfitPreview();
}

async function submitTransactionForm({ allowDuplicate = false, draft = null } = {}) {
  const type = draft?.type ?? document.getElementById("transactionType")?.value;
  const customerName = sanitizeCustomerName(draft?.customerName ?? document.getElementById("customerName")?.value);
  const amount = draft?.amount ?? toNumber(document.getElementById("amount")?.value);
  const phoneNumber = draft?.phoneNumber ?? document.getElementById("phoneNumber")?.value.trim();
  const message = document.getElementById("transactionMessage");

  if (!customerName) {
    setTransactionMessage(message, t("nameRequired"));
    return;
  }

  if (customerName.length > MAX_NAME_LENGTH) {
    setTransactionMessage(message, t("nameTooLong", { count: MAX_NAME_LENGTH }));
    return;
  }

  if (!isValidCustomerName(customerName)) {
    setTransactionMessage(message, t("nameInvalid"));
    return;
  }

  if (needsCustomerNameSpaces(customerName)) {
    setTransactionMessage(message, t("nameNeedsSpaces"));
    return;
  }

  if (amount <= 0) {
    setTransactionMessage(message, t("amountRequired"));
    return;
  }

  if (String(Math.trunc(amount)).length > MAX_AMOUNT_DIGITS) {
    setTransactionMessage(message, t("amountTooLarge", { count: MAX_AMOUNT_DIGITS }));
    return;
  }

  if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    setTransactionMessage(message, t("phoneInvalid"));
    return;
  }

  clearTransactionMessage(message);

  try {
    const endpoint = state.editingId
      ? `/api/transactions/${encodeURIComponent(state.editingId)}`
      : "/api/transactions";
    const method = state.editingId ? "PUT" : "POST";
    const payload = await api(endpoint, {
      method,
      body: JSON.stringify({ type, customerName, amount, phoneNumber, allowDuplicate })
    });

    if (state.editingId) {
      state.transactions = state.transactions.map((tx) => (
        tx.id === payload.transaction.id ? payload.transaction : tx
      ));
    } else {
      state.transactions = [payload.transaction, ...state.transactions];
      state.currentPage = 1;
    }

    closeDuplicateConfirm();
    closeModal();
  } catch (error) {
    if (!state.editingId && error.status === 409 && error.payload?.duplicate) {
      if (error.payload.canOverride === false) {
        if (error.payload.duplicatePolicy === "cashier-block") {
          setTransactionMessage(message, t("cashierDuplicateBlocked"));
          return;
        }

        setTransactionMessage(message, error.message);
        return;
      }

      openDuplicateConfirm({ type, customerName, amount, phoneNumber }, error.payload.duplicate);
      return;
    }

    setTransactionMessage(message, error.message);
  }
}

async function prepareImageForUpload(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(t("uploadImageOnly"));
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
    throw new Error(t("imageProcessingUnsupported"));
  }

    context.drawImage(image, 0, 0, width, height);
    return {
      fullImageDataUrl: canvas.toDataURL("image/jpeg", 0.82),
      amountImageDataUrl: cropCanvasToDataUrl(canvas, 0.16, 0.27, 0.68, 0.22, 1.8),
      detailsImageDataUrl: cropCanvasToDataUrl(canvas, 0.08, 0.48, 0.84, 0.32, 1.4),
      nameImageDataUrl: cropCanvasToDataUrl(canvas, 0.42, 0.52, 0.48, 0.24, 2.8),
      transferNameImageDataUrl: cropCanvasToDataUrl(canvas, 0.50, 0.58, 0.38, 0.10, 3.1),
      englishTransferRowImageDataUrl: cropCanvasToDataUrl(canvas, 0.30, 0.57, 0.58, 0.14, 3.0),
      myanmarRecipientImageDataUrl: cropCanvasToDataUrl(canvas, 0.55, 0.56, 0.28, 0.18, 3.0),
      phoneImageDataUrl: cropCanvasToDataUrl(canvas, 0.54, 0.47, 0.34, 0.14, 2.2)
    };
  }

function cropCanvasToDataUrl(sourceCanvas, xRatio, yRatio, widthRatio, heightRatio, scaleFactor = 1) {
  const cropX = Math.max(0, Math.round(sourceCanvas.width * xRatio));
  const cropY = Math.max(0, Math.round(sourceCanvas.height * yRatio));
  const cropWidth = Math.max(1, Math.round(sourceCanvas.width * widthRatio));
  const cropHeight = Math.max(1, Math.round(sourceCanvas.height * heightRatio));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropWidth * scaleFactor));
  canvas.height = Math.max(1, Math.round(cropHeight * scaleFactor));
  const context = canvas.getContext("2d");

  if (!context) {
    return sourceCanvas.toDataURL("image/jpeg", 0.82);
  }

  context.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL("image/jpeg", 0.88);
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
  const todayPrefix = getTodayDatePrefix();
  return state.transactions
    .filter((tx) => {
      const typeMatch = state.filterType === "duplicated"
        ? Boolean(getTransactionDuplicateInfo(tx))
        : (state.filterType === "all" || tx.type === state.filterType);
      const haystack = normalizeText(`${tx.customerName} ${tx.phoneNumber} ${tx.type} ${tx.createdByName}`);
      const searchMatch = !state.search || haystack.includes(normalizeText(state.search));
      const txDate = getTransactionDate(tx.createdAt);
      const dateMatch = state.filterDate
        ? txDate === state.filterDate
        : (state.historyScope === "all" || txDate === todayPrefix);
      const timeMatch = isTransactionWithinTimeFilter(tx.createdAt);
      return typeMatch && searchMatch && dateMatch && timeMatch;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function syncCalendarMonth() {
  state.calendarMonth = (state.filterDate || getTodayDatePrefix()).slice(0, 7);
}

function getCalendarViewDate() {
  const monthValue = state.calendarMonth || (state.filterDate || getTodayDatePrefix()).slice(0, 7);
  const match = monthValue.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return new Date(`${getTodayDatePrefix()}T00:00:00Z`);
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function shiftCalendarMonth(offset) {
  const viewDate = getCalendarViewDate();
  const shifted = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarDayButtons(year, month) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = getTodayDatePrefix();
  const selectedDate = state.filterDate;
  const cells = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(`<span class="date-day spacer" aria-hidden="true"></span>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
      const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const classes = ["date-day"];
      const isFuture = isoDate > today;

    if (selectedDate === isoDate) {
        classes.push("selected");
      }

    if (today === isoDate) {
        classes.push("today");
      }

      if (isFuture) {
        classes.push("disabled");
      }

      cells.push(`
        <button class="${classes.join(" ")}" data-calendar-date="${isoDate}" type="button" ${isFuture ? "disabled aria-disabled=\"true\"" : ""}>
          ${day}
        </button>
      `);
    }

  return cells.join("");
}

function applyDateFilter(value) {
  state.filterDate = value;
  state.calendarMonth = value.slice(0, 7);
  state.calendarOpen = false;
  state.currentPage = 1;
  render();
}

function clearDateFilter() {
  state.filterDate = "";
  state.calendarMonth = getTodayDatePrefix().slice(0, 7);
  state.calendarOpen = false;
  state.currentPage = 1;
  render();
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

function getTransactionTime(createdAt) {
  return String(createdAt || "").slice(11, 16);
}

function isTransactionWithinTimeFilter(createdAt) {
  const txTime = getTransactionTime(createdAt);
  if (!txTime) {
    return !state.filterTimeFrom && !state.filterTimeTo;
  }

  if (state.filterTimeFrom && txTime < state.filterTimeFrom) {
    return false;
  }

  if (state.filterTimeTo && txTime > state.filterTimeTo) {
    return false;
  }

  return true;
}

function toggleTimeFilterPopover(edge) {
  state.timePickerOpen = state.timePickerOpen === edge ? "" : edge;
  syncTimeFilterControls();
}

function closeTimeFilterPopover() {
  if (!state.timePickerOpen) {
    return;
  }

  state.timePickerOpen = "";
  syncTimeFilterControls();
}

function applyTimeFilter(edge, value) {
  if (!state.timeFilterDraftActive) {
    state.timeFilterDraftActive = true;
    state.pendingFilterTimeFrom = edge === "from" ? value : "";
    state.pendingFilterTimeTo = edge === "to" ? value : "";
  } else if (edge === "from") {
    state.pendingFilterTimeFrom = value;
  } else {
    state.pendingFilterTimeTo = value;
  }

  if (!state.pendingFilterTimeFrom || !state.pendingFilterTimeTo) {
    state.timePickerOpen = edge === "from" ? "to" : "from";
    syncTimeFilterControls();
    return;
  }

  let nextFrom = state.pendingFilterTimeFrom;
  let nextTo = state.pendingFilterTimeTo;
  if (nextTo < nextFrom) {
    [nextFrom, nextTo] = [nextTo, nextFrom];
  }

  state.filterTimeFrom = nextFrom;
  state.filterTimeTo = nextTo;
  state.pendingFilterTimeFrom = "";
  state.pendingFilterTimeTo = "";
  state.timeFilterDraftActive = false;
  state.timePickerOpen = "";
  state.currentPage = 1;
  render();
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
  const baseLabel = t("profitOn", {
    date: state.filterDate || getTodayDatePrefix()
  });

  if (state.filterTimeFrom || state.filterTimeTo) {
    return `${baseLabel} ${state.filterTimeFrom || "00:00"}-${state.filterTimeTo || "23:59"}`;
  }

  return baseLabel;
}

function getClosingSummaryTransactions(items) {
  const targetDate = state.filterDate || getTodayDatePrefix();
  return items.filter((tx) => getTransactionDate(tx.createdAt) === targetDate && isTransactionWithinTimeFilter(tx.createdAt));
}

function summarizeClosingTransactions(items) {
  const cashierIds = new Set();

  return items.reduce((summary, tx) => {
    const amount = toNumber(tx.amount);
    const profit = toNumber(tx.profit);

    summary.openingCount += 1;
    summary.totalProfit += profit;

    if (tx.type === "ငွေသွင်း") {
      summary.totalDeposit += amount;
    }

    if (tx.type === "ငွေထုတ်") {
      summary.totalWithdraw += amount;
    }

    if (tx.createdById) {
      cashierIds.add(tx.createdById);
      summary.cashierCount = cashierIds.size;
    }

    return summary;
  }, {
    openingCount: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    totalProfit: 0,
    cashierCount: 0
  });
}

function getClosingSummaryLabel() {
  const baseLabel = state.filterDate
    ? `Based on all transactions from ${state.filterDate}`
    : `Based on all transactions from ${getTodayDatePrefix()}`;

  if (state.filterTimeFrom || state.filterTimeTo) {
    return `${baseLabel} between ${state.filterTimeFrom || "00:00"} and ${state.filterTimeTo || "23:59"}`;
  }

  return baseLabel;
}

async function hydrateSession() {
  try {
    const payload = await api("/api/session");
    state.sessionUser = payload.user;
    state.transactions = payload.transactions || [];
    state.calendarMonth = getTodayDatePrefix().slice(0, 7);
  } catch {
    state.sessionUser = null;
    state.transactions = [];
    state.calendarMonth = getTodayDatePrefix().slice(0, 7);
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
    throw new Error(t("serverUnreachable"));
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || t("requestFailed"));
    error.status = response.status;
    error.payload = payload;
    throw error;
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

function formatEditableAmount(value) {
  const raw = String(value || "").replace(/,/g, "").trim();
  if (!raw) {
    return "";
  }

  const sanitized = raw
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");

  if (!sanitized) {
    return "";
  }

  const hasTrailingDot = sanitized.endsWith(".");
  const [integerPartRaw, decimalPartRaw = ""] = sanitized.split(".");
  const integerDigits = integerPartRaw.replace(/\D/g, "").slice(0, MAX_AMOUNT_DIGITS);
  const decimalDigits = decimalPartRaw.replace(/\D/g, "").slice(0, 2);

  const formattedInteger = integerDigits
    ? new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(integerDigits))
    : "0";

  if (hasTrailingDot) {
    return `${formattedInteger}.`;
  }

  if (sanitized.includes(".")) {
    return `${formattedInteger}.${decimalDigits}`;
  }

  return formattedInteger;
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

function sanitizeCustomerName(value) {
  return String(value || "")
    .replace(/[^\p{L}\p{M}\s]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trimStart()
    .slice(0, MAX_NAME_LENGTH);
}

function isValidCustomerName(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && normalized === sanitizeCustomerName(normalized);
}

function needsCustomerNameSpaces(value) {
  const normalized = String(value || "").trim();
  return /^[\p{Script=Latin}\p{M}]{2,6}$/u.test(normalized);
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function getTransactionDuplicateKey(tx) {
  return [
    getTransactionDate(tx.createdAt),
    normalizeText(tx.customerName),
    normalizePhoneNumber(tx.phoneNumber),
    Number(tx.amount) || 0
  ].join("|");
}

function getDuplicateTransactionCounts() {
  if (duplicateIndexCache.transactions === state.transactions) {
    return duplicateIndexCache.counts;
  }

  const counts = new Map();
  state.transactions.forEach((tx) => {
    const key = getTransactionDuplicateKey(tx);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  duplicateIndexCache.transactions = state.transactions;
  duplicateIndexCache.counts = counts;
  return counts;
}

function getTransactionDuplicateInfo(tx) {
  const key = getTransactionDuplicateKey(tx);
  if (!key || key === "||0") {
    return null;
  }

  const duplicateCount = getDuplicateTransactionCounts().get(key) || 0;
  return duplicateCount > 1
    ? {
      count: duplicateCount
    }
    : null;
}

function renderTransactionNameCell(tx, isAdmin) {
  const duplicateInfo = isAdmin ? getTransactionDuplicateInfo(tx) : null;
  return `
    <div class="transaction-name-stack">
      <span>${escapeHtml(tx.customerName)}</span>
      ${duplicateInfo ? `<span class="duplicate-badge">Duplicate x${duplicateInfo.count}</span>` : ""}
    </div>
  `;
}

function normalizeTransactionType(value) {
  const normalized = normalizeText(value);

  if (["ငွေထုတ်", "withdraw", "cash out", "withdrawal"].includes(normalized)) {
    return "ငွေထုတ်";
  }

  if (["ငွေသွင်း", "deposit", "cash in"].includes(normalized)) {
    return "ငွေသွင်း";
  }

  return "";
}

function isValidPhoneNumber(value) {
  return /^09\d{7,9}$/.test(String(value || "").trim());
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.calendarOpen) {
    closeCalendarPopover();
  }

  if (event.key === "Escape" && state.timePickerOpen) {
    closeTimeFilterPopover();
  }
});

document.addEventListener("click", () => {
  if (state.navMenuOpen) {
    state.navMenuOpen = false;
    render();
    return;
  }

  if (state.calendarOpen) {
    closeCalendarPopover();
  }

  if (state.timePickerOpen) {
    closeTimeFilterPopover();
  }
});
