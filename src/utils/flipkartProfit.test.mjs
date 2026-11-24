import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOrders, aggregateTransactions, sumAmounts } from "./flipkartReport.mjs";
import { createFlipkartProfit, parseProductCost } from "./flipkartProfit.mjs";

function makeReport(overrides = []) {
  const base = { orderId: "OD1", itemId: "1", sku: "A", quantity: "2", returnType: "No return recorded", bank: 500, sales: 0, inputCredits: 0, incomeCredits: 0, offers: 0, sellerShare: 0, addOns: 0, fees: 0, taxes: 0, adjustments: 0, protection: 0, refunds: 0 };
  const rows = overrides.length ? overrides.map((override) => ({ ...base, ...override })) : [base, { ...base, bank: 100 }, { ...base, itemId: "2", sku: "B", quantity: "1", returnType: "Customer Return", bank: -50 }, { ...base, itemId: "3", sku: "C", quantity: "3", returnType: "Logistics Return", bank: -60 }];
  return { analytics: analyzeOrders(rows), totals: aggregateTransactions(rows) };
}

test("cost uses quantity once per unique item; recovered returns carry settlement losses only", () => {
  const profit = createFlipkartProfit(makeReport(), { defaultCost: "100" });
  assert.equal(profit.complete, true);
  assert.equal(profit.totalCostUnits, 2);
  assert.equal(profit.totalProductCost, 200);
  assert.equal(profit.totalBank, 490);
  assert.equal(profit.totalProfit, 290);
  assert.equal(profit.skus.find((sku) => sku.sku === "B").profit, -50);
  assert.equal(profit.skus.find((sku) => sku.sku === "C").profit, -60);
  assert.equal(sumAmounts(profit.skus.map((sku) => sku.profit)), profit.totalProfit);
});

test("SKU overrides replace defaults; written-off returns include their units", () => {
  const report = makeReport();
  const overridden = createFlipkartProfit(report, { defaultCost: "100", skuCosts: { A: "125" } });
  assert.equal(overridden.totalProductCost, 250);
  assert.equal(overridden.totalProfit, 240);
  const writtenOff = createFlipkartProfit(report, { defaultCost: "100", restockReturns: false });
  assert.equal(writtenOff.totalCostUnits, 6);
  assert.equal(writtenOff.totalProductCost, 600);
  assert.equal(writtenOff.totalProfit, -110);
  assert.equal(createFlipkartProfit(report, { defaultCost: "100", skuCosts: { A: "" } }).totalProductCost, 200);
});

test("blank costs block P&L; explicit zero is valid and returned-only SKUs need no cost", () => {
  const report = makeReport();
  const missing = createFlipkartProfit(report);
  assert.equal(missing.complete, false);
  assert.equal(missing.totalProfit, null);
  assert.equal(missing.skus.filter((sku) => sku.missingCost).length, 1);
  const zero = createFlipkartProfit(report, { skuCosts: { A: "0" } });
  assert.equal(zero.complete, true);
  assert.equal(zero.totalProductCost, 0);
  assert.equal(zero.totalProfit, 490);
  for (const value of ["-1", "Infinity", "abc", "10.001", "1e100"]) assert.ok(Number.isNaN(parseProductCost(value)));
  assert.equal(parseProductCost("12.34"), 12.34);
});

test("missing or conflicting quantity never silently becomes one unit", () => {
  for (const rows of [[{ quantity: "" }], [{ quantity: "2" }, { quantity: "3" }]]) {
    const profit = createFlipkartProfit(makeReport(rows), { defaultCost: "100" });
    assert.equal(profit.complete, false);
    assert.equal(profit.totalProfit, null);
    assert.match(profit.problems[0], /quantity/);
  }
});

test("unknown outcomes prevent final profit; cancelled products incur no purchase cost", () => {
  assert.equal(createFlipkartProfit(makeReport([{ returnType: "Unknown" }]), { defaultCost: "100" }).complete, false);
  const cancelled = createFlipkartProfit(makeReport([{ returnType: "Cancelled" }]));
  assert.equal(cancelled.complete, true);
  assert.equal(cancelled.totalProductCost, 0);
});
