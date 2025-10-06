import React, { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function getCategory(productName) {
  const name = productName?.toLowerCase() || "";
  if (name.includes("saree")) return "Saree";
  if (name.includes("money")) return "Money Bank";
  return "Other";
}

export default function MeeshoProfitDashboard() {
  const [orderData, setOrderData] = useState([]);
  const [paymentFiles, setPaymentFiles] = useState([]);
  const [processedPayments, setProcessedPayments] = useState([]);
  const [step, setStep] = useState("upload");
  const [customCosts, setCustomCosts] = useState({});
  const [skuList, setSkuList] = useState([]);
  const [defaultCost, setDefaultCost] = useState("");
  const [summary, setSummary] = useState({});
  const [skuSummary, setSkuSummary] = useState({});
  const [mergedData, setMergedData] = useState([]);
  const [error, setError] = useState(null);

  const parseExcelOrCSV = (file, callback) => {
    const isExcel = file.name.endsWith(".xlsx");
    const isCSV = file.name.endsWith(".csv");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[1];
        const sheet = workbook.Sheets[sheetName];
        const allData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const headers = allData[1] || allData[0];
        const rows = allData.slice(allData[1] ? 2 : 1);
        const formattedData = rows.map((row) => {
          const entry = {};
          headers.forEach((col, idx) => {
            entry[col] = row[idx];
          });
          return entry;
        });
        callback(formattedData);
      };
      reader.readAsArrayBuffer(file);
    } else if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => callback(results.data),
      });
    }
  };

  const handleOrderFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    parseExcelOrCSV(file, (data) => {
      setOrderData(data);
      const skus = [...new Set(data.map((r) => r["SKU"]))].filter(Boolean);
      setSkuList(skus);
     
    });
  };

  const handlePaymentFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    const allPayments = [];
    let filesProcessed = 0;

    files.forEach((file) => {
      parseExcelOrCSV(file, (data) => {
        allPayments.push(...data);
        filesProcessed++;
        
        if (filesProcessed === files.length) {
          setProcessedPayments(allPayments);
          setPaymentFiles(files);
        }
      });
    });
  };

  const handleDefaultCostChange = (value) => {
    setDefaultCost(value);
    const updatedCosts = {};
    skuList.forEach((sku) => {
      updatedCosts[sku] = value;
    });
    setCustomCosts(updatedCosts);
  };

  const handleCostChange = (sku, value) => {
    setCustomCosts((prev) => ({ ...prev, [sku]: parseFloat(value) || 0 }));
  };

  const mergeOrdersWithPayments = () => {
    if (!orderData.length || !processedPayments.length) {
      setError("Please upload both order file and payment files");
      return;
    }

    console.log(orderData);

    const merged = orderData.map((order) => {
      const orderId = order["Sub Order No"] || order["sub order no"];
      
      const matchingPayments = processedPayments.filter((payment) => {
        const paymentOrderId = payment["Sub Order No"] || payment["sub order no"];
        return paymentOrderId === orderId;
      });

      const totalSettlement = matchingPayments.reduce((sum, p) => {
        return sum + (parseFloat(p["Final Settlement Amount"]) || 0);
      }, 0);

      const hasValidPayment = matchingPayments.some((p) => {
  const status = (p["Live Order Status"] || p["Payment Status"] || "").toLowerCase().trim();
  return status && status !== "return" && status !== "returned" && status !== "rto";
});

      const paymentDetails = matchingPayments.map((p) => ({
        date: p["Order Date"] || p["Settlement Date"] || "",
        status: p["Live Order Status"] || p["Payment Status"] || "",
        amount: parseFloat(p["Final Settlement Amount"]) || 0,
        type: p["Transaction Type"] || "Payment"
      }));

      const sku = order["SKU"];
      const purchase = hasValidPayment ? (Number(customCosts[sku]) || 0) : 0;
     
      const category = getCategory(order["Product Name"]);
      const profit = totalSettlement - purchase;

      return {
        ...order,
        orderId,
        sku,
        category,
        totalSettlement,
        purchase,
        profit,
        paymentDetails,
        paymentCount: matchingPayments.length,
        hasValidPayment 
      };
    });

    setMergedData(merged);
    calculateSummaries(merged);
     console.log("sku list ===== "+skuList);
    setStep("report");
  };

  const calculateSummaries = (data) => {
    const categorySummary = {};
    const skuSum = {};
    console.log(data);

    data.forEach((item) => {
      const isReturned = item.paymentDetails.some((p) => {
      const status = p.status.toLowerCase().trim();
      return status === "return" || status === "returned" || status === "rto";
    });
    

      if (!categorySummary[item.category]) {
        categorySummary[item.category] = {
          orders: 0,
          revenue: 0,
          purchase: 0,
          profit: 0,
          returned: 0
        };
      }
      if (isReturned) categorySummary[item.category].returned += 1;
      categorySummary[item.category].orders += 1;
      categorySummary[item.category].revenue += item.totalSettlement;
      categorySummary[item.category].purchase += item.purchase;
      categorySummary[item.category].profit += item.profit;

      if (!skuSum[item.SKU]) {
        skuSum[item.SKU] = {
          orders: 0,
          revenue: 0,
          purchase: 0,
          profit: 0,
          payments: 0,
          returned: 0
        };
      }
      skuSum[item.SKU].orders += 1;
      skuSum[item.SKU].revenue += item.totalSettlement;
      skuSum[item.SKU].purchase += item.purchase;
      skuSum[item.SKU].profit += item.profit;
      skuSum[item.SKU].payments += item.paymentCount;
      if (isReturned) skuSum[item.SKU].returned += 1;
    });

    setSummary(categorySummary);
    setSkuSummary(skuSum);
  };

  const totalRevenue = mergedData.reduce((a, b) => a + b.totalSettlement, 0);
  const totalProfit = mergedData.reduce((a, b) => a + b.profit, 0);
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
   const totalReturned = mergedData.filter((order) => 
    order.paymentDetails.some((p) => {
      const status = p.status.toLowerCase().trim();
      return status === "return" || status === "returned";
    })
  ).length;
  const overallReturnRate = mergedData.length > 0 ? ((totalReturned / mergedData.length) * 100).toFixed(1) : 0;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "30px" }}>
        📊 Multi-File P/L Dashboard
      </h1>

      {step === "upload" && (
        <div style={{ background: "#f9f9f9", padding: "30px", borderRadius: "12px" }}>
          <div style={{ marginBottom: "25px" }}>
            <h3>📋 Step 1: Upload Order File</h3>
            <input 
              type="file" 
              accept=".csv,.xlsx" 
              onChange={handleOrderFileUpload}
              style={{ padding: "10px", fontSize: "14px" }}
            />
            {orderData.length > 0 && (
              <p style={{ color: "green", marginTop: "10px" }}>✅ {orderData.length} orders loaded</p>
            )}
          </div>

          <div style={{ marginBottom: "25px" }}>
            <h3>💳 Step 2: Upload Payment Files (Multiple)</h3>
            <input 
              type="file" 
              accept=".csv,.xlsx" 
              multiple
              onChange={handlePaymentFilesUpload}
              style={{ padding: "10px", fontSize: "14px" }}
            />
            {processedPayments.length > 0 && (
              <p style={{ color: "green", marginTop: "10px" }}>✅ {processedPayments.length} payment records loaded from {paymentFiles.length} files</p>
            )}
          </div>

          {orderData.length > 0 && processedPayments.length > 0 && (
            <button 
              onClick={() => setStep("custom-cost")}
              style={{
                background: "#4CAF50",
                color: "white",
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600"
              }}
            >
              Continue to Cost Setup →
            </button>
          )}

          {error && <p style={{ color: "red", marginTop: "15px" }}>{error}</p>}
        </div>
      )}

      {step === "custom-cost" && (
        <div style={{ background: "#f9f9f9", padding: "30px", borderRadius: "12px" }}>
          <h2>🧾 Enter Purchase Cost per SKU</h2>
          
          <div style={{ marginBottom: "25px", padding: "15px", background: "white", borderRadius: "8px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "600" }}>
              💼 Set Default Purchase Cost for All SKUs:
            </label>
            <input
              type="number"
              placeholder="e.g. 150"
              value={defaultCost}
              onChange={(e) => handleDefaultCostChange(e.target.value)}
              style={{ padding: "10px", fontSize: "14px", width: "200px", borderRadius: "6px", border: "1px solid #ddd" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
            {skuList.map((sku) => (
              <div key={sku} style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontWeight: "600", color: "#333" }}>{sku}</span>
                  <input
                    type="number"
                    placeholder="Enter purchase cost"
                    value={customCosts[sku] || ""}
                    onChange={(e) => handleCostChange(sku, e.target.value)}
                    style={{ padding: "8px", fontSize: "14px", borderRadius: "6px", border: "1px solid #ddd" }}
                  />
                </label>
              </div>
            ))}
          </div>

          <button 
            onClick={mergeOrdersWithPayments}
            style={{
              background: "#2196F3",
              color: "white",
              padding: "12px 24px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              marginTop: "25px"
            }}
          >
            ✅ Generate Report
          </button>
        </div>
      )}

      {step === "report" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "30px" }}>
            <div style={{ background: "#e3f2fd", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>📦 Total Orders</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#1976d2" }}>{mergedData.length}</div>
            </div>
            <div style={{ background: "#e8f5e9", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>💰 Total Revenue</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#388e3c" }}>₹{totalRevenue.toFixed(2)}</div>
            </div>
            <div style={{ background: "#fff3e0", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>💸 Total Profit</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#f57c00" }}>₹{totalProfit.toFixed(2)}</div>
            </div>
            <div style={{ background: "#f3e5f5", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>📈 Profit Margin</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#7b1fa2" }}>{profitMargin}%</div>
            </div>
             <div style={{ background: "#ffebee", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>🔁 Customer Returns</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: overallReturnRate > 10 ? "#d32f2f" : "#388e3c" }}>{overallReturnRate}%</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>{totalReturned} of {mergedData.length} orders</div>
            </div>
          </div>
          <div style={{ background: "white", padding: "25px", borderRadius: "12px", marginBottom: "30px", border: "1px solid #e0e0e0" }}>
            <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>📊 Return Calculation Method</h3>
            <div style={{ background: "#f5f5f5", padding: "15px", borderRadius: "8px", fontSize: "14px", lineHeight: "1.6" }}>
              <p style={{ margin: "0 0 10px 0" }}>
                <strong>How returns are counted:</strong>
              </p>
              <ul style={{ margin: "0", paddingLeft: "20px" }}>
                <li>Returns are tracked at the <strong>order level</strong>, not payment entry level</li>
                <li>An order is marked as "returned" if <strong>any payment entry</strong> has status: <code style={{ background: "#fff", padding: "2px 6px", borderRadius: "4px" }}>return</code>, <code style={{ background: "#fff", padding: "2px 6px", borderRadius: "4px" }}>returned</code></li>
                <li>Each order is counted only <strong>once</strong> as returned, even if multiple payment entries show return status</li>
                <li>Return % = (Returned Orders / Total Orders) × 100</li>
              </ul>
            </div>
          </div>

          <div style={{ background: "white", padding: "20px", borderRadius: "12px", marginBottom: "30px", height: "350px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(summary).map(([name, val]) => ({ 
                name, 
                profit: val.profit 
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="profit" fill="#4bc0c0" name="Net Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2>📦 SKU-wise Summary</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", marginBottom: "30px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>SKU</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Orders</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Payments</th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Returned</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Return %</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Revenue</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Purchase</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(skuSummary).map(([sku, val]) => { const returnRate = val.orders > 0 ? ((val.returned / val.orders) * 100).toFixed(1) : 0;
                  return (
                  
                  <tr key={sku} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>{sku}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{val.orders}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{val.payments}</td>
                     <td style={{ padding: "12px", textAlign: "right" }}>{val.returned}</td>
                      <td style={{ padding: "12px", textAlign: "right", color: returnRate > 10 ? "#d32f2f" : "#388e3c", fontWeight: "600" }}>
                        {returnRate}%
                      </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>₹{val.revenue.toFixed(2)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>₹{val.purchase.toFixed(2)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: val.profit >= 0 ? "green" : "red", fontWeight: "600" }}>
                      ₹{val.profit.toFixed(2)}
                    </td>
                 \
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          <h2>📋 Order-wise Payment Details</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Sub Order No</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>SKU</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Payment Details</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Purchase</th>
                  <th style={{ padding: "10px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Total Settlement</th>
                  <th style={{ padding: "10px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {mergedData.slice(0, mergedData.length).map((order, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px" }}>{order.orderId}</td>
                    <td style={{ padding: "10px" }}>{order.SKU}</td>
                    <td style={{ padding: "10px" }}>
                      {order.paymentDetails.length > 0 ? (
                        <div>
                          {order.paymentDetails.map((p, i) => (
                            <div key={i} style={{ marginBottom: "4px", fontSize: "12px" }}>
                              {p.date} - {p.status} - ₹{p.amount.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#999" }}>No payments found</span>
                      )}
                    </td>
                    <td style={{ padding: "10px" }}>
                      {order.hasValidPayment ? (
  `₹${order.purchase.toFixed(2)}`
) : (
  <span style={{ color: "#999", fontStyle: "italic" }}>N/A</span>
)}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>₹{order.totalSettlement.toFixed(2)}</td>
                    <td style={{ padding: "10px", textAlign: "right", color: order.profit >= 0 ? "green" : "red", fontWeight: "600" }}>
                      ₹{order.profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* {mergedData.length > 50 && (
            <p style={{ textAlign: "center", color: "#666", marginTop: "15px" }}>
              Showing first 50 orders. Total: {mergedData.length}
            </p>
          )} */}
        </div>
      )}
    </div>
  );
}