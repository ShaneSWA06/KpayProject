const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

loadEnvFile(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Yangon";
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
const MAX_JSON_BODY_BYTES = 6_000_000;
const CASHIER_DUPLICATE_BLOCK_WINDOW_MINUTES = 10;
const root = __dirname;
const sessions = new Map();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to .env or your environment variables.");
}

const pool = new Pool({
  connectionString: databaseUrl
});

pool.on("error", (error) => {
  console.error("[db] Unexpected idle client error", error);
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

async function start() {
  await initializeDatabase();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, error.statusCode || 500, { message: error.message || "Server error" });
    });
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  server.listen(PORT, HOST, () => {
    console.log(`Kpay/WavePay app running at http://${HOST}:${PORT}`);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApiRequest(req, res, url);
    return;
  }

  serveStaticFile(url.pathname, res);
}

async function handleApiRequest(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    const health = await getHealthStatus();
    sendJson(res, health.ok ? 200 : 503, health);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/session") {
    const user = await getSessionUser(req);
    if (!user) {
      sendJson(res, 200, { user: null, transactions: [] });
      return;
    }

    const transactions = await listTransactions();
    sendJson(res, 200, { user, transactions });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJsonBody(req);
    const username = normalizeText(body.username);
    const password = String(body.password || "");

    if (!username || !password) {
      sendJson(res, 400, { message: "Username and password are required." });
      return;
    }

    const result = await pool.query(
      "SELECT id, full_name, username, password_hash, role, created_at FROM users WHERE lower(username) = lower($1) LIMIT 1",
      [username]
    );
    const user = result.rows[0];

    if (!user || user.password_hash !== hashPassword(password)) {
      sendJson(res, 401, { message: "Invalid username or password." });
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, user.id);

    const transactions = await listTransactions();
    res.setHeader("Set-Cookie", createSessionCookie(token));
    sendJson(res, 200, { user: sanitizeUserRow(user), transactions });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/signup") {
    const body = await readJsonBody(req);
    const fullName = String(body.fullName || "").trim();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!fullName || !username || !password) {
      sendJson(res, 400, { message: "Please fill in all required fields." });
      return;
    }

    const existing = await pool.query(
      "SELECT 1 FROM users WHERE lower(username) = lower($1) LIMIT 1",
      [username]
    );

    if (existing.rowCount) {
      sendJson(res, 409, { message: "That username already exists." });
      return;
    }

    const user = {
      id: `user-${Date.now()}`,
      fullName,
      username,
      passwordHash: hashPassword(password),
      role: "cashier",
      createdAt: nowStamp()
    };

    await pool.query(
      `INSERT INTO users (id, full_name, username, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.fullName, user.username, user.passwordHash, user.role, user.createdAt]
    );

    sendJson(res, 201, { message: "Account created. You can now log in." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const cookies = parseCookies(req.headers.cookie || "");
    if (cookies.session_token) {
      sessions.delete(cookies.session_token);
    }

    res.setHeader("Set-Cookie", expireSessionCookie());
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/transactions") {
    const user = await requireSessionUser(req, res);
    if (!user) {
      return;
    }

    if (req.method === "GET") {
      sendJson(res, 200, { transactions: await listTransactions() });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const type = String(body.type || "");
      const customerName = sanitizeCustomerName(body.customerName);
      const amount = toNumber(body.amount);
      const phoneNumber = String(body.phoneNumber || "").trim();
      const allowDuplicate = Boolean(body.allowDuplicate);

      if (!customerName || !isValidCustomerName(customerName) || !["ငွေထုတ်", "ငွေသွင်း"].includes(type)) {
        sendJson(res, 400, { message: "Valid transaction details are required." });
        return;
      }

      if (needsCustomerNameSpaces(customerName)) {
        sendJson(res, 400, { message: "Please add space btw words for the name." });
        return;
      }

      if (amount <= 0) {
        sendJson(res, 400, { message: "Amount must be greater than 0." });
        return;
      }

      if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
        sendJson(res, 400, { message: "Phone number must start with 09 and have 9 to 11 digits." });
        return;
      }

      const createdAt = nowStamp();
      const recentCashierDuplicate = user.role === "cashier"
        ? await findRecentDuplicateTransaction({
          customerName,
          phoneNumber,
          amount,
          referenceStamp: createdAt,
          createdById: user.id,
          windowMinutes: CASHIER_DUPLICATE_BLOCK_WINDOW_MINUTES
        })
        : null;

      if (recentCashierDuplicate) {
        sendJson(res, 409, {
          message: `This exact transaction was already saved by you within the last ${CASHIER_DUPLICATE_BLOCK_WINDOW_MINUTES} minutes. Please check the list before saving again.`,
          duplicate: recentCashierDuplicate,
          canOverride: false,
          duplicatePolicy: "cashier-block"
        });
        return;
      }

      const duplicate = allowDuplicate
        ? null
        : await findSameDayDuplicateTransaction({ customerName, phoneNumber, amount, referenceStamp: createdAt });

      if (duplicate) {
        sendJson(res, 409, {
          message: "A similar transaction was already saved on this date.",
          duplicate,
          canOverride: true,
          duplicatePolicy: "same-day-warning"
        });
        return;
      }

      const transaction = {
        id: `tx-${Date.now()}`,
        type,
        customerName,
        amount,
        phoneNumber,
        profit: calculateProfit(type, amount),
        createdById: user.id,
        createdByName: user.fullName,
        createdAt,
        updatedAt: createdAt
      };

      await pool.query(
        `INSERT INTO transactions (
          id, type, customer_name, amount, phone_number, profit,
          created_by_id, created_by_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          transaction.id,
          transaction.type,
          transaction.customerName,
          transaction.amount,
          transaction.phoneNumber,
          transaction.profit,
          transaction.createdById,
          transaction.createdByName,
          transaction.createdAt,
          transaction.updatedAt
        ]
      );

      sendJson(res, 201, { transaction });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/transactions/import-image") {
    const user = await requireSessionUser(req, res);
    if (!user) {
      return;
    }

    const body = await readJsonBody(req);
    const imagePayload = normalizeImageImportPayload(body);

    if (!imagePayload.fullImageDataUrl) {
      sendJson(res, 400, { message: "Please upload a valid image." });
      return;
    }

    const extracted = await extractTransactionFromImage(imagePayload);
    const extractedTransactions = Array.isArray(extracted.transactions) ? extracted.transactions : [];
    const validTransactions = extractedTransactions
      .map((item) => buildImportedDraft(item))
      .filter(Boolean);

    if (!validTransactions.length) {
      sendJson(res, 422, {
        message: "The image was read, but the transaction details were not clear enough to fill the form automatically."
      });
      return;
    }

    sendJson(res, 200, {
      draft: validTransactions[0],
      drafts: validTransactions,
      extracted
    });
    return;
  }

  const transactionMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);
  if (transactionMatch) {
    const user = await requireSessionUser(req, res);
    if (!user) {
      return;
    }

    const transactionId = decodeURIComponent(transactionMatch[1]);

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const existing = await getTransactionById(transactionId);

      if (!existing) {
        sendJson(res, 404, { message: "Transaction not found." });
        return;
      }

      const type = String(body.type || "");
      const customerName = sanitizeCustomerName(body.customerName);
      const amount = toNumber(body.amount);
      const phoneNumber = String(body.phoneNumber || "").trim();

      if (!customerName || !isValidCustomerName(customerName) || !["ငွေထုတ်", "ငွေသွင်း"].includes(type)) {
        sendJson(res, 400, { message: "Valid transaction details are required." });
        return;
      }

      if (needsCustomerNameSpaces(customerName)) {
        sendJson(res, 400, { message: "Please add space btw words for the name." });
        return;
      }

      if (amount <= 0) {
        sendJson(res, 400, { message: "Amount must be greater than 0." });
        return;
      }

      if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
        sendJson(res, 400, { message: "Phone number must start with 09 and have 9 to 11 digits." });
        return;
      }

      const updatedTransaction = {
        id: existing.id,
        type,
        customerName,
        amount,
        phoneNumber,
        profit: calculateProfit(type, amount),
        createdById: existing.createdById,
        createdByName: existing.createdByName,
        createdAt: existing.createdAt,
        updatedAt: nowStamp()
      };

      await pool.query(
        `UPDATE transactions
         SET type = $2,
             customer_name = $3,
             amount = $4,
             phone_number = $5,
             profit = $6,
             updated_at = $7
         WHERE id = $1`,
        [
          updatedTransaction.id,
          updatedTransaction.type,
          updatedTransaction.customerName,
          updatedTransaction.amount,
          updatedTransaction.phoneNumber,
          updatedTransaction.profit,
          updatedTransaction.updatedAt
        ]
      );

      sendJson(res, 200, { transaction: updatedTransaction });
      return;
    }

    if (req.method === "DELETE") {
      await pool.query("DELETE FROM transactions WHERE id = $1", [transactionId]);
      sendJson(res, 200, { id: transactionId });
      return;
    }
  }

  sendJson(res, 404, { message: "Not found" });
}

