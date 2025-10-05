import React, { useState } from "react";
import Papa from "papaparse";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import "./index.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";


function getCategory(productName) {
  const name = productName?.toLowerCase() || "";
  if (name.includes("saree")) return "Saree";
  if (name.includes("money")) return "Money Bank";
  return "Other";

  // function getCategory(productName) {
  //   if (!productName || typeof productName !== "string") return "Other";

  //   const name = productName.trim();
  //   const words = name.split(" ");
  //   const category = words[0]; // First word as category (can be improved if needed)

  //   return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  // }
}



const downloadPDF = async () => {
  const input = document.getElementById("report-content");
  if (!input) return;

  const canvas = await html2canvas(input, {
    scale: 1.2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const padding = 10;
  const imgWidth = pdfWidth - padding * 2;
  const totalCanvasHeight = canvas.height;
  const pageHeightInPx = (canvas.width / imgWidth) * (pdfHeight - 30); // account for title height

  let renderedHeight = 0;
  let page = 0;

  // 🖼️ Logo for top + powered by
  const logo = new Image();
  logo.src = "/D-com-bg.png";

  logo.onload = () => {
    while (renderedHeight < totalCanvasHeight) {
      const pageCanvas = document.createElement("canvas");
      const context = pageCanvas.getContext("2d");

      const sliceHeight = Math.min(pageHeightInPx, totalCanvasHeight - renderedHeight);
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      context.drawImage(
        canvas,
        0,
        renderedHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.9);
      if (page > 0) pdf.addPage();

      // 📄 Add header only on first page
      if (page === 0) {
        const logoW = 20;
        const logoH = 20;
        pdf.addImage(logo, "PNG", padding, padding, logoW, logoH);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("Meesho Business Report", padding + logoW + 5, padding + 12);
      }

      const yPos = page === 0 ? 30 : 10;
      const drawHeight = (sliceHeight / canvas.width) * imgWidth;
      pdf.addImage(imgData, "JPEG", padding, yPos, imgWidth, drawHeight);

      renderedHeight += sliceHeight;
      page++;
    }

    // Footer: Powered by
    pdf.setPage(page);
    pdf.setFontSize(10);
    pdf.text("Powered by", pdfWidth - 48, pdfHeight - 12);
    pdf.addImage(logo, "PNG", pdfWidth - 25, pdfHeight - 20, 15, 15);

    pdf.save("HISAB-Meesho_Report.pdf");
  };
};


function parseCSV(
  rows,
  setData,
  setSummary,
  setReturnInfo,
  setSkuSummary,
  setError,
  customCosts,
  setUnknownStatusTotal,
  setDeliveredReturnRto
) {
  try {
    const delivered = rows.filter(
      (row) => row["Live Order Status"]?.trim().toLowerCase() === "delivered"
    );
    const customerReturned = rows.filter(
      (row) => row["Live Order Status"]?.trim().toLowerCase() === "return"
    );
    const rtoReturned = rows.filter(
      (row) => row["Live Order Status"]?.trim().toLowerCase() === "rto"
    );
    const deliveredAndReturn = rows.filter((row) => {
      const status = row["Live Order Status"]?.trim().toLowerCase();
      return status === "delivered" || status === "return";
    });
    const deliveredReturnRtoData = rows.filter((row) => {
      const status = row["Live Order Status"]?.trim().toLowerCase();
      return status === "delivered" || status === "return" || status === "rto";
    });
    const rtoData = rows.filter((row) => {
      const status = row["Live Order Status"]?.trim().toLowerCase();
      return status === "rto";
    });

    const deliveredReturnRtoCount = (delivered.length + customerReturned.length + rtoReturned.length);
    const deliveredCount = delivered.length;
    const rtoCount = rtoData.length;


    setDeliveredReturnRto({ deliveredReturnRtoCount, rtoCount , deliveredCount });



    const returns = rows.filter(
      (row) => row["Live Order Status"]?.trim().toLowerCase() === "return"
    );
    const returnCount = returns.length;
    const returnCharge = returns.reduce((sum, row) => {
      const charge = parseFloat(row["Final Settlement Amount"]) || 0;
      return sum + charge;
    }, 0);

    setReturnInfo({ returnCount, returnCharge });

    const enriched = delivered.map((row) => {
      const sku = row["Supplier SKU"];
      const settlement = parseFloat(row["Final Settlement Amount"]) || 0;
      const category = getCategory(row["Product Name"]);
      const purchase = Number(customCosts[sku]);
      const profit = settlement - purchase;
      return { ...row, settlement, returnCharge: 0, category, purchase, profit };
    });

    const enrichedAll = deliveredReturnRtoData.map((row) => {

      let status = row["Live Order Status"]?.trim().toLowerCase();
      if (!status || status === "" || status === " ") status = "other";
      const settlement = parseFloat(row["Final Settlement Amount"]) || 0;
      const category = getCategory(row["Product Name"]);

      const rawSKU = row["Supplier SKU"]?.trim();
      const sku = rawSKU?.trim() || "other";
      const purchase = Number(customCosts[sku]);
      const returnCharge = status === "return" ? settlement : 0;
      const profit = settlement - purchase - returnCharge;
      return { ...row, status, sku, settlement, returnCharge, category, purchase, profit };
    });

    // Filter rows with missing or empty Live Order Status
    const unknownStatusRows = rows.filter(
      (row) => !row["Live Order Status"] || row["Live Order Status"].trim() === ""
    );

    // Total settlement amount for unknown status rows
    const unknownStatusTotalSettlement = unknownStatusRows.reduce((sum, row) => {
      return sum + (parseFloat(row["Final Settlement Amount"]) || 0);
    }, 0);


    // Add new state for this
    setUnknownStatusTotal(unknownStatusTotalSettlement);

    const skuSummary = {};
    enrichedAll.forEach((item) => {
      const sku = item.sku || "other";
      if (!skuSummary[sku]) {

        skuSummary[sku] = {
          delivered: 0,
          returned: 0,
          rto: 0,
          settlement: 0,
          purchase: 0,
          returnCharge: 0,
          profit: 0,
        };
      }
      if (item["Live Order Status"].toLowerCase() === "delivered") {
        skuSummary[sku].delivered += 1;
        skuSummary[sku].settlement += item.settlement;
        skuSummary[sku].purchase += item.purchase;
        skuSummary[sku].profit += item.profit;
      } else if (item["Live Order Status"].toLowerCase() === "return") {
        skuSummary[sku].returned += 1;
        skuSummary[sku].returnCharge += item.returnCharge || 0;
        skuSummary[sku].profit += item.returnCharge
      } else if (item["Live Order Status"].toLowerCase() === "rto") {
        skuSummary[sku].rto += 1; 
      } else {
        // UNKNOWN or other statuses, still count them
        skuSummary[sku].settlement += item.settlement;
        skuSummary[sku].purchase += item.purchase;
        skuSummary[sku].profit += item.profit;
      }
    });
    setSkuSummary(skuSummary);

    const summary = {};
    enriched.forEach((item) => {
      if (!summary[item.category]) {
        summary[item.category] = {
          orders: 0,
          revenue: 0,
          purchase: 0,
          profit: 0,
        };
      }
      summary[item.category].orders += 1;
      summary[item.category].revenue += item.settlement;
      summary[item.category].purchase += item.purchase;
      summary[item.category].profit += item.profit;
    });

    setData(enriched);
    setSummary(summary);
    setError(null);
  } catch (err) {
    console.error("Parsing Error:", err);
    setError("Failed to generate report. Please check your CSV format.");
  }
}




export default function MeeshoProfitDashboard() {
  console.log("✅ App component mounted");
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [returnInfo, setReturnInfo] = useState({
    returnCount: 0,
    returnCharge: 0,
  });
  const [deliveredReturnRto, setDeliveredReturnRto] = useState({
    deliveredReturnRtoCount: 0,
    rtoCount: 0,
    deliveredCount : 0,
  });
  const [skuSummary, setSkuSummary] = useState({});
  const [error, setError] = useState(null);
  const [customCosts, setCustomCosts] = useState({});
  const [step, setStep] = useState("upload");
  const [skuList, setSkuList] = useState([]);
  const [unknownStatusTotal, setUnknownStatusTotal] = useState(0);
  const [defaultCost, setDefaultCost] = useState("");
  const [rawExcelData, setRawExcelData] = useState([]);

  if (step === "report") {
    var totalRevenue = data.reduce((a, b) => a + b.settlement, 0);
    var totalProfit = data.reduce((a, b) => a + b.profit, 0);
    var returnRate = ((returnInfo.returnCount / deliveredReturnRto.deliveredReturnRtoCount) * 100).toFixed(1);
    var profitMargin = ((totalProfit / totalRevenue) * 100).toFixed(1);

    var profitMarginColor = profitMargin > 10 ? "green" : "black";
    var returnRateColor = returnRate > 10 ? "red" : "black";
  }




  // Set default cost and apply to all SKUs
  const handleDefaultCostChange = (value) => {
    setDefaultCost(value);
    const updatedCosts = {};
    skuList.forEach((sku) => {
      updatedCosts[sku] = value;
    });
    setCustomCosts(updatedCosts);
  };


  const handleFileUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const isExcel = file.name.endsWith(".xlsx");
    const isCSV = file.name.endsWith(".csv");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        // Pick the "Order Payments" sheet
        const sheet = workbook.Sheets["Order Payments"];
        if (!sheet) {
          setError("❌ 'Order Payments' sheet not found.");
          return;
        }

        // Parse sheet to JSON, skipping the first row
        const allData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        // Extract headers from row 2
        const headers = allData[1];
        const rows = allData.slice(2);

        const formattedData = rows.map((row) => {
          const entry = {};
          headers.forEach((col, idx) => {
            entry[col] = row[idx];
          });
          return entry;
        });

        // Move to cost input step
        const skus = [...new Set(formattedData.map((r) => r["Supplier SKU"]))].filter(Boolean);
        setSkuList(skus);
        setStep("custom-cost");
        setRawExcelData(formattedData);
        setData(formattedData);
      };
      reader.readAsArrayBuffer(file);
    } else if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          const skus = [...new Set(rows.map((r) => r["Supplier SKU"]))].filter(Boolean);
          setSkuList(skus);
          setStep("custom-cost");
          setRawExcelData(rows);
          setData(rows);
        },

      });
    } else {
      setError("❌ Unsupported file type. Upload a CSV or Excel (.xlsx).");
    }
  };

  const handleCostChange = (sku, value) => {
    setCustomCosts((prev) => ({ ...prev, [sku]: parseFloat(value) || 0 }));
  };

  const handleSubmitCosts = () => {
    parseCSV(data, setData, setSummary, setReturnInfo, setSkuSummary, setError, customCosts, setUnknownStatusTotal, setDeliveredReturnRto);
    setStep("report");
  };
  console.log("Data:", data);
  console.log("Summary:", summary);
  console.log("Return:", returnInfo);
  console.log("SKU:", skuSummary);



  return (

    <div className="container">
      <h1 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img src="/D-com-bg.png" alt="logo" style={{ width: "60px", height: "55px" }} />
        P/L Dashboard
      </h1>
      {step === "upload" && (
        <div>
          <input type="file" accept=".csv , .xlsx" onChange={handleFileUpload} />
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      )}

      {error ? (
        <div style={{
          backgroundColor: "#ffe6e6",
          borderLeft: "5px solid #ff4d4d",
          padding: "15px 20px",
          marginBottom: "20px",
          borderRadius: "8px",
          color: "#990000",
          fontSize: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
        }}>
          <span style={{ fontSize: "20px" }}>🚫</span>
          <span>{error}</span>
        </div>
      ) : data && data.length === 0 ? (
        <div style={{ padding: "20px", background: "#f0f0f0", borderRadius: "8px", marginTop: "20px", textAlign: "center" }}>
          <h2>📂 No Data Found</h2>
          <p>Please upload a valid CSV file to continue.</p>
        </div>
      ) : (
        <h2>🚀 Data Loaded!</h2>
      )}

      {step === "custom-cost" && (

        <div className="custom-cost-form">
          <h2>🧾 Enter Custom Purchase Cost per SKU</h2>

          {/* Default Cost Setter */}
          <div className="default-cost">
            <label>
              <strong>💼 Set Default Purchase Cost for All SKUs:</strong>
              <input
                type="number"
                placeholder="e.g. 150"
                value={defaultCost}
                onChange={(e) => handleDefaultCostChange(e.target.value)}
              />
            </label>
          </div>
          <form onSubmit={handleSubmitCosts}>
            {skuList.map((sku) => (
              <div className="form-row" key={sku}>
                <label className="form-label">
                  <span className="sku-label">{sku}</span>
                  <input
                    type="number"
                    placeholder="Enter purchase cost"
                    value={customCosts[sku] || ""}
                    onChange={(e) => handleCostChange(sku, e.target.value)}
                  />
                </label>
              </div>
            ))}
            <button className="submit-btn" type="submit">✅ Submit Purchase Costs</button>
          </form>
        </div>
      )}


      {step === "report" && (
        <>
          <div id="report-content">
            <div className="cards">
              <div className="card">
                <div className="card-title">📦 Total Orders</div>
                <div className="card-value">{deliveredReturnRto.deliveredReturnRtoCount}</div>
              </div>
              <div className="card">
                <div className="card-title">📦 Total Orders</div>
                <div className="card-value">{deliveredReturnRto.deliveredCount}</div>
              </div>
              

              <div className="card">
                <div className="card-title">📈 Profit/Piece</div>
                <div className="card-value">
                  ₹{(data.reduce((a, b) => a + b.profit, 0) / deliveredReturnRto.deliveredReturnRtoCount).toFixed(2)}
                </div>
              </div>
              <div className="card">
                <div className="card-title">💸 Return Charges</div>
                <div className="card-value">₹{returnInfo.returnCharge.toFixed(2)}</div>
              </div>

            </div>
            <div className="cards">
              <div className="card">
                <div className="card-title">📦🔁 Total Returns</div>
                <div className="card-value">{returnInfo.returnCount}</div>
                <div className="card-subtext" style={{ color: returnRateColor }}>📉 {returnRate}% of Orders</div>
              </div>
              <div className="card">
                <div className="card-title">💰 Total Profit (Payment - Return + Compensation)</div>
                <div className="card-value">₹{totalProfit.toFixed(2)}</div>
                <div className="card-subtext" style={{ color: profitMarginColor }}>📈 {profitMargin}% of Total Revenue</div>
              </div>

            </div>
            <div className="cards">
              <div className="card">
                <div className="card-title">🚚 RTO Return</div>
                <div className="card-value">{deliveredReturnRto.rtoCount}</div>
              </div>
              <div className="card">
                <div className="card-title">🕵️ Compensation & Recoveries</div>
                <div className="card-value">₹{unknownStatusTotal.toFixed(2)}</div>
              </div>
            </div>

            <div className="chart" style={{ height: "300px" }}>
              <Bar
                data={{
                  labels: Object.keys(summary),
                  datasets: [
                    {
                      label: "Net Profit",
                      data: Object.values(summary).map((v) => v.profit),
                      backgroundColor: "rgba(75, 192, 192, 0.6)",
                    },
                  ],
                }}
                options={{ responsive: true }}
              />
            </div>


            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Purchase</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary).map(([cat, val]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td>{val.orders}</td>
                    <td>₹{val.revenue.toFixed(2)}</td>
                    <td>{(Number(val.purchase) || 0).toFixed(2)}</td>
                    <td>₹{val.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ height: '20px' }}></div>
            <h2>📦 SKU-wise Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>SKU / Product</th>
                  <th>Delivered</th>

                  <th>Returned</th>
                  <th>RTO</th>
                  <th>Revenue</th>
                  <th>Purchase</th>
                  <th>Return Charge</th>
                  <th>Net Profit/Loss</th>
                  <th>Customer Return(%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(skuSummary).map(([sku, val]) => {

                  const totalOrders = val.delivered + val.returned + val.rto;
                  const returnPercent = totalOrders > 0 ? (val.returned / totalOrders) * 100 : 0;
                  const colored = returnPercent > 15 ? "red" : "green";


                  return (

                    <tr key={sku}>
                      <td>{sku}</td>
                      <td>{val.delivered}</td>

                      <td>{val.returned}</td>
                      <td>{val.rto}</td>
                      <td>₹{val.settlement.toFixed(2)}</td>
                      <td>{(Number(val.purchase) || 0).toFixed(2)}</td>
                      <td>₹{val.returnCharge.toFixed(2)}</td>
                      <td>₹{val.profit.toFixed(2)}</td>
                      <td style={{ color: colored }}>
                        {returnPercent.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* <p className="note">
              * Only 'Delivered' orders counted. Purchase cost: ₹360 (Saree), ₹140 (Money Bank).
            </p> */}

            <div className="ai-insights">
              <h2>🧠 AI Insights</h2>
              <ul>
                {Object.entries(skuSummary)
                  .sort(([, a], [, b]) => b.profit - a.profit)
                  .slice(0, 3)
                  .map(([sku], index) => (
                    <li key={sku}>#{index + 1} 🥇 Top Profit SKU: <strong>{sku}</strong> (₹{skuSummary[sku].profit.toFixed(2)})</li>
                  ))}

                {Object.entries(skuSummary)
                  .sort(([, a], [, b]) => b.returned - a.returned)
                  .slice(0, 3)
                  .map(([sku], index) => (
                    <li key={sku}>#{index + 1} 🔁 Most Returned SKU: <strong>{sku}</strong> ({skuSummary[sku].returned} returns)</li>
                  ))}

                {(() => {
                  const topCategory = Object.entries(summary).sort(([, a], [, b]) => b.profit - a.profit)[0];
                  return topCategory ? (
                    <li>🏆 Best Category: <strong>{topCategory[0]}</strong> (₹{topCategory[1].profit.toFixed(2)} profit)</li>
                  ) : null;
                })()}

                {(() => {
                  const worst = Object.entries(skuSummary).sort(([, a], [, b]) => a.profit - b.profit)[0];
                  return worst ? (
                    <li>🔻 Lowest Performing SKU: <strong>{worst[0]}</strong> (₹{worst[1].profit.toFixed(2)} profit)</li>
                  ) : null;
                })()}
              </ul>
            </div>

          </div>
          <div style={{ height: '20px' }}></div>
          <button className="fancy-button" onClick={downloadPDF}>
            📄 Download Report
          </button>

        </>
      )}
    </div>
  );
}
