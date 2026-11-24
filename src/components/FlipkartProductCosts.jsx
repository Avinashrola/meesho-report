import { useMemo, useState } from "react";
import Icon from "./Icon";
import { createFlipkartProfit } from "../utils/flipkartProfit.mjs";
import FlipkartSettlementReport from "./FlipkartSettlementReport";

const money = (value) => value == null || Number.isNaN(value) ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function FlipkartProductCosts({ report, fileName }) {
  const [editing, setEditing] = useState(true);
  const [defaultCost, setDefaultCost] = useState("");
  const [skuCosts, setSkuCosts] = useState({});
  const [restockReturns, setRestockReturns] = useState(true);
  const [applied, setApplied] = useState(null);
  const [search, setSearch] = useState("");
  const draft = useMemo(() => createFlipkartProfit(report, { defaultCost, skuCosts, restockReturns }), [report, defaultCost, skuCosts, restockReturns]);
  const profit = useMemo(() => applied ? createFlipkartProfit(report, applied) : null, [report, applied]);
  const missingCount = draft.skus.filter((sku) => sku.missingCost || sku.invalidCost).length;

  if (!editing && profit) return <FlipkartSettlementReport report={report} fileName={fileName} profit={profit} onEditCosts={() => { setDefaultCost(applied.defaultCost); setSkuCosts({ ...applied.skuCosts }); setRestockReturns(applied.restockReturns); setEditing(true); setSearch(""); }} />;

  function generate(event) {
    event.preventDefault();
    if (!draft.complete) return;
    setApplied({ defaultCost, skuCosts: { ...skuCosts }, restockReturns });
    setEditing(false);
  }

  return <form className="import-panel fk-cost-form fk-section" onSubmit={generate}>
    <div className="section-heading"><div><span className="marketplace-kicker">PRODUCT PURCHASE COSTS</span><h2>{applied ? "Update your product costs" : "What does each product cost you?"}</h2><p>Enter your purchase cost per unit to calculate total and SKU-wise P&L.</p></div><span className="subtle-tag">{draft.skus.length} SKUs</span></div>
    <div className="fk-cost-default"><label htmlFor="flipkart-default-cost">Default purchase cost per unit (₹)<input id="flipkart-default-cost" type="number" min="0" step="0.01" placeholder="e.g. 150" value={defaultCost} onChange={(event) => setDefaultCost(event.target.value)} /></label><div><p>Used for every SKU without an override. Enter 0 explicitly for a zero-cost product.</p><button type="button" className="marketplace-back" onClick={() => setSkuCosts({})}>Use default for all SKUs</button></div></div>
    <label className="fk-restock-option"><input type="checkbox" checked={restockReturns} onChange={(event) => setRestockReturns(event.target.checked)} /><span><strong>Returned and RTO inventory is recovered</strong><small>{restockReturns ? "Product cost applies only to items with no return recorded. Return/RTO fees still affect P&L through bank settlement." : "Product cost also applies to customer-return, RTO and mixed-return items as an inventory write-off."}</small></span></label>
    <p className="fk-note">Quantity is taken once per order item, even if it has several settlement rows. Cancelled items carry no product cost. This calculation covers only the uploaded Orders rows.</p>
    <div className="fk-filters fk-section"><label className="fk-search">Find a SKU<input type="search" placeholder="Search product SKUs…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    <div className="fk-table-scroll" role="region" aria-label="SKU purchase cost inputs" tabIndex={0}><table className="fk-table fk-cost-table"><caption className="sr-only">Product purchase costs per SKU</caption><thead><tr>{["Seller SKU", "Orders", "Cost-bearing units", "Purchase cost / unit (₹)", "Effective unit cost", "Total product cost"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{draft.skus.filter((sku) => sku.sku.toLowerCase().includes(search.trim().toLowerCase())).map((sku) => <tr key={sku.sku}><th scope="row">{sku.sku}{sku.costOrders === 0 && <small className="fk-cost-not-required">No product cost required under this policy</small>}</th><td>{sku.orders}</td><td>{sku.unknownQuantities ? "Quantity unavailable" : sku.costUnits}</td><td><input type="number" aria-label={`Purchase cost for ${sku.sku}`} min="0" step="0.01" placeholder={defaultCost !== "" ? `Default: ${defaultCost}` : "Enter cost"} value={Object.hasOwn(skuCosts, sku.sku) ? skuCosts[sku.sku] : ""} onChange={(event) => setSkuCosts((previous) => ({ ...previous, [sku.sku]: event.target.value }))} /></td><td>{money(sku.unitCost)}<small className="fk-cost-not-required">{sku.unitCost == null ? "Not entered" : sku.usesDefault ? "Default" : "SKU override"}</small></td><td>{money(sku.productCost)}</td></tr>)}</tbody></table></div>
    <div className="fk-cost-progress" role="status" aria-live="polite">{draft.complete ? <><Icon name="check" size={17} /> All required costs entered · {draft.totalCostUnits} cost-bearing units · {money(draft.totalProductCost)} total product cost</> : missingCount ? `${missingCount} ${missingCount === 1 ? "SKU needs" : "SKUs need"} a valid purchase cost before generating P&L.` : "Resolve the quantity or order-outcome issues below before generating P&L."}</div>
    {draft.problems.some((problem) => !/purchase cost|default cost|non-negative cost/.test(problem)) && <div className="error-message" role="alert">{draft.problems.filter((problem) => !/purchase cost|default cost|non-negative cost/.test(problem)).map((problem) => <p key={problem}>{problem}</p>)}</div>}
    <div className="import-footer"><p>Bank settlement − product purchase cost = settlement-based P&L</p><div className="fk-cost-actions">{applied && <button type="button" className="marketplace-back" onClick={() => setEditing(false)}>Cancel changes</button>}<button type="submit" className="primary-button" disabled={!draft.complete}>{applied ? "Update P&L report" : "Generate P&L report"}<Icon name="arrow" size={18} /></button></div></div>
  </form>;
}

