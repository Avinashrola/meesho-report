import { useRef, useState } from "react";
import Icon from "./Icon";
import { excelColumn, parseSettlementWorkbook } from "../utils/settlementWorkbook.mjs";
import { createFlipkartReport } from "../utils/flipkartReport.mjs";
import FlipkartProductCosts from "./FlipkartProductCosts";

const PAGE_SIZE = 20;

export default function FlipkartSettlementUpload({ onChangeMarketplace }) {
  const [upload, setUpload] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function readFile(file) {
    if (!file || loading) return;
    setError("");
    if (!/\.(xls|xlsx)$/i.test(file.name)) {
      setError("Please choose an Excel settlement sheet (.xls or .xlsx).");
      return;
    }
    setLoading(true);
    try {
      const sheets = parseSettlementWorkbook(await file.arrayBuffer());
      let report = null;
      let reportError = "";
      try { report = createFlipkartReport(sheets); } catch (err) { reportError = err.message; }
      setUpload({ name: file.name, sheets, report, reportError, id: Date.now() });
      const ordersIndex = sheets.findIndex((sheet) => sheet.name.trim().toLowerCase() === "orders");
      setSheetIndex(ordersIndex >= 0 ? ordersIndex : sheets.findIndex((sheet) => sheet.rows.some((row) => row.some((cell) => String(cell).trim()))));
      setPage(0);
    } catch (err) {
      setError(err.message || "Unable to load this file. Please try another workbook.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const sheet = upload?.sheets[sheetIndex];
  const rows = sheet?.rows ?? [];
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  return (
    <section className={`settlement-workspace${upload?.report ? " has-report" : ""}`} aria-labelledby="settlement-title" aria-busy={loading}>
      <button type="button" className="marketplace-back settlement-back" onClick={onChangeMarketplace}><span aria-hidden="true">←</span> Change marketplace</button>
      <div className="page-heading">
        <div><span className="marketplace-kicker">FLIPKART WORKSPACE</span><h1 id="settlement-title">{upload?.report ? "Settlement overview" : "Start with your settlements."}</h1><p>Upload your Flipkart settlement sheet to understand your payouts, fees and returns.</p></div>
        <span className="marketplace-logo flipkart-logo" aria-hidden="true">f</span>
      </div>
      <details className={`settlement-import${upload?.report ? " has-upload" : ""}`} open={upload?.report ? undefined : true} key={`import-${upload?.id ?? "initial"}`}>
      <summary><span><Icon name="file" size={17} /> {upload?.name || "Upload settlement sheet"}</span><span>Replace settlement sheet</span></summary>
      <div className="import-panel">
        <div className="section-heading"><div><h2>Settlement sheet</h2><p>Choose the Excel file downloaded from Flipkart.</p></div><span className="subtle-tag">XLS · XLSX</span></div>
        <label className={`file-dropzone settlement-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); if (!loading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) { setError("Please upload one settlement workbook at a time."); return; } readFile(event.dataTransfer.files[0]); }}>
          <Icon name="upload" size={30} />
          <strong>{loading ? "Reading your settlement sheet…" : upload ? "Choose a different settlement sheet" : "Choose a settlement sheet to upload"}</strong>
          <span>Drag and drop here, or click to browse · .xls or .xlsx</span>
          <input ref={inputRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Upload Flipkart settlement sheet" disabled={loading} onChange={(event) => readFile(event.target.files[0])} />
        </label>
        {error && <p className="error-message settlement-error" role="alert">{error}{upload && " Your previous workbook is still shown below."}</p>}
        <div className="settlement-upload-status" role="status" aria-live="polite">{loading ? "Loading workbook…" : upload ? <><Icon name="check" size={16} /><span>{upload.name}</span><span className="subtle-tag">{upload.sheets.length} {upload.sheets.length === 1 ? "worksheet" : "worksheets"}</span></> : <><Icon name="file" size={16} /> No sheet uploaded yet</>}</div>
        <p className="settlement-privacy"><Icon name="shield" size={15} /> Your sheet is processed locally in your browser.</p>
      </div>
      </details>

      {upload?.reportError && <p className="error-message settlement-error" role="alert">{upload.reportError}</p>}
      {upload?.report && <FlipkartProductCosts key={`report-${upload.id}`} report={upload.report} fileName={upload.name} />}
      {upload ? (
        <details className="settlement-raw-toggle" open={upload.report ? undefined : true} key={`preview-${upload.id}`}>
        <summary>Inspect original workbook worksheets</summary>
        <section className="import-panel settlement-preview" aria-labelledby="settlement-preview-title">
          <div className="section-heading"><div><h2 id="settlement-preview-title">Settlement sheet preview</h2><p>Original worksheet values and Excel row numbers for reference.</p></div></div>
          <div className="settlement-sheet-controls"><label htmlFor="settlement-sheet">Worksheet<select id="settlement-sheet" value={sheetIndex} onChange={(event) => { setSheetIndex(Number(event.target.value)); setPage(0); }}>{upload.sheets.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label><span>{rows.length.toLocaleString("en-IN")} rows · {columnCount} columns</span></div>
          {rows.length ? <><div className="settlement-table-scroll" tabIndex={0} role="region" aria-label={`${sheet.name} worksheet preview`}><table className="settlement-table"><caption className="sr-only">{sheet.name} from {upload.name}</caption><thead><tr><th scope="col">Row</th>{Array.from({ length: columnCount }, (_, column) => <th key={column} scope="col">{excelColumn(sheet.startColumn + column)}</th>)}</tr></thead><tbody>{rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row, index) => <tr key={page * PAGE_SIZE + index}><th scope="row">{sheet.startRow + page * PAGE_SIZE + index + 1}</th>{Array.from({ length: columnCount }, (_, column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div><div className="settlement-pagination"><span>Page {page + 1} of {pageCount}</span><div><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></> : <p className="settlement-empty">This worksheet is empty. Select another worksheet above.</p>}
        </section>
        </details>
      ) : <div className="settlement-next"><span className="icon-badge"><Icon name="report" size={23} /></span><div><h2>Your report starts here</h2><p>Upload a settlement sheet to preview its worksheets and data.</p></div></div>}
    </section>
  );
}
