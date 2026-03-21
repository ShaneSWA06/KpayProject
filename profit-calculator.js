const fs = require("fs");
const path = require("path");

const workspace = __dirname;
const transactionsPath = path.join(workspace, "transactions.csv");
const ratesPath = path.join(workspace, "provider-rates.json");

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((value) => value.trim());
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = { rowNumber: index + 2 };

    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] ?? "";
    });

    return row;
  });
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatMMK(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function getRates(providerName, ratesConfig) {
  const defaults = ratesConfig.defaults || {};
  const providerRates = (ratesConfig.providers || {})[providerName] || {};

  return {
    feeRatePercent: toNumber(providerRates.feeRatePercent, toNumber(defaults.feeRatePercent)),
    costRatePercent: toNumber(providerRates.costRatePercent, toNumber(defaults.costRatePercent)),
    fixedFeeMMK: toNumber(providerRates.fixedFeeMMK, toNumber(defaults.fixedFeeMMK)),
    fixedCostMMK: toNumber(providerRates.fixedCostMMK, toNumber(defaults.fixedCostMMK))
  };
}

function buildTransaction(row, ratesConfig) {
  const provider = row.provider || "Unknown";
  const amount = toNumber(row.amount_mmks);
  const configuredRates = getRates(provider, ratesConfig);

  const feeRatePercent = row.fee_rate_percent !== ""
    ? toNumber(row.fee_rate_percent)
    : configuredRates.feeRatePercent;
  const costRatePercent = row.cost_rate_percent !== ""
    ? toNumber(row.cost_rate_percent)
    : configuredRates.costRatePercent;
  const fixedFeeMMK = row.fixed_fee_mmks !== ""
    ? toNumber(row.fixed_fee_mmks)
    : configuredRates.fixedFeeMMK;
  const fixedCostMMK = row.fixed_cost_mmks !== ""
    ? toNumber(row.fixed_cost_mmks)
    : configuredRates.fixedCostMMK;

  const revenue = (amount * feeRatePercent) / 100 + fixedFeeMMK;
  const cost = (amount * costRatePercent) / 100 + fixedCostMMK;
  const profit = revenue - cost;

  return {
    rowNumber: row.rowNumber,
    date: row.date || "",
    provider,
    transactionType: row.transaction_type || "",
    customerName: row.customer_name || "",
    reference: row.reference || "",
    amount,
    feeRatePercent,
    costRatePercent,
    fixedFeeMMK,
    fixedCostMMK,
    revenue,
    cost,
    profit,
    notes: row.notes || ""
  };
}

function summarize(transactions) {
  const summary = {
    overall: {
      count: 0,
      amount: 0,
      revenue: 0,
      cost: 0,
      profit: 0
    },
    providers: {}
  };

  for (const tx of transactions) {
    if (!summary.providers[tx.provider]) {
      summary.providers[tx.provider] = {
        count: 0,
        amount: 0,
        revenue: 0,
        cost: 0,
        profit: 0
      };
    }

    const bucket = summary.providers[tx.provider];

    summary.overall.count += 1;
    summary.overall.amount += tx.amount;
    summary.overall.revenue += tx.revenue;
    summary.overall.cost += tx.cost;
    summary.overall.profit += tx.profit;

    bucket.count += 1;
    bucket.amount += tx.amount;
    bucket.revenue += tx.revenue;
    bucket.cost += tx.cost;
    bucket.profit += tx.profit;
  }

  return summary;
}

function printSummary(summary) {
  console.log("Kpay / WavePay Profit Summary");
  console.log("=============================");
  console.log("");
  console.log(
    `Overall: ${summary.overall.count} transactions | Amount ${formatMMK(summary.overall.amount)} MMK | Revenue ${formatMMK(summary.overall.revenue)} MMK | Cost ${formatMMK(summary.overall.cost)} MMK | Profit ${formatMMK(summary.overall.profit)} MMK`
  );
  console.log("");
  console.log("By provider:");

  for (const [provider, bucket] of Object.entries(summary.providers)) {
    console.log(
      `- ${provider}: ${bucket.count} transactions | Amount ${formatMMK(bucket.amount)} MMK | Revenue ${formatMMK(bucket.revenue)} MMK | Cost ${formatMMK(bucket.cost)} MMK | Profit ${formatMMK(bucket.profit)} MMK`
    );
  }
}

function printTransactions(transactions) {
  console.log("");
  console.log("Transaction details:");

  for (const tx of transactions) {
    console.log(
      `- Row ${tx.rowNumber}: ${tx.date} | ${tx.provider} | ${tx.transactionType} | ${tx.reference} | Amount ${formatMMK(tx.amount)} MMK | Profit ${formatMMK(tx.profit)} MMK`
    );
  }
}

function main() {
  if (!fs.existsSync(transactionsPath)) {
    console.error(`Missing file: ${transactionsPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(ratesPath)) {
    console.error(`Missing file: ${ratesPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(transactionsPath, "utf8");
  const ratesConfig = JSON.parse(fs.readFileSync(ratesPath, "utf8"));
  const rows = parseCsv(csvContent);
  const transactions = rows.map((row) => buildTransaction(row, ratesConfig));
  const summary = summarize(transactions);

  printSummary(summary);
  printTransactions(transactions);
}

main();
