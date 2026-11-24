import { useMemo, useState } from "react";
import { sumAmounts } from "../utils/flipkartReport.mjs";

const number = (value) => value.toLocaleString("en-IN");
const rate = (value) => `${value.toFixed(1)}%`;
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function FlipkartOrderAnalytics({ report }) {
  const { analytics: a, totals } = report;
  const distribution = [
    { name: "No return recorded", count: a.noReturnOrders, color: "#217a75" },
    { name: "Customer returns", count: a.customerReturns, color: "#ce6c80" },
    { name: "RTO / logistics returns", count: a.rtoOrders, color: "#d79a3b" },
    { name: "Mixed return types", count: a.mixedReturns, color: "#9476c6" },
    { name: "Cancelled", count: a.cancelledOrders, color: "#9993a5" },
    { name: "Other status", count: a.otherOrders, color: "#686474" },
  ].filter((item) => item.count > 0);
  const cards = [
    { label: "Total orders", value: number(a.totalOrders), note: `Unique order items · ${number(totals.uniqueOrders)} order IDs`, featured: true },
    { label: "Customer returns", value: number(a.customerReturns), percent: rate(a.customerReturnRate), note: "Customer Return in any transaction" },
    { label: "RTO orders", value: number(a.rtoOrders), percent: rate(a.rtoRate), note: "Logistics Return / return to origin" },
    { label: "Total returned orders", value: number(a.totalReturns), percent: rate(a.totalReturnRate), note: "Customer returns + RTO + mixed returns" },
    { label: "No return recorded", value: number(a.noReturnOrders), percent: rate(a.noReturnRate), note: "No return label in the uploaded rows" },
    { label: "Bank settlement", value: money(totals.bank), note: `From ${number(totals.transactions)} settlement transactions` },
  ];
  return <>
    <div className="fk-order-scope"><strong>Based on your uploaded Orders sheet</strong><span>{number(totals.transactions)} settlement rows · {number(a.totalOrders)} unique order items · {number(totals.transactions - a.totalOrders)} repeat item entries</span></div>
    <div className="fk-metrics fk-order-metrics">{cards.map((card) => <div className={`fk-metric${card.featured ? " fk-metric-featured" : ""}`} key={card.label}><span>{card.label}</span><div className="fk-order-value"><strong>{card.value}</strong>{card.percent && <b>{card.percent}</b>}</div><small>{card.note}</small></div>)}</div>
    <p className="fk-note fk-rate-note">All percentages = unique order items in that category ÷ {number(a.totalOrders)} uploaded order items × 100. Repeated payment entries count once. “No return recorded” does not confirm delivery.</p>
    {(a.mixedReturns > 0 || a.otherOrders > 0 || a.cancelledOrders > 0) && <p className="fk-note">{a.mixedReturns > 0 && `${number(a.mixedReturns)} items have both customer and logistics return labels; they are included once in total returns. `}{a.cancelledOrders > 0 && `${number(a.cancelledOrders)} explicitly cancelled items. `}{a.otherOrders > 0 && `${number(a.otherOrders)} items have other source status labels. `}All items remain in the percentage denominator.</p>}
    <section className="import-panel fk-order-distribution" aria-labelledby="fk-order-distribution-title"><div className="section-heading"><div><h3 id="fk-order-distribution-title">Order outcome breakdown</h3><p>Unique order items from the uploaded settlement data</p></div></div><div className="fk-outcome-bar" aria-hidden="true">{distribution.map((item) => <span key={item.name} style={{ width: `${item.count / a.totalOrders * 100}%`, background: item.color }} />)}</div><div className="fk-outcome-legend">{distribution.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{number(item.count)} <small>{rate(item.count / a.totalOrders * 100)}</small></strong></div>)}</div>{!a.totalOrders && <p className="settlement-empty">No order items found.</p>}</section>
  </>;
}

export function FlipkartOrderTable({ analytics }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => analytics.orders.filter((order) => (!status || order.status === status) && [order.sku, order.orderId, order.itemId].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))), [analytics, search, status]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const activePage = Math.min(page, pageCount - 1);
  return <section className="import-panel fk-section"><div className="section-heading"><div><h3>Order analysis</h3><p>One row per order item · all its settlement transactions combined</p></div><span className="subtle-tag">{number(rows.length)} orders</span></div><div className="fk-filters"><label className="fk-search">Search orders<input type="search" placeholder="Search SKU, order or item ID…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label><label>Order outcome<select aria-label="Order outcome" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="">All outcomes</option>{[...new Set(analytics.orders.map((order) => order.status))].sort().map((value) => <option key={value}>{value}</option>)}</select></label></div><p className="fk-filter-total">{number(rows.length)} matching order items · Bank settlement: <b>{money(sumAmounts(rows.map((order) => order.bank)))}</b></p><div className="fk-table-scroll" tabIndex={0} role="region" aria-label="Unique order item analysis"><table className="fk-table"><caption className="sr-only">Unique order item analysis</caption><thead><tr>{["Order / item ID", "Seller SKU", "Outcome", "Transactions", "Sales", "Refunds", "Fees + taxes", "Bank settlement"].map((value) => <th scope="col" key={value}>{value}</th>)}</tr></thead><tbody>{rows.slice(activePage * 20, (activePage + 1) * 20).map((order) => <tr key={order.itemId}><th scope="row" className="fk-reference">{order.orderId}<small>{order.itemId}</small></th><td>{order.sku}</td><td><span className={`fk-order-status ${order.status === "RTO" ? "rto" : order.status === "Customer return" ? "returned" : ""}`}>{order.status}</span></td><td>{number(order.transactions)}</td>{[order.sales, order.refunds, order.fees + order.taxes, order.bank].map((value, index) => <td key={index} className={value < 0 ? "fk-negative" : ""}>{money(value)}</td>)}</tr>)}</tbody></table></div>{!rows.length && <p className="settlement-empty">No matching orders. Try another search or outcome.</p>}<div className="settlement-pagination"><span>Page {activePage + 1} of {pageCount}</span><div><button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous</button><button type="button" disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)}>Next</button></div></div></section>;
}