function serveStaticFile(pathname, res) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);
  const relativePath = path.relative(root, filePath);

  if (
    !filePath.startsWith(root) ||
    relativePath.split(path.sep).some((segment) => segment.startsWith(".")) ||
    relativePath.split(path.sep).includes("node_modules")
  ) {
    send(res, 403, "text/plain; charset=utf-8", "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        send(res, 404, "text/plain; charset=utf-8", "Not found");
        return;
      }

      send(res, 500, "text/plain; charset=utf-8", "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, mimeTypes[ext] || "application/octet-stream", data);
  });
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      amount NUMERIC(14, 2) NOT NULL,
      phone_number TEXT NOT NULL DEFAULT '',
      profit NUMERIC(14, 2) NOT NULL,
      created_by_id TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const existingAdmin = await pool.query("SELECT 1 FROM users WHERE username = 'admin' LIMIT 1");
  if (!existingAdmin.rowCount) {
    await pool.query(
      `INSERT INTO users (id, full_name, username, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "user-admin",
        "System Admin",
        "admin",
        hashPassword("admin123"),
        "admin",
        nowStamp()
      ]
    );
  }
}

async function getHealthStatus() {
  const startedAt = process.uptime();

  try {
    await pool.query("SELECT 1");
    return {
      ok: true,
      database: "ok",
      uptimeSeconds: Math.floor(startedAt),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("[health] Database health check failed", error);
    return {
      ok: false,
      database: "error",
      uptimeSeconds: Math.floor(startedAt),
      timestamp: new Date().toISOString(),
      message: "Database health check failed."
    };
  }
}

async function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionToken = cookies.session_token;

  if (!sessionToken || !sessions.has(sessionToken)) {
    return null;
  }

  const userId = sessions.get(sessionToken);
  const result = await pool.query(
    "SELECT id, full_name, username, role, created_at FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );

  return result.rows[0] ? sanitizeUserRow(result.rows[0]) : null;
}

async function requireSessionUser(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { message: "Please log in." });
    return null;
  }

  return user;
}

async function listTransactions() {
  const result = await pool.query(
    `SELECT
      id,
      type,
      customer_name,
      amount,
      phone_number,
      profit,
      created_by_id,
      created_by_name,
      created_at,
      updated_at
     FROM transactions
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapTransactionRow);
}

