const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

loadEnvFile(path.join(__dirname, ".env"));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to .env before running a backup.");
}

const pool = new Pool({
  connectionString: databaseUrl
});

async function main() {
  const timestamp = getBackupTimestamp();
  const backupDir = path.join(__dirname, "backups", timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const [usersResult, transactionsResult] = await Promise.all([
    pool.query(`
      SELECT id, full_name, username, role, created_at
      FROM users
      ORDER BY created_at DESC
    `),
    pool.query(`
      SELECT
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
      ORDER BY created_at DESC
    `)
  ]);

  const users = usersResult.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    createdAt: row.created_at
  }));

  const transactions = transactionsResult.rows.map((row) => ({
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
  }));

  writeJson(path.join(backupDir, "users.json"), users);
  writeJson(path.join(backupDir, "transactions.json"), transactions);
  writeCsv(path.join(backupDir, "users.csv"), users, [
    "id",
    "fullName",
    "username",
    "role",
    "createdAt"
  ]);
  writeCsv(path.join(backupDir, "transactions.csv"), transactions, [
    "id",
    "type",
    "customerName",
    "amount",
    "phoneNumber",
    "profit",
    "createdById",
    "createdByName",
    "createdAt",
    "updatedAt"
  ]);
  writeJson(path.join(backupDir, "summary.json"), {
    createdAt: new Date().toISOString(),
    users: users.length,
    transactions: transactions.length
  });

  console.log(`Backup created in ${backupDir}`);
  console.log(`Users: ${users.length}`);
  console.log(`Transactions: ${transactions.length}`);
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function writeCsv(filePath, rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(","));
  fs.writeFileSync(filePath, [header, ...lines].join("\n"));
}

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function getBackupTimestamp() {
  const date = new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
