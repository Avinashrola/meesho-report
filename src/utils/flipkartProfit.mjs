import { sumAmounts } from "./flipkartReport.mjs";

export function parseProductCost(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(Math.round(number * 100)) || Math.abs(number * 100 - Math.round(number * 100)) > 1e-6) return NaN;
  return number;
}

export function createFlipkartProfit(report, { defaultCost = "", skuCosts = {}, restockReturns = true } = {}) {
  const groups = new Map();
  const problems = [];
  for (const order of report.analytics.orders) {
    const isReturn = ["Customer return", "RTO", "Mixed return types"].includes(order.status);
    const chargeCost = order.status === "No return recorded" || (isReturn && !restockReturns);
    if (!groups.has(order.sku)) {
      const override = Object.hasOwn(skuCosts, order.sku) ? skuCosts[order.sku] : "";
      const usesDefault = override == null || String(override).trim() === "";
      groups.set(order.sku, { sku: order.sku, orders: 0, customerReturns: 0, rtoOrders: 0, bank: 0, bankAmounts: [], costUnits: 0, costOrders: 0, unknownQuantities: 0, unitCost: parseProductCost(usesDefault ? defaultCost : override), usesDefault });
    }
    const group = groups.get(order.sku);
    group.orders++;
    group.customerReturns += order.status === "Customer return" ? 1 : 0;
    group.rtoOrders += order.status === "RTO" ? 1 : 0;
    group.bankAmounts.push(order.bank);
    if (chargeCost) {
      group.costOrders++;
      if (order.quantity == null) group.unknownQuantities++;
      else group.costUnits += order.quantity;
    }
    if (order.status === "Other status") problems.push(`Order item ${order.itemId} has an unrecognized outcome; product cost cannot be determined.`);
  }
  const skus = [...groups.values()].map((group) => {
    if (group.unknownQuantities) problems.push(`${group.sku}: missing or conflicting quantity for ${group.unknownQuantities} cost-bearing order items.`);
    const missingCost = group.costOrders > 0 && group.unitCost == null;
    const invalidCost = group.costOrders > 0 && Number.isNaN(group.unitCost);
    if (missingCost) problems.push(`${group.sku}: enter a purchase cost or a default cost.`);
    if (invalidCost) problems.push(`${group.sku}: use a non-negative cost with up to two decimal places.`);
    const bank = sumAmounts(group.bankAmounts);
    const productCost = missingCost || invalidCost || group.unknownQuantities ? null : Math.round(group.costUnits * (group.unitCost || 0) * 100) / 100;
    const profit = productCost == null ? null : sumAmounts([bank, -productCost]);
    const { bankAmounts, ...result } = group;
    return { ...result, bank, productCost, profit, missingCost, invalidCost, customerReturnRate: group.customerReturns / group.orders * 100, rtoRate: group.rtoOrders / group.orders * 100 };
  }).sort((a, b) => a.sku.localeCompare(b.sku));
  const complete = problems.length === 0;
  const totalProductCost = complete ? sumAmounts(skus.map((sku) => sku.productCost)) : null;
  return {
    skus, problems, complete, restockReturns,
    totalBank: report.totals.bank,
    totalCostUnits: skus.reduce((sum, sku) => sum + sku.costUnits, 0),
    totalProductCost,
    totalProfit: complete ? sumAmounts([report.totals.bank, -totalProductCost]) : null,
  };
}
