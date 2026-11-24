import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOrders, createFlipkartReport, settlementAmount, sumAmounts } from "./flipkartReport.mjs";

function fixture() {
  const headers = ["Order ID", "Order item ID", "Seller SKU", "NEFT ID", "Neft Type", "Payment Date", "Bank Settlement Value (Rs.) = SUM(J:R)", "Input GST + TCS Credits (Rs.)", "Income Tax Credits (Rs.)", "Sale Amount (Rs.)", "Total Offer Amount (Rs.)", "My share (Rs.)", "Customer Add-ons Amount (Rs.)", "Marketplace Fee (Rs.)", "Taxes (Rs.)", "Offer Adjustments (Rs.)", "Protection Fund (Rs.)", "Refund (Rs.)", "Return Type", "Fixed Fee (Rs.)"];
  const orderRows = [["Payment details"], headers, [], ["OD0001", "000100000000000001", "SKU-A", "NEFT-1", "Prepaid", "2026-10-30", 893.001, 20, 0.001, 1000.001, 10, -2, 0, -100, -20, 0, 5, 0, "NA", -100], ["OD0001", "000100000000000001", "SKU-A", "NEFT-1", "Prepaid", "2026-10-30", -1059, 9, 0, 0, 0, 0, 0, -50, -9, 0, 0, -1000, "Customer Return", -50]];
  const summaryRows = [["", "Payment Duration", "2026-10-01 - 2026-10-31"], ["", "# Sale Orders (Not returned)", 1], ["", "# Returns", 1], ["", "Line Item", "Break-up L1", "Break-up L2", "Amount Settled (Rs.)", "Break-up L1 (Rs.)", "Break-up L2 (Rs.)", "Remarks"], ["", "Orders", "", "", -170.999], ["", "", "Sales Amount", "", "", 1000.001], ["", "", "Returns Reversal", "", "", -1000], ["", "", "Marketplace Fees", "", "", -150], ["", "", "Taxes", "", "", -29], ["", "Protection Fund (SPF)", "", "", 5], ["", "", "Order SPF", "", "", 5], ["", "Services Fees", "", "", -10], ["", "Fines", "", "", ""], ["", "", "Fines", "", "", -10], ["", "Net Bank Settlement (A)", "", "", -175.999], ["", "Input GST + TCS Credits (B)", "", "", 29]];
  return [{ name: "Export Summary", startRow: 0, rows: [["Ignore export metadata"]] }, { name: "Report Help", startRow: 0, rows: [["Use of this report", "Settled transactions only"]] }, { name: "Summary of report", startRow: 0, rows: summaryRows, values: summaryRows }, { name: "Orders", startRow: 0, rows: orderRows, values: orderRows }];
}

test("summary and orders use separate scopes; Order SPF is counted once", () => {
  const report = createFlipkartReport(fixture());
  assert.equal(report.summary.bank, -175.999);
  assert.equal(report.summary.period, "2026-10-01 - 2026-10-31");
  assert.equal(report.summary.saleOrders, 1);
  assert.equal(report.summary.returns, 1);
  assert.equal(report.expectedOrderBank, -165.999);
  assert.equal(report.totals.bank, -165.999);
  assert.equal(report.difference, 0);
  assert.equal(report.rowBalanceIssues, 0);
  assert.equal(report.summary.lines.find((line) => line.label === "Fines" && line.depth === 0).amount, null);
});

test("repeat items retain transactions, long IDs, precision and signed refunds", () => {
  const report = createFlipkartReport(fixture());
  assert.equal(report.totals.transactions, 2);
  assert.equal(report.totals.uniqueItems, 1);
  assert.equal(report.totals.uniqueOrders, 1);
  assert.equal(report.transactions[0].itemId, "000100000000000001");
  assert.equal(report.transactions[0].sourceRow, 4);
  assert.equal(report.transactions[0].returnType, "No return recorded");
  assert.equal(report.skus[0].bank, -165.999);
  assert.equal(report.payments[0].refunds, -1000);
  assert.equal(report.fees[0].amount, -150);
  assert.equal(report.returnTypes.length, 2);
  assert.equal(report.analytics.totalOrders, 1);
  assert.equal(report.analytics.customerReturns, 1);
  assert.equal(report.analytics.customerReturnRate, 100);
  assert.equal(report.skus[0].analytics.customerReturns, 1);
});