async function getTransactionById(id) {
  const result = await pool.query(
    `SELECT
      id,
      type,
      customer_name,
      amount,
      phone_number,
      profit,
      created_by_id,
      created_by_name,
      created_at,
      updated_at
     FROM transactions
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] ? mapTransactionRow(result.rows[0]) : null;
}

function mapTransactionRow(row) {
  return {
    id: row.id,
    type: row.type,
    customerName: row.customer_name,
    amount: Number(row.amount),
    phoneNumber: row.phone_number,
    profit: Number(row.profit),
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findSameDayDuplicateTransaction({ customerName, phoneNumber, amount, referenceStamp }) {
  const normalizedCustomerName = normalizeText(customerName);
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const referenceDate = getStampDate(referenceStamp);
  if (!normalizedCustomerName || amount <= 0) {
    return null;
  }

  if (!referenceDate) {
    return null;
  }

  const result = await pool.query(
    `SELECT
      id,
      type,
      customer_name,
      amount,
      phone_number,
      profit,
      created_by_id,
      created_by_name,
      created_at,
      updated_at
     FROM transactions
     WHERE lower(customer_name) = $1
       AND amount = $2
       AND regexp_replace(phone_number, '[^0-9]', '', 'g') = $3
       AND left(created_at, 10) = $4
     ORDER BY created_at DESC
     LIMIT 5`,
    [normalizedCustomerName, amount, normalizedPhoneNumber, referenceDate]
  );

  for (const row of result.rows) {
    return mapTransactionRow(row);
  }

  return null;
}

async function findRecentDuplicateTransaction({ customerName, phoneNumber, amount, referenceStamp, createdById, windowMinutes }) {
  const normalizedCustomerName = normalizeText(customerName);
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const referenceDate = getStampDate(referenceStamp);
  const referenceTime = parseStampToUtcMs(referenceStamp);

  if (!normalizedCustomerName || amount <= 0 || !createdById || !Number.isFinite(referenceTime)) {
    return null;
  }

  if (!referenceDate) {
    return null;
  }

  const result = await pool.query(
    `SELECT
      id,
      type,
      customer_name,
      amount,
      phone_number,
      profit,
      created_by_id,
      created_by_name,
      created_at,
      updated_at
     FROM transactions
     WHERE lower(customer_name) = $1
       AND amount = $2
       AND regexp_replace(phone_number, '[^0-9]', '', 'g') = $3
       AND created_by_id = $4
       AND left(created_at, 10) = $5
     ORDER BY created_at DESC
     LIMIT 10`,
    [normalizedCustomerName, amount, normalizedPhoneNumber, createdById, referenceDate]
  );

  for (const row of result.rows) {
    const transaction = mapTransactionRow(row);
    const createdTime = parseStampToUtcMs(transaction.createdAt);

    if (!Number.isFinite(createdTime)) {
      continue;
    }

    const minutesApart = Math.abs(referenceTime - createdTime) / 60000;
    if (minutesApart <= windowMinutes) {
      return transaction;
    }
  }

  return null;
}

function sanitizeUserRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    createdAt: row.created_at
  };
}

function createSessionCookie(token) {
  return `session_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`;
}

function expireSessionCookie() {
  return "session_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((cookies, chunk) => {
      const separatorIndex = chunk.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = chunk.slice(0, separatorIndex);
      const value = chunk.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_JSON_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function send(res, statusCode, contentType, body) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, "application/json; charset=utf-8", JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sanitizeCustomerName(value) {
  return String(value || "")
    .replace(/[^\p{L}\p{M}\s]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isValidCustomerName(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && normalized === sanitizeCustomerName(normalized);
}

function needsCustomerNameSpaces(value) {
  const normalized = String(value || "").trim();
  return /^[\p{Script=Latin}\p{M}]{2,6}$/u.test(normalized);
}

function isValidPhoneNumber(value) {
  return /^09\d{7,9}$/.test(String(value || "").trim());
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numeric = Number(normalizeAmountText(value).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeAmountText(value) {
  return String(value || "")
    .replace(/[−–—]/g, "-")
    .replace(/[＋]/g, "+");
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

function isSupportedImageDataUrl(value) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(value);
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeImageImportPayload(body) {
  const fullImageDataUrl = String(body.fullImageDataUrl || body.imageDataUrl || "").trim();
  const amountImageDataUrl = String(body.amountImageDataUrl || "").trim();
  const detailsImageDataUrl = String(body.detailsImageDataUrl || "").trim();
  const nameImageDataUrl = String(body.nameImageDataUrl || "").trim();
  const transferNameImageDataUrl = String(body.transferNameImageDataUrl || "").trim();
  const englishTransferRowImageDataUrl = String(body.englishTransferRowImageDataUrl || "").trim();
  const myanmarRecipientImageDataUrl = String(body.myanmarRecipientImageDataUrl || "").trim();
  const phoneImageDataUrl = String(body.phoneImageDataUrl || "").trim();
  const fallbackType = normalizeTransactionType(body.fallbackType);

  return {
    fullImageDataUrl: isSupportedImageDataUrl(fullImageDataUrl) ? fullImageDataUrl : "",
    amountImageDataUrl: isSupportedImageDataUrl(amountImageDataUrl) ? amountImageDataUrl : "",
    detailsImageDataUrl: isSupportedImageDataUrl(detailsImageDataUrl) ? detailsImageDataUrl : "",
    nameImageDataUrl: isSupportedImageDataUrl(nameImageDataUrl) ? nameImageDataUrl : "",
    transferNameImageDataUrl: isSupportedImageDataUrl(transferNameImageDataUrl) ? transferNameImageDataUrl : "",
    englishTransferRowImageDataUrl: isSupportedImageDataUrl(englishTransferRowImageDataUrl) ? englishTransferRowImageDataUrl : "",
    myanmarRecipientImageDataUrl: isSupportedImageDataUrl(myanmarRecipientImageDataUrl) ? myanmarRecipientImageDataUrl : "",
    phoneImageDataUrl: isSupportedImageDataUrl(phoneImageDataUrl) ? phoneImageDataUrl : "",
    fallbackType
  };
}

function normalizeTransactionType(value) {
  const normalized = normalizeText(value);

  if (
    ["ငွေထုတ်", "withdraw", "cash out", "withdrawal"].includes(normalized) ||
    normalized.includes("ငွေထုတ်") ||
    normalized.includes("withdraw") ||
    normalized.includes("cash out") ||
    normalized.includes("cash-out") ||
    normalized.includes("sent") ||
    normalized.includes("transfer out") ||
    normalized.includes("outgoing")
  ) {
    return "ငွေထုတ်";
  }

  if (
    ["ငွေသွင်း", "deposit", "cash in"].includes(normalized) ||
    normalized.includes("ငွေသွင်း") ||
    normalized.includes("deposit") ||
    normalized.includes("cash in") ||
    normalized.includes("cash-in") ||
    normalized.includes("received") ||
    normalized.includes("receive") ||
    normalized.includes("transfer in") ||
    normalized.includes("incoming")
  ) {
    return "ငွေသွင်း";
  }

  return "";
}

async function extractTransactionFromImage(imagePayload) {
  if (!GEMINI_API_KEY) {
    const error = new Error("Gemini OCR is not configured yet. Add GEMINI_API_KEY to your .env file.");
    error.statusCode = 500;
    throw error;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: buildGeminiImageImportParts(imagePayload)
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(getGeminiErrorMessage(payload) || "Gemini could not read this image right now.");
      error.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
      throw error;
    }

    const text = extractGeminiText(payload);
    const transaction = parseGeminiImageImport(text, imagePayload.fallbackType);

    return {
      transactions: transaction ? [transaction] : [],
      notes: text
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    const geminiError = new Error("Gemini could not read this image clearly.");
    geminiError.statusCode = 502;
    throw geminiError;
  }
}

function buildGeminiImageImportParts(imagePayload) {
  const fallbackType = normalizeTransactionType(imagePayload.fallbackType);
  const parts = [
    {
        text: [
          "Extract a single transaction from this payment receipt image and return JSON only.",
            "Fields:",
            '- "type": exactly "ငွေထုတ်", "ငွေသွင်း", or ""',
          '- "customerName": the correct person name for this app; never include currency, IDs, reference numbers, labels, or extra words',
          '- "amount": the money amount only, as digits without sign or commas if possible',
          '- "phoneNumber": only a real standalone phone number if visibly shown; otherwise ""',
          "Rules:",
          "- Ignore transaction IDs, reference numbers, and account numbers.",
          "- The amount is the visible money amount, even if shown with a negative sign.",
          "- Determine transaction type from the explicit receipt text/field value first, especially the transaction-type row on the detail section.",
          "- For this app's business rule: '+' amount means 'ငွေထုတ်' and '-' amount means 'ငွေသွင်း' when you need to infer type from the sign.",
          "- Do not decide transaction type from the minus/plus sign alone when the receipt text clearly shows a transaction type.",
            '- If type is "ငွေထုတ်", set customerName from the sender/payor field such as "ပေးပို့သူ".',
              '- If type is "ငွေသွင်း", set customerName from the receiver/account-name field such as "ငွေလွှဲမည်သူ" or the visible recipient name.',
              '- For English receipts, prefer the value beside labels like "Transfer To", "Transfer From", "Receiver", "Sender", "Account Name", "To", or "From".',
              '- If a name line includes a masked number in parentheses, keep only the person name and ignore the masked number.',
              '- Example: if the receipt shows "Transfer To  MA BRIGIP (******9679)", return customerName as "MA BRIGIP".',
              '- For Burmese detail receipts, the useful person name is often the lower-right value under the transaction type row. Prefer that value over nearby labels.',
              "- Never use product descriptions, labels, service names, or merchant text as customerName.",
              "- Only use the fallback type if the receipt text is genuinely unclear or missing.",
              "- If the name is unclear, return an empty string instead of guessing."
            ].join("\n")
          }
    ];

  if (fallbackType) {
    parts.push({ text: `Fallback transaction type if the receipt is unclear: ${fallbackType}` });
  }

  if (imagePayload.fullImageDataUrl) {
    parts.push({ text: "Full receipt image:" });
    parts.push(makeGeminiInlineDataPart(imagePayload.fullImageDataUrl));
  }

  if (imagePayload.amountImageDataUrl) {
    parts.push({ text: "Amount crop:" });
    parts.push(makeGeminiInlineDataPart(imagePayload.amountImageDataUrl));
  }

  if (imagePayload.detailsImageDataUrl) {
    parts.push({ text: "Details crop:" });
    parts.push(makeGeminiInlineDataPart(imagePayload.detailsImageDataUrl));
  }

  if (imagePayload.nameImageDataUrl) {
    parts.push({ text: "Name crop:" });
    parts.push(makeGeminiInlineDataPart(imagePayload.nameImageDataUrl));
  }

  if (imagePayload.transferNameImageDataUrl) {
    parts.push({ text: "Focused transfer-name value crop (for labels like Transfer To / Transfer From / Receiver / Sender):" });
    parts.push(makeGeminiInlineDataPart(imagePayload.transferNameImageDataUrl));
  }

  if (imagePayload.englishTransferRowImageDataUrl) {
    parts.push({ text: "English transfer row crop (label and value together, such as Transfer To + person name):" });
    parts.push(makeGeminiInlineDataPart(imagePayload.englishTransferRowImageDataUrl));
  }

  if (imagePayload.myanmarRecipientImageDataUrl) {
    parts.push({ text: "Myanmar receipt name-value crop from the lower-right detail area:" });
    parts.push(makeGeminiInlineDataPart(imagePayload.myanmarRecipientImageDataUrl));
  }

  if (imagePayload.phoneImageDataUrl) {
    parts.push({ text: "Phone/account-number crop:" });
    parts.push(makeGeminiInlineDataPart(imagePayload.phoneImageDataUrl));
  }

  return parts;
}

function makeGeminiInlineDataPart(imageDataUrl) {
  const match = String(imageDataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const error = new Error("Please upload a valid image.");
    error.statusCode = 400;
    throw error;
  }

  return {
    inlineData: {
      mimeType: match[1],
      data: match[2]
    }
  };
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates.flatMap((candidate) => candidate?.content?.parts || []);
  const text = parts.map((part) => part?.text || "").join("\n").trim();
  return text;
}

function getGeminiErrorMessage(payload) {
  return payload?.error?.message || "";
}

function parseGeminiImageImport(text, fallbackType = "") {
  const raw = parseJsonText(text);
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const detectedType = normalizeTransactionType(raw.type);
  const type = detectedType || normalizeTransactionType(fallbackType);
  const amount = toNumber(raw.amount);
  const customerName = sanitizeDetectedName(raw.customerName || "");
  const phoneNumber = extractPhoneFromText(raw.phoneNumber || "");

  if (!type || amount <= 0) {
    return null;
  }

  return {
    type,
    amount,
    customerName,
    phoneNumber
  };
}

function parseJsonText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/);
    if (!fencedMatch) {
      return null;
    }

    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (nestedError) {
      return null;
    }
  }
}

function parseTransactionsFromOcrText(ocrPayload) {
  const fullText = typeof ocrPayload === "string" ? ocrPayload : String(ocrPayload?.fullText || "");
  const amountText = typeof ocrPayload === "string" ? "" : String(ocrPayload?.amountText || "");
  const detailsText = typeof ocrPayload === "string" ? "" : String(ocrPayload?.detailsText || "");
  const nameText = typeof ocrPayload === "string" ? "" : String(ocrPayload?.nameText || "");
  const phoneText = typeof ocrPayload === "string" ? "" : String(ocrPayload?.phoneText || "");
  const fallbackType = typeof ocrPayload === "string" ? "" : normalizeTransactionType(ocrPayload?.fallbackType);
  const rawText = [fullText, detailsText].filter(Boolean).join("\n");
  const compactText = [fullText, amountText, detailsText, nameText, phoneText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const detailTransaction = extractTransactionFromDetailView(lines, compactText, { amountText, detailsText, nameText, phoneText, fallbackType });

  return {
    transactions: detailTransaction ? [detailTransaction] : extractTransactionsFromLines(lines, compactText, fallbackType),
    notes: compactText
  };
}

function extractTransactionFromDetailView(lines, compactText, extractedRegions = {}) {
  const amountMatch = findBestDetailAmount(lines, compactText, extractedRegions.amountText);
  const rawAmount = amountMatch?.rawAmount || "";
  const amount = amountMatch?.amount || 0;

  if (amount <= 0) {
    return null;
  }

  const sign = getAmountSign(rawAmount);
  const typeText = [compactText, extractedRegions.detailsText, extractedRegions.amountText, extractedRegions.nameText].filter(Boolean).join(" ");
  const detectedType = detectTransactionType(typeText);
  const type = detectedType || extractedRegions.fallbackType || inferTransactionTypeFromSign(sign) || "ငွေထုတ်";
  if (!type) {
    return null;
  }

  const phoneNumber = detectPhoneNearLine(lines, Math.max(0, Math.floor(lines.length / 2)), extractedRegions.phoneText);
  const customerName = detectDetailCustomerName(lines, {
    phoneNumber,
    rawAmount,
    type,
    explicitNameText: extractedRegions.nameText,
    contextText: [extractedRegions.detailsText, compactText].filter(Boolean).join("\n")
  })
    || detectCustomerNameAroundLine(lines, amountMatch?.lineIndex ?? Math.floor(lines.length / 2), phoneNumber)
    || phoneNumber
    || "OCR Import";

  return {
    customerName,
    amount,
    phoneNumber,
    type,
    confidence: 0.9
  };
}

function findBestDetailAmount(lines, compactText, amountText = "") {
  const candidates = [];
  const sourceLines = Array.isArray(lines) ? lines : [];

  sourceLines.forEach((line, index) => {
    const matches = normalizeAmountText(line).match(/[+-]?\s*\d[\d,]*(?:\.\d{1,2})?/g) || [];
    matches.forEach((match) => {
      const rawAmount = match.replace(/\s+/g, "");
      const amount = toNumber(rawAmount);
      if (amount > 0) {
        candidates.push({
          rawAmount,
          amount,
          lineIndex: index,
          priority: getAmountPriority(rawAmount, line)
        });
      }
    });
  });

  if (!candidates.length) {
    const compactMatches = normalizeAmountText(`${amountText} ${compactText}`).match(/[+-]?\s*\d[\d,]*(?:\.\d{1,2})?/g) || [];
    compactMatches.forEach((match) => {
      const rawAmount = match.replace(/\s+/g, "");
      const amount = toNumber(rawAmount);
      if (amount > 0) {
        candidates.push({
          rawAmount,
          amount,
          lineIndex: -1,
          priority: getAmountPriority(rawAmount, `${amountText} ${compactText}`)
        });
      }
    });
  }

  return candidates.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return right.amount - left.amount;
  })[0] || null;
}

function getAmountPriority(rawAmount, sourceText = "") {
  const normalizedAmount = normalizeAmountText(rawAmount).trim();
  const normalizedSource = normalizeAmountText(sourceText);
  let score = 0;

  if (getAmountSign(normalizedAmount)) {
    score += 5;
  }

  if (normalizedAmount.includes(",") || normalizedAmount.includes(".")) {
    score += 4;
  }

  if (/ks|kyat|mmk/i.test(normalizedSource)) {
    score += 3;
  }

  const digitsOnly = normalizedAmount.replace(/[^\d]/g, "");
  if (digitsOnly.length >= 4 && digitsOnly.length <= 9) {
    score += 2;
  }

  if (digitsOnly.length >= 12) {
    score -= 6;
  }

  return score;
}

function extractTransactionsFromLines(lines, compactText, fallbackType = "") {
  const transactions = [];

  lines.forEach((line, index) => {
    const normalizedLine = normalizeAmountText(line);
    const signedAmountMatch = normalizedLine.match(/[+-]\s*\d[\d,]*(?:\.\d{1,2})?/);
    const unsignedAmountMatch = signedAmountMatch ? null : normalizedLine.match(/\d[\d,]*(?:\.\d{1,2})?/);
    const amountMatch = signedAmountMatch || unsignedAmountMatch;

    if (!amountMatch) {
      return;
    }

    const rawAmount = amountMatch[0].replace(/\s+/g, "");
    const amount = toNumber(rawAmount);
    if (amount <= 0) {
      return;
    }

    const sign = getAmountSign(rawAmount);
    const surroundingText = [lines[index - 1], lines[index], lines[index + 1]].filter(Boolean).join(" ");
    const detectedType = detectTransactionType(surroundingText || compactText);
    const inferredType = detectedType || inferTransactionTypeFromSign(sign) || fallbackType || "ငွေထုတ်";
    if (!inferredType) {
      return;
    }

    const phoneNumber = detectPhoneNearLine(lines, index);
    const customerName = detectCustomerNameAroundLine(lines, index, phoneNumber) || phoneNumber || "OCR Import";

    transactions.push({
      customerName,
      amount,
      phoneNumber,
      type: inferredType,
      confidence: sign ? 0.82 : 0.62
    });
  });

  return dedupeExtractedTransactions(transactions);
}

function getAmountSign(rawAmount) {
  const normalized = normalizeAmountText(rawAmount).trim();
  if (normalized.startsWith("-")) {
    return "-";
  }

  if (normalized.startsWith("+")) {
    return "+";
  }

  return "";
}

function detectTransactionType(text) {
  const normalized = normalizeText(text);

  if (
    normalized.includes("ငွေထုတ်") ||
    normalized.includes("ငွလထတ") ||
    normalized.includes("withdraw") ||
    normalized.includes("cash out") ||
    normalized.includes("sent")
  ) {
    return "ငွေထုတ်";
  }

  if (
    normalized.includes("ငွေသွင်း") ||
    normalized.includes("ငွသင") ||
    normalized.includes("လဲ") ||
    normalized.includes("deposit") ||
    normalized.includes("cash in") ||
    normalized.includes("received")
  ) {
    return "ငွေသွင်း";
  }

  return "";
}

function inferTransactionTypeFromSign(sign) {
  if (sign === "-") {
    return "ငွေသွင်း";
  }

  if (sign === "+") {
    return "ငွေထုတ်";
  }

  return "";
}

function detectPhoneNearLine(lines, startIndex, explicitPhoneText = "") {
  const explicitPhone = extractPhoneFromText(explicitPhoneText);
  if (explicitPhone) {
    return explicitPhone;
  }

  for (let index = Math.max(0, startIndex - 2); index <= Math.min(lines.length - 1, startIndex + 2); index += 1) {
    const line = String(lines[index] || "").trim();
    if (!line) {
      continue;
    }

    const phoneNumber = extractPhoneFromText(line);
    if (phoneNumber) {
      return phoneNumber;
    }
  }

  return "";
}

function extractPhoneFromText(text) {
  const normalized = String(text || "")
    .replace(/[^\d+\s-]/g, " ")
    .replace(/\s+/g, " ");
  const matches = normalized.match(/(?<!\d)(?:\+?95|09)[\d\s-]{7,14}(?!\d)/g) || [];

  for (const match of matches) {
    const compact = match.replace(/[^\d+]/g, "");
    if (/^09\d{7,9}$/.test(compact)) {
      return compact;
    }

    if (/^\+?959\d{7,9}$/.test(compact)) {
      return `0${compact.replace(/^\+?95/, "")}`;
    }
  }

  return "";
}

function detectCustomerNameAroundLine(lines, amountIndex, phoneNumber) {
  const ignoredPatterns = [
    /^[+-]?\d[\d,]*(?:\.\d{1,2})?$/,
    /mmk/i,
    /kyat/i,
    /date/i,
    /time/i,
    /balance/i,
    /profit/i,
    /transaction/i,
    /receipt/i,
    /wave/i,
    /kbz/i,
    /cash\s*(in|out)/i,
    /deposit/i,
    /withdraw/i,
    /today/i,
    /^\d{1,2}:\d{2}(?::\d{2})?$/,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
  ];

  for (let offset = 1; offset <= 3; offset += 1) {
    const candidates = [lines[amountIndex - offset], lines[amountIndex + offset]];

    for (const line of candidates) {
    if (!line || line === phoneNumber) {
      continue;
    }

    if (ignoredPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    if (/\d{5,}/.test(line)) {
      continue;
    }

    return line;
    }
  }

  return "";
}

function detectDetailCustomerName(lines, { phoneNumber, rawAmount, type, explicitNameText = "", contextText = "" }) {
  const normalizedType = normalizeTransactionType(type);
  const amountDigits = String(rawAmount || "").replace(/[^\d]/g, "");
  const explicitName = sanitizeDetectedName(explicitNameText);
  if (explicitName) {
    return explicitName;
  }
  const contextualName = detectLatinStyleName(contextText);
  if (contextualName) {
    return contextualName;
  }
  const ignoredPatterns = [
    /details/i,
    /ok/i,
    /success/i,
    /received/i,
    /sent/i,
    /transaction/i,
    /balance/i,
    /amount/i,
    /date/i,
    /time/i,
    /ks/i,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/,
    /^\d{1,2}:\d{2}(?::\d{2})?/,
    /^[+-]?\d[\d,]*(?:\.\d{1,2})?$/
  ];

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = String(lines[index] || "").trim();
    if (!line || line === phoneNumber) {
      continue;
    }

    if (normalizeTransactionType(line) === normalizedType) {
      continue;
    }

    if (amountDigits && line.replace(/[^\d]/g, "").includes(amountDigits)) {
      continue;
    }

    if (ignoredPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    if (/\d{5,}/.test(line)) {
      continue;
    }

    if (!/[A-Za-z\u1000-\u109F]/.test(line)) {
      continue;
    }

    return line;
  }

  return "";
}

function sanitizeDetectedName(value) {
  const candidates = String(value || "")
    .split(/\r?\n/)
    .map((line) => sanitizeDetectedNameLine(line))
    .filter(Boolean)
    .sort((left, right) => scoreNameCandidate(right) - scoreNameCandidate(left));

  return candidates.find((candidate) => scoreNameCandidate(candidate) > 0) || "";
}

function sanitizeDetectedNameLine(value) {
  let line = String(value || "")
      .replace(/[+-]?\s*\d[\d,]*(?:\.\d{1,2})?/g, " ")
      .replace(/\b(?:ks|kyat|mmk)\b/gi, " ")
      .replace(/\(\s*[*xX\d-]{3,}\s*\)/g, " ")
      .replace(/[|:;~_=]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!line) {
    return "";
  }

  if (/\d{5,}/.test(line)) {
    return "";
  }

  if (!/[A-Za-z\u1000-\u109F]/.test(line)) {
    return "";
  }

  if (/details|ok|transaction|amount|balance|date|time|ks/i.test(line)) {
    return "";
  }

  if (/\b[A-Za-z]$/.test(line) && /\s/.test(line)) {
    line = line.replace(/\s+[A-Za-z]$/, "").trim();
  }

  return normalizeLikelyPersonName(repairLikelyMyanmarLatinName(line));
}

function detectLatinStyleName(text) {
  const candidates = String(text || "")
    .split(/\r?\n/)
    .map((line) => sanitizeDetectedNameLine(line))
    .filter((line) => /^[A-Za-z][A-Za-z\s.'-]+$/.test(line) && line.split(/\s+/).length >= 2)
    .sort((left, right) => scoreNameCandidate(right) - scoreNameCandidate(left));

  return candidates.find((candidate) => scoreNameCandidate(candidate) > 0) || "";
}

function repairLikelyMyanmarLatinName(value) {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return "";
  }

  const lastToken = tokens[tokens.length - 1];
  if (/^aun$/i.test(lastToken) || /^au$/i.test(lastToken)) {
    tokens[tokens.length - 1] = preserveWordCase(lastToken, "Aung");
  }

  return tokens.join(" ");
}

function normalizeLikelyPersonName(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (!/^[A-Za-z\s.'-]+$/.test(text)) {
    return text;
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return "";
  }

  return tokens.map((token) => {
    if (token === token.toUpperCase() || token === token.toLowerCase()) {
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }

    return token;
  }).join(" ");
}

function scoreNameCandidate(value) {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return -10;
  }

  let score = 0;

  if (tokens.length >= 2 && tokens.length <= 4) {
    score += 3;
  }

  for (const token of tokens) {
    if (/^[A-Z][a-z.'-]{1,}$/.test(token)) {
      score += 3;
      continue;
    }

    if (/^[\u1000-\u109F]+$/.test(token)) {
      score += 3;
      continue;
    }

    if (/^[A-Z]{3,}$/.test(token)) {
      score += 2;
      continue;
    }

    if (/^[a-z]{2,}$/.test(token)) {
      score += 1;
      continue;
    }

    score -= 1;
  }

  if (/^[a-z]/.test(tokens[0])) {
    score -= 1;
  }

  if (tokens.some((token) => token.length === 1)) {
    score -= 2;
  }

  return score;
}

function preserveWordCase(source, replacement) {
  if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }

  if (source === source.toLowerCase()) {
    return replacement.toLowerCase();
  }

  if (source[0] === source[0]?.toUpperCase()) {
    return replacement;
  }

  return replacement.toLowerCase();
}

function dedupeExtractedTransactions(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.type}|${item.amount}|${normalizeText(item.customerName)}|${item.phoneNumber}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildImportedDraft(item) {
  const type = normalizeTransactionType(item.type);
  const amount = toNumber(item.amount);
  const customerName = sanitizeDetectedName(String(item.customerName || ""));
  const phoneNumber = String(item.phoneNumber || "").trim();

  if (!type || amount <= 0) {
    return null;
  }

  return {
    type,
    customerName,
    amount,
    phoneNumber
  };
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function nowStamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hours = parts.hour;
  const minutes = parts.minute;
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getStampDate(value) {
  return String(value || "").slice(0, 10);
}

function parseStampToUtcMs(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) {
    return NaN;
  }

  const [, year, month, day, hour, minute] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception", error);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("[process] SIGTERM received, closing database pool");
  try {
    await pool.end();
  } catch (error) {
    console.error("[process] Failed to close database pool on SIGTERM", error);
  } finally {
    process.exit(0);
  }
});

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
