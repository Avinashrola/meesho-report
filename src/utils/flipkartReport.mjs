const normalize = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const text = (value) => String(value ?? "").trim();
export const sumAmounts = (values) => values.reduce((total, value) => total + Math.round(value * 1e6), 0) / 1e6;

export function settlementAmount(value, allowBlank = false) {
  if (value === "" || value == null) {
    if (allowBlank) return 0;
    throw new Error("Missing settlement amount.");
  }
  const number = typeof value === "number" ? value : Number(String(value).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(number)) throw new Error(`Invalid settlement amount: ${value}`);
  return number;
}

const fields = {
  orderId: /^order id$/,
  itemId: /^order item id$/,
  sku: /^seller sku$/,
  neft: /^neft id$/,
  paymentType: /^neft type$/,
  paymentDate: /^payment date$/,
  bank: /^bank settlement value/,
  inputCredits: /^input gst \+ tcs credits/,
  incomeCredits: /^income tax credits/,
  sales: /^sale amount \(rs\.\)/,
  offers: /^total offer amount \(rs\.\)/,
  sellerShare: /^my share \(rs\.\)/,
  addOns: /^customer add-ons amount \(rs\.\)/,
  fees: /^marketplace fee \(rs\.\)/,
  taxes: /^taxes \(rs\.\)/,
  adjustments: /^offer adjustments \(rs\.\)/,
  protection: /^protection fund \(rs\.\)/,
  refunds: /^refund \(rs\.\)/,
  returnType: /^return type$/,
  returnStatus: /^item return status$/,
  shopsy: /^shopsy order$/,
  quantity: /^quantity$/,
};
const amountFields = ["bank", "inputCredits", "incomeCredits", "sales", "offers", "sellerShare", "addOns", "fees", "taxes", "adjustments", "protection", "refunds"];

export function aggregateTransactions(rows) {
  return {
    ...Object.fromEntries(amountFields.map((field) => [field, sumAmounts(rows.map((row) => row[field]))])),
    transactions: rows.length,
    uniqueOrders: new Set(rows.map((row) => row.orderId)).size,
    uniqueItems: new Set(rows.map((row) => row.itemId)).size,
  };
}

export function analyzeOrders(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.itemId)) grouped.set(row.itemId, []);
    grouped.get(row.itemId).push(row);
  }
  const orders = [...grouped.entries()].map(([itemId, transactions]) => {
    const types = new Set(transactions.map((row) => normalize(row.returnType)).filter((value) => value && value !== "na" && value !== "no return recorded"));
    const customerReturn = [...types].some((value) => /^(customer return|customer returned|returned|return)$/.test(value));
    const rto = [...types].some((value) => /^(logistics return|rto|return to origin)$/.test(value));
    const cancelled = [...types].some((value) => /^(cancelled|canceled)$/.test(value));
    const status = customerReturn && rto ? "Mixed return types" : customerReturn ? "Customer return" : rto ? "RTO" : cancelled ? "Cancelled" : types.size ? "Other status" : "No return recorded";
    const quantities = transactions.map((row) => text(row.quantity)).filter(Boolean).map(Number);
    const quantity = quantities.length && quantities.every((value) => Number.isInteger(value) && value > 0) && new Set(quantities).size === 1 ? quantities[0] : null;
    return { itemId, orderId: transactions[0].orderId, sku: [...new Set(transactions.map((row) => row.sku))].join(", "), status, quantity, ...aggregateTransactions(transactions) };
  });
  const totalOrders = orders.length;
  const countStatus = (status) => orders.filter((order) => order.status === status).length;
  const customerReturns = countStatus("Customer return");
  const rtoOrders = countStatus("RTO");
  const mixedReturns = countStatus("Mixed return types");
  const totalReturns = customerReturns + rtoOrders + mixedReturns;
  const percentage = (count) => totalOrders ? count / totalOrders * 100 : 0;
  return {
    orders, totalOrders, customerReturns, rtoOrders, mixedReturns, totalReturns,
    noReturnOrders: countStatus("No return recorded"),
    cancelledOrders: countStatus("Cancelled"), otherOrders: countStatus("Other status"),
    customerReturnRate: percentage(customerReturns), rtoRate: percentage(rtoOrders),
    totalReturnRate: percentage(totalReturns), noReturnRate: percentage(countStatus("No return recorded")),
  };
}