test("order analytics deduplicate repeated settlements and distinguish RTO, returns and no-return items", () => {
  const base = createFlipkartReport(fixture()).transactions[0];
  const rows = [
    { ...base, itemId: "1", returnType: "No return recorded" },
    { ...base, itemId: "1", returnType: "Customer Return" },
    { ...base, itemId: "1", returnType: "Customer Return" },
    { ...base, itemId: "2", returnType: "Logistics Return" },
    { ...base, itemId: "2", returnType: "No return recorded" },
    { ...base, itemId: "3", returnType: "No return recorded" },
    { ...base, itemId: "4", returnType: "NA" },
  ];
  const a = analyzeOrders(rows);
  assert.equal(a.totalOrders, 4);
  assert.equal(a.customerReturns, 1);
  assert.equal(a.rtoOrders, 1);
  assert.equal(a.totalReturns, 2);
  assert.equal(a.noReturnOrders, 2);
  assert.equal(a.customerReturnRate, 25);
  assert.equal(a.rtoRate, 25);
  assert.equal(a.totalReturnRate, 50);
  assert.equal(a.noReturnRate, 50);
  assert.equal(a.orders[0].transactions, 3);
  assert.equal(a.orders[0].bank, sumAmounts([base.bank, base.bank, base.bank]));
});

test("mixed labels count once; cancelled and unknown statuses are not fabricated returns", () => {
  const base = createFlipkartReport(fixture()).transactions[0];
  const a = analyzeOrders([
    { ...base, itemId: "1", returnType: "Customer Return" },
    { ...base, itemId: "1", returnType: "RTO" },
    { ...base, itemId: "2", returnType: "Cancelled" },
    { ...base, itemId: "3", returnType: "Unknown source status" },
  ]);
  assert.equal(a.totalOrders, 3);
  assert.equal(a.mixedReturns, 1);
  assert.equal(a.customerReturns, 0);
  assert.equal(a.rtoOrders, 0);
  assert.equal(a.totalReturns, 1);
  assert.equal(a.cancelledOrders, 1);
  assert.equal(a.otherOrders, 1);
  assert.equal(a.noReturnOrders, 0);
  const empty = analyzeOrders([]);
  assert.equal(empty.totalOrders, 0);
  assert.equal(empty.customerReturnRate, 0);
  assert.equal(empty.rtoRate, 0);
});

test("flags partial detail and component mismatches", () => {
  const sheets = fixture();
  sheets[2].values[4][4] = 829.001;
  sheets[3].values[3][6] = 894.001;
  const report = createFlipkartReport(sheets);
  assert.equal(report.difference, 999);
  assert.equal(report.rowBalanceIssues, 1);
});

test("rejects missing worksheets, missing columns and invalid financial amounts", () => {
  assert.throws(() => createFlipkartReport([]), /requires/);
  let sheets = fixture();
  sheets[3].values[1][6] = "Unknown column";
  assert.throws(() => createFlipkartReport(sheets), /headers/);
  sheets = fixture();
  sheets[3].values[3][6] = "";
  assert.throws(() => createFlipkartReport(sheets), /row 4.*bank/);
  sheets = fixture();
  sheets[3].values[3][13] = "invalid";
  assert.throws(() => createFlipkartReport(sheets), /row 4.*fees/);
  assert.equal(settlementAmount("₹1,23,456.789"), 123456.789);
  assert.equal(sumAmounts([0.1, 0.2, 0.003]), 0.303);
});
