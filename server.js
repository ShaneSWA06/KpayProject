const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const Tesseract = require("tesseract.js");

loadEnvFile(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Yangon";
const OCR_LANGUAGES = process.env.OCR_LANGUAGES || "eng";
const MAX_JSON_BODY_BYTES = 6_000_000;
const DUPLICATE_WARNING_WINDOW_MINUTES = 5;
const root = __dirname;
const sessions = new Map();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to .env or your environment variables.");
}

const pool = new Pool({
  connectionString: databaseUrl
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

async function start() {
  await initializeDatabase();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, error.statusCode || 500, { message: error.message || "Server error" });
    });
  });

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
    sendJson(res, 200, { ok: true });
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
      const customerName = String(body.customerName || "").trim();
      const amount = toNumber(body.amount);
      const phoneNumber = String(body.phoneNumber || "").trim();
      const allowDuplicate = Boolean(body.allowDuplicate);

      if (!customerName || amount <= 0 || !["ငွေထုတ်", "ငွေသွင်း"].includes(type)) {
        sendJson(res, 400, { message: "Valid transaction details are required." });
        return;
      }

      const createdAt = nowStamp();
      const duplicate = allowDuplicate
        ? null
        : await findRecentDuplicateTransaction({ type, customerName, amount, referenceStamp: createdAt });

      if (duplicate) {
        sendJson(res, 409, {
          message: "A similar transaction was already saved a few minutes ago.",
          duplicate
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
    const imageDataUrl = String(body.imageDataUrl || "").trim();

    if (!isSupportedImageDataUrl(imageDataUrl)) {
      sendJson(res, 400, { message: "Please upload a valid image." });
      return;
    }

    const extracted = await extractTransactionFromImage(imageDataUrl);
    const extractedTransactions = Array.isArray(extracted.transactions) ? extracted.transactions : [];
    const validTransactions = extractedTransactions
      .map((item, index) => buildImportedTransaction(item, user, index))
      .filter(Boolean);

    if (!validTransactions.length) {
      sendJson(res, 422, {
        message: "The image was read, but the transaction details were not clear enough to create automatically."
      });
      return;
    }

    for (const transaction of validTransactions) {
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
    }

    sendJson(res, 201, {
      transaction: validTransactions[0],
      transactions: validTransactions,
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
      const customerName = String(body.customerName || "").trim();
      const amount = toNumber(body.amount);
      const phoneNumber = String(body.phoneNumber || "").trim();

      if (!customerName || amount <= 0 || !["ငွေထုတ်", "ငွေသွင်း"].includes(type)) {
        sendJson(res, 400, { message: "Valid transaction details are required." });
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

async function findRecentDuplicateTransaction({ type, customerName, amount, referenceStamp }) {
  const normalizedCustomerName = normalizeText(customerName);
  if (!normalizedCustomerName || amount <= 0 || !["ငွေထုတ်", "ငွေသွင်း"].includes(type)) {
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
     WHERE type = $1
       AND lower(customer_name) = $2
       AND amount = $3
     ORDER BY created_at DESC
     LIMIT 5`,
    [type, normalizedCustomerName, amount]
  );

  const referenceTime = parseStampToUtcMs(referenceStamp);
  if (!Number.isFinite(referenceTime)) {
    return null;
  }

  for (const row of result.rows) {
    const transaction = mapTransactionRow(row);
    const createdTime = parseStampToUtcMs(transaction.createdAt);

    if (!Number.isFinite(createdTime)) {
      continue;
    }

    const minutesApart = Math.abs(referenceTime - createdTime) / 60000;
    if (minutesApart <= DUPLICATE_WARNING_WINDOW_MINUTES) {
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

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numeric = Number(String(value).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
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

async function extractTransactionFromImage(imageDataUrl) {
  const imageBuffer = decodeImageDataUrl(imageDataUrl);

  try {
    const result = await Tesseract.recognize(imageBuffer, OCR_LANGUAGES);
    return parseTransactionsFromOcrText(result.data && result.data.text ? result.data.text : "");
  } catch (error) {
    const ocrError = new Error("Local OCR could not read this image clearly.");
    ocrError.statusCode = 502;
    throw ocrError;
  }
}

function decodeImageDataUrl(imageDataUrl) {
  const match = imageDataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    const error = new Error("Please upload a valid image.");
    error.statusCode = 400;
    throw error;
  }

  return Buffer.from(match[1], "base64");
}

function parseTransactionsFromOcrText(text) {
  const rawText = String(text || "");
  const compactText = rawText.replace(/\s+/g, " ").trim();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    transactions: extractTransactionsFromLines(lines, compactText),
    notes: compactText
  };
}

function extractTransactionsFromLines(lines, compactText) {
  const transactions = [];

  lines.forEach((line, index) => {
    const signedAmountMatch = line.match(/[+-]\s*\d[\d,]*(?:\.\d{1,2})?/);
    const unsignedAmountMatch = signedAmountMatch ? null : line.match(/\d[\d,]*(?:\.\d{1,2})?/);
    const amountMatch = signedAmountMatch || unsignedAmountMatch;

    if (!amountMatch) {
      return;
    }

    const rawAmount = amountMatch[0].replace(/\s+/g, "");
    const amount = toNumber(rawAmount);
    if (amount <= 0) {
      return;
    }

    const sign = rawAmount.startsWith("-") ? "-" : rawAmount.startsWith("+") ? "+" : "";
    const surroundingText = [lines[index - 1], lines[index], lines[index + 1]].filter(Boolean).join(" ");
    const detectedType = detectTransactionType(surroundingText || compactText);
    const inferredType = detectedType || inferTransactionTypeFromSign(sign);
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

function detectTransactionType(text) {
  const normalized = normalizeText(text);

  if (
    normalized.includes("ငွေထုတ်") ||
    normalized.includes("withdraw") ||
    normalized.includes("cash out") ||
    normalized.includes("sent")
  ) {
    return "ငွေထုတ်";
  }

  if (
    normalized.includes("ငွေသွင်း") ||
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
    return "ငွေထုတ်";
  }

  if (sign === "+") {
    return "ငွေသွင်း";
  }

  return "";
}

function detectPhoneNearLine(lines, startIndex) {
  for (let index = Math.max(0, startIndex - 2); index <= Math.min(lines.length - 1, startIndex + 2); index += 1) {
    const match = String(lines[index] || "").match(/(?:\+?95|09)\d{7,11}/);
    if (match) {
      return match[0];
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

function buildImportedTransaction(item, user, index) {
  const type = normalizeTransactionType(item.type);
  const amount = toNumber(item.amount);
  const customerName = String(item.customerName || item.phoneNumber || "OCR Import").trim();
  const phoneNumber = String(item.phoneNumber || "").trim();

  if (!type || amount <= 0) {
    return null;
  }

  const createdAt = nowStamp();

  return {
    id: `tx-${Date.now()}-${index}`,
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

function parseStampToUtcMs(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) {
    return NaN;
  }

  const [, year, month, day, hour, minute] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