export function groupTransactions(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const key = row[field] || "Not specified";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([name, items]) => ({ name, ...aggregateTransactions(items), analytics: analyzeOrders(items) })).sort((a, b) => b.bank - a.bank);
}

export function createFlipkartReport(sheets) {
  const getSheet = (name) => sheets.find((sheet) => normalize(sheet.name) === name);
  const summarySheet = getSheet("summary of report");
  const orderSheet = getSheet("orders");
  const helpSheet = getSheet("report help");
  if (!summarySheet || !orderSheet) throw new Error('Report requires the "Summary of report" and "Orders" worksheets. You can still inspect the uploaded workbook below.');

  const summaryRows = summarySheet.values ?? summarySheet.rows;
  const summaryHeaderIndex = summaryRows.findIndex((row) => row.some((cell) => normalize(cell) === "line item"));
  if (summaryHeaderIndex < 0) throw new Error("The settlement summary layout isn't recognized. Please check the Summary of report worksheet.");
  const summaryHeaders = summaryRows[summaryHeaderIndex].map(normalize);
  const indexOf = (label) => summaryHeaders.indexOf(label);
  const labelColumns = [indexOf("line item"), indexOf("break-up l1"), indexOf("break-up l2")];
  const amountColumns = [indexOf("amount settled (rs.)"), indexOf("break-up l1 (rs.)"), indexOf("break-up l2 (rs.)")];
  const remarkColumn = summaryHeaders.findIndex((cell) => cell.startsWith("remarks"));
  if ([...labelColumns, ...amountColumns].some((column) => column < 0)) throw new Error("Required settlement summary columns are missing.");
  let section = "";
  let parent = "";
  const lines = [];
  summaryRows.slice(summaryHeaderIndex + 1).forEach((row, index) => {
    const depth = labelColumns.findIndex((column) => text(row[column]));
    if (depth < 0) return;
    const label = text(row[labelColumns[depth]]);
    if (depth === 0) { section = label; parent = ""; }
    if (depth === 1) parent = label;
    const value = row[amountColumns[depth]];
    lines.push({ label, depth, section, parent, amount: value === "" || value == null ? null : settlementAmount(value), note: text(row[remarkColumn]), sourceRow: summarySheet.startRow + summaryHeaderIndex + index + 2 });
  });
  const summaryValue = (label, sectionName) => lines.find((line) => normalize(line.label) === label && (!sectionName || normalize(line.section) === sectionName))?.amount ?? null;
  const metaValue = (label) => {
    for (const row of summaryRows.slice(0, summaryHeaderIndex)) {
      const index = row.findIndex((cell) => normalize(cell) === label);
      if (index >= 0) return row[index + 1];
    }
    return null;
  };
  const summary = {
    period: text(metaValue("payment duration")),
    saleOrders: metaValue("# sale orders (not returned)") == null ? null : settlementAmount(metaValue("# sale orders (not returned)")),
    returns: metaValue("# returns") == null ? null : settlementAmount(metaValue("# returns")),
    bank: summaryValue("net bank settlement (a)"),
    inputCredits: summaryValue("input gst + tcs credits (b)"),
    sales: summaryValue("sales amount", "orders"),
    refunds: summaryValue("returns reversal", "orders"),
    fees: summaryValue("marketplace fees", "orders"),
    taxes: summaryValue("taxes", "orders"),
    orders: summaryValue("orders"),
    protection: summaryValue("order spf"),
    lines,
  };

  const sourceRows = orderSheet.values ?? orderSheet.rows;
  const headerIndex = sourceRows.findIndex((row) => row.some((cell) => normalize(cell) === "order item id") && row.some((cell) => normalize(cell).startsWith("bank settlement value")));
  if (headerIndex < 0) throw new Error("The Orders worksheet doesn't contain the expected settlement headers.");
  const headers = sourceRows[headerIndex].map(normalize);
  const columns = Object.fromEntries(Object.entries(fields).map(([field, pattern]) => [field, headers.findIndex((header) => pattern.test(header))]));
  const requiredFields = [...amountFields, "orderId", "itemId", "sku", "paymentDate", "neft", "paymentType", "returnType"];
  const missing = requiredFields.filter((field) => columns[field] < 0);
  if (missing.length) throw new Error(`Required Orders columns are missing: ${missing.join(", ")}.`);
  const transactions = [];
  sourceRows.slice(headerIndex + 1).forEach((row, index) => {
    const orderId = text(row[columns.orderId]);
    const itemId = text(row[columns.itemId]);
    if (!orderId && !itemId) return;
    const sourceRow = orderSheet.startRow + headerIndex + index + 2;
    if (!orderId || !itemId) throw new Error(`Orders row ${sourceRow} is missing an order or item ID.`);
    const transaction = { sourceRow };
    for (const [field, column] of Object.entries(columns)) {
      try {
        transaction[field] = amountFields.includes(field) ? settlementAmount(row[column], field !== "bank") : text(orderSheet.rows[headerIndex + index + 1]?.[column] ?? row[column]);
      } catch { throw new Error(`Orders row ${sourceRow} has a missing or invalid ${field} amount.`); }
    }
    transaction.returnType = !transaction.returnType || normalize(transaction.returnType) === "na" ? "No return recorded" : transaction.returnType;
    transaction.returnStatus = normalize(transaction.returnStatus) === "na" ? "Not specified" : transaction.returnStatus;
    transaction.balanceDifference = sumAmounts([transaction.bank, -sumAmounts([transaction.sales, transaction.offers, transaction.sellerShare, transaction.addOns, transaction.fees, transaction.taxes, transaction.adjustments, transaction.protection, transaction.refunds])]);
    transactions.push(transaction);
  });
  const totals = aggregateTransactions(transactions);
  // Orders bank values include Order SPF; the summary lists that under Protection Fund.
  const expectedOrderBank = summary.orders != null && summary.protection != null ? sumAmounts([summary.orders, summary.protection]) : null;
  const difference = expectedOrderBank == null ? null : sumAmounts([expectedOrderBank, -totals.bank]);
  const fees = headers.flatMap((label, column) => {
    if (!/^(commission \(rs|fixed fee|collection fee|pick and pack fee|shipping fee|reverse shipping fee|no cost emi fee|installation fee|tech visit fee|uninstallation & packaging fee|customer add-ons amount recovery|franchise fee|shopsy marketing fee|product cancellation fee)/.test(label)) return [];
    return [{ name: text(sourceRows[headerIndex][column]).replace(/\s*\(Rs\.\).*$/i, ""), amount: sumAmounts(transactions.map((transaction) => settlementAmount(sourceRows[transaction.sourceRow - orderSheet.startRow - 1][column], true))) }];
  }).filter((fee) => fee.amount !== 0);
  return {
    summary, transactions, totals, fees, analytics: analyzeOrders(transactions),
    skus: groupTransactions(transactions, "sku"),
    payments: groupTransactions(transactions, "neft"),
    returnTypes: groupTransactions(transactions, "returnType"),
    expectedOrderBank, difference,
    rowBalanceIssues: transactions.filter((row) => Math.abs(row.balanceDifference) > 0.01).length,
    help: (helpSheet?.rows ?? []).filter((row) => text(row[0]) && text(row[1])).map((row) => ({ term: text(row[0]), description: text(row[1]) })),
  };
}
