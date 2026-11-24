import { useMemo, useState } from "react";
import { aggregateTransactions, sumAmounts } from "../utils/flipkartReport.mjs";
import FlipkartOrderAnalytics, { FlipkartOrderTable } from "./FlipkartOrderAnalytics";
import { FlipkartProfitSummary, FlipkartProfitTable } from "./FlipkartProfitReport";
import "./FlipkartSettlementReport.css";

const currency = (value, precise = false) => value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: precise ? 3 : 2 }).format(value);
const count = (value) => value == null ? "—" : value.toLocaleString("en-IN");
const PAGE_SIZE = 20;

function Money({ value, precise = false }) {
  return <span className={value < 0 ? "fk-negative" : ""}>{currency(value, precise)}</span>;
}

function Metric({ label, value, note, featured = false }) {
  return <div className={`fk-metric${featured ? " fk-metric-featured" : ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function DataTable({ label, headings, children }) {
  return <div className="fk-table-scroll" role="region" aria-label={label} tabIndex={0}><table className="fk-table"><caption className="sr-only">{label}</caption><thead><tr>{headings.map((heading, index) => <th scope="col" key={index}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export default function FlipkartSettlementReport({ report, fileName, profit, onEditCosts }) {
  const [view, setView] = useState("overview");
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [returnType, setReturnType] = useState("");
  const [page, setPage] = useState(0);
  const { summary, totals } = report;
  const filtered = useMemo(() => report.transactions.filter((row) => {
    const term = search.toLowerCase().trim();
    return (!term || [row.sku, row.orderId, row.itemId, row.neft].some((value) => value.toLowerCase().includes(term))) && (!paymentType || row.paymentType === paymentType) && (!returnType || row.returnType === returnType);
  }), [report, search, paymentType, returnType]);
  const filteredTotals = useMemo(() => aggregateTransactions(filtered), [filtered]);
  const skus = report.skus.filter((sku) => sku.name.toLowerCase().includes(search.toLowerCase().trim()));
  const shownRows = view === "skus" ? skus : filtered;
  const pageCount = Math.max(1, Math.ceil(shownRows.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const pageRows = shownRows.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const summaryBreakdown = summary.lines.filter((line) => line.section === "Orders" && line.depth === 1);
  const payoutLines = summary.lines.filter((line) => line.depth === 0 && line.amount != null && !/^net bank settlement|^input gst/i.test(line.label));
  const taxLines = summary.lines.filter((line) => line.section === "Orders" && line.parent === "Taxes" && line.depth === 2);
  const fines = summary.lines.find((line) => line.section === "Fines" && line.depth === 1)?.amount;
  const services = summary.lines.find((line) => line.label === "Services Fees" && line.depth === 0)?.amount;
  const serviceParts = summary.lines.filter((line) => line.section === "Services Fees" && line.depth === 1);
  const finesIncluded = fines != null && fines !== 0 && services != null && Math.abs(services - sumAmounts([...serviceParts.map((line) => line.amount ?? 0), fines])) < 0.01;

  function changeView(value) { setView(value); setPage(0); setSearch(""); setPaymentType(""); setReturnType(""); }

  return (
    <section className="fk-report" aria-labelledby="fk-report-title">
      <div className="fk-report-heading"><div><span className="marketplace-kicker">ORDER ANALYTICS</span><h2 id="fk-report-title">Your orders, returns and RTOs.</h2><p>{summary.period || "Payment period not provided"}<span> · {fileName}</span></p></div><span className="subtle-tag">Uploaded orders only</span></div>

      {profit && <><div className="fk-profit-title"><h3>Your profit & loss</h3><button type="button" className="primary-button" onClick={onEditCosts}>Edit product costs</button></div><FlipkartProfitSummary profit={profit} /></>}
      <FlipkartOrderAnalytics report={report} />
      <details className="fk-monthly-summary"><summary>Workbook summary · full report period</summary><p className="fk-note">These figures come from Summary of report. They can cover more orders than the uploaded Orders rows and are not used as the denominator for the analytics above.</p>
      <div className="fk-metrics">
        <Metric featured label="Net bank settlement" value={currency(summary.bank)} note="Summary of report · amount paid to bank" />
        <Metric label="Sales amount" value={currency(summary.sales)} note="Summary of report · before return reversals" />
        <Metric label="Return reversals" value={currency(summary.refunds)} note="Summary of report · sales reversed" />
        <Metric label="Marketplace fees" value={currency(summary.fees)} note="Summary of report · excludes taxes" />
        <Metric label="Sale orders / returns" value={`${count(summary.saleOrders)} / ${count(summary.returns)}`} note="Summary counts · sale orders are not returned" />
        <Metric label="Input GST + TCS credits" value={currency(summary.inputCredits)} note="Summary of report · separate from bank payout" />
      </div>
      </details>

      {report.difference != null && Math.abs(report.difference) > 0.01 && <aside className="fk-order-scope fk-scope-note" aria-label="Uploaded orders and workbook summary scope"><strong>Order-sheet totals and workbook summary cover different data</strong><span>Analytics use the {count(totals.uniqueItems)} order items present in this upload. The workbook summary is retained separately; removing rows from Orders does not update its monthly totals.</span></aside>}
      {report.rowBalanceIssues > 0 && <p className="error-message" role="alert">{report.rowBalanceIssues} transaction rows do not reconcile to their component amounts. Review the original Orders sheet.</p>}

      <nav className="fk-view-nav" aria-label="Settlement report views">{[["overview", "Overview"], ...(profit ? [["pnl", "SKU P&L"]] : []), ["orders", "Orders"], ["skus", "SKU analysis"], ["transactions", "Transactions"], ["notes", "Report guide"]].map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => changeView(value)}>{label}</button>)}</nav>

      {view === "pnl" && profit && <FlipkartProfitTable profit={profit} />}
      {view === "orders" && <FlipkartOrderTable analytics={report.analytics} />}

      {view === "overview" && <>
        <div className="fk-overview-grid">
          <section className="import-panel"><div className="section-heading"><div><h3>How your payout adds up</h3><p>Summary of report · top-level amounts only</p></div></div><dl className="fk-breakdown">{payoutLines.map((line) => <div key={line.sourceRow}><dt>{line.label}</dt><dd><Money value={line.amount} /></dd></div>)}<div className="fk-breakdown-total"><dt>Net bank settlement</dt><dd>{currency(summary.bank)}</dd></div></dl><p className="fk-note">{finesIncluded && "The Services Fees total reconciles with the fines and service breakdown in this workbook. "}Credits are shown separately and are not added to bank settlement.</p></section>
          <section className="import-panel"><div className="section-heading"><div><h3>Orders settlement breakdown</h3><p>Summary of report · excludes Order SPF</p></div></div><dl className="fk-breakdown">{summaryBreakdown.map((line) => <div key={line.sourceRow}><dt>{line.label}</dt><dd><Money value={line.amount} /></dd></div>)}<div className="fk-breakdown-total"><dt>Orders total</dt><dd>{currency(summary.orders)}</dd></div></dl></section>
        </div>
        <section className="import-panel fk-section"><div className="section-heading"><div><h3>Available order transactions</h3><p>Orders worksheet only · repeated order items remain separate transactions</p></div></div><div className="fk-detail-metrics"><Metric label="Bank settlement" value={currency(totals.bank, true)} note={`${count(totals.transactions)} transaction rows`} /><Metric label="Unique order items" value={count(totals.uniqueItems)} note={`${count(totals.uniqueOrders)} distinct order IDs`} /><Metric label="Sales less refunds" value={currency(totals.sales + totals.refunds, true)} note="Before offers, fees and taxes" /><Metric label="Fees + taxes" value={currency(totals.fees + totals.taxes, true)} note="Signed deductions from loaded rows" /></div><DataTable label="Payments in available Orders rows" headings={["NEFT reference", "Transactions", "Unique items", "Bank settlement"]}>{report.payments.map((payment) => <tr key={payment.name}><th scope="row" className="fk-reference">{payment.name}</th><td>{count(payment.transactions)}</td><td>{count(payment.uniqueItems)}</td><td><Money value={payment.bank} precise /></td></tr>)}</DataTable></section>
        <div className="fk-overview-grid fk-section">
          <section className="import-panel"><div className="section-heading"><div><h3>Tax breakdown</h3><p>Summary of report · Orders taxes</p></div></div><dl className="fk-breakdown">{taxLines.map((line) => <div key={line.sourceRow}><dt>{line.label}</dt><dd><Money value={line.amount} /></dd></div>)}<div className="fk-breakdown-total"><dt>Total taxes</dt><dd><Money value={summary.taxes} /></dd></div></dl></section>
          <section className="import-panel"><div className="section-heading"><div><h3>Fee breakdown</h3><p>Available Orders rows · nonzero fee heads</p></div></div><dl className="fk-breakdown">{report.fees.map((fee) => <div key={fee.name}><dt>{fee.name}</dt><dd><Money value={fee.amount} precise /></dd></div>)}<div className="fk-breakdown-total"><dt>Loaded marketplace fees</dt><dd><Money value={totals.fees} precise /></dd></div></dl></section>
        </div>
      </>}

      {(view === "skus" || view === "transactions") && <section className="import-panel fk-section">
        <div className="section-heading"><div><h3>{view === "skus" ? "Settlement by SKU" : "Order transactions"}</h3><p>Available Orders rows only · all amounts retain up to three decimal places</p></div><span className="subtle-tag">{count(shownRows.length)} {view === "skus" ? "SKUs" : "transactions"}</span></div>
        <div className="fk-filters"><label className="fk-search">{view === "skus" ? "Search SKU" : "Search SKU, order or NEFT"}<input type="search" placeholder={view === "skus" ? "Search a product SKU…" : "Search transactions…"} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>{view === "transactions" && <><label>Payment type<select value={paymentType} onChange={(event) => { setPaymentType(event.target.value); setPage(0); }}><option value="">All payment types</option>{[...new Set(report.transactions.map((row) => row.paymentType))].map((value) => <option key={value}>{value}</option>)}</select></label><label>Return type<select value={returnType} onChange={(event) => { setReturnType(event.target.value); setPage(0); }}><option value="">All return types</option>{report.returnTypes.map((value) => <option key={value.name}>{value.name}</option>)}</select></label></>}</div>
        {view === "transactions" && <p className="fk-filter-total">Filtered bank settlement: <b>{currency(filteredTotals.bank, true)}</b> · {count(filteredTotals.uniqueItems)} unique order items</p>}
        {view === "skus" ? <DataTable label="SKU settlement analysis" headings={["Seller SKU", "Total orders", "Returns", "Return %", "RTO orders", "RTO %", "No return recorded", "Transactions", "Sales", "Refunds", "Fees", "Taxes", "Bank settlement"]}>{pageRows.map((sku) => <tr key={sku.name}><th scope="row">{sku.name}</th><td>{count(sku.analytics.totalOrders)}</td><td>{count(sku.analytics.customerReturns)}</td><td>{sku.analytics.customerReturnRate.toFixed(1)}%</td><td>{count(sku.analytics.rtoOrders)}</td><td>{sku.analytics.rtoRate.toFixed(1)}%</td><td>{count(sku.analytics.noReturnOrders)}</td><td>{count(sku.transactions)}</td>{[sku.sales, sku.refunds, sku.fees, sku.taxes, sku.bank].map((value, index) => <td key={index}><Money value={value} precise /></td>)}</tr>)}</DataTable> : <DataTable label="Order settlement transactions" headings={["Source row", "Order / item ID", "Seller SKU", "Payment date", "Payment type", "Return type", "Sales", "Offers + share", "Add-ons", "Refunds", "Fees", "Taxes", "SPF + adjustments", "Bank settlement"]}>{pageRows.map((row) => <tr key={row.sourceRow}><td>{row.sourceRow}</td><th scope="row" className="fk-reference">{row.orderId}<small>{row.itemId}</small></th><td>{row.sku}</td><td>{row.paymentDate}</td><td>{row.paymentType}</td><td>{row.returnType}</td>{[row.sales, row.offers + row.sellerShare, row.addOns, row.refunds, row.fees, row.taxes, row.protection + row.adjustments, row.bank].map((value, index) => <td key={index}><Money value={value} precise /></td>)}</tr>)}</DataTable>}
        {!shownRows.length && <p className="settlement-empty">No matching {view === "skus" ? "SKUs" : "transactions"}. Try another search or filter.</p>}
        <div className="settlement-pagination"><span>Page {activePage + 1} of {pageCount}</span><div><button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous</button><button type="button" disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)}>Next</button></div></div>
        <p className="fk-note">SKU return and RTO rates use unique order items within that SKU. Any customer-return entry marks the item as returned; Logistics Return marks it as RTO. Repeated settlement entries count once for order analytics and remain separate in Transactions.</p>
      </section>}

      {view === "notes" && <section className="import-panel fk-section"><div className="section-heading"><div><h3>Reading this report</h3><p>Based on Report Help and Summary of report in your workbook</p></div></div><ul className="fk-guide"><li>This is a settled-payments report. Settlement-based P&L subtracts the product costs you enter from bank settlement. It excludes pending settlements, unreceived tax credits and operating expenses.</li><li>The headline order counts and rates use unique order items from the uploaded Orders rows. Logistics Return is classified as RTO. The workbook monthly summary is separate and does not set the rate denominator.</li><li>Bank settlement = sales + total offers + seller share + customer add-ons + marketplace fees + taxes + offer adjustments + protection fund + refunds. Source signs are preserved.</li><li>Order SPF is already included in Orders row bank values. The summary reports it separately under Protection Fund, so it is included once when comparing order-detail totals.</li><li>Repeated order-item IDs are combined for order analytics. Any customer-return or logistics-return entry classifies that item accordingly. Items with both labels appear once under mixed returns. All original settlement entries remain in Transactions.</li><li>Summary amounts follow the workbook's two-decimal display. Detail values show up to three decimals; calculations use the underlying numeric cells.</li><li>The original workbook remains available in the worksheet preview below.</li></ul><details className="fk-help"><summary>Definitions from Report Help</summary><dl>{report.help.map((item, index) => <div key={index}><dt>{item.term}</dt><dd>{item.description}</dd></div>)}</dl></details><details className="fk-help"><summary>Summary line items and source notes</summary><DataTable label="Summary source line items" headings={["Source row", "Section", "Line item", "Amount", "Workbook note"]}>{summary.lines.map((line) => <tr key={line.sourceRow}><td>{line.sourceRow}</td><td>{line.section}</td><th scope="row">{line.label}</th><td><Money value={line.amount} /></td><td className="fk-source-note">{line.note || "—"}</td></tr>)}</DataTable></details></section>}
    </section>
  );
}
