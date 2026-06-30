import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function getCategory(productName) {
  const name = productName?.toLowerCase() || "";
  if (name.includes("saree")) return "Saree";
  if (name.includes("money")) return "Money Bank";
  return "Other";
}

function formatIndianCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return "₹0";

  const [integerPart, decimalPart] = num.toFixed(2).split(".");
  const lastThree = integerPart.slice(-3);
  const remaining = integerPart.slice(0, -3);

  const formatted = remaining.length > 0
    ? remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
    : lastThree;

  return `₹${formatted}.${decimalPart}`;
}

export default function MeeshoProfitDashboard() {
  const [orderData, setOrderData] = useState([]);
  const [orderFiles, setOrderFiles] = useState([]);
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
  const [totalAdsCost, setTotalAdsCost] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [filterSKU, setFilterSKU] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [skuSortField, setSkuSortField] = useState("");
  const [skuSortDirection, setSkuSortDirection] = useState("asc");
  const [skuSearchFilter, setSkuSearchFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [showRTO, setShowRTO] = useState(false);
  const [showAdsComparison, setShowAdsComparison] = useState(false);

  const parseExcelOrCSV = (file, callback, sheetIndex = 1) => {
    const isExcel = file.name.endsWith(".xlsx");
    const isCSV = file.name.endsWith(".csv");



    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
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
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsLoading(true);
    setLoadingMessage(`Loading ${files.length} order file(s)...`);

    const allOrders = [];
    let filesProcessed = 0;

    setTimeout(() => {
      files.forEach((file) => {
        parseExcelOrCSV(file, (data) => {
          allOrders.push(...data);
          filesProcessed++;
          setLoadingMessage(`Loading order files... ${filesProcessed}/${files.length}`);

          if (filesProcessed === files.length) {
            setOrderData(allOrders);
            const skus = [...new Set(allOrders.map((r) => r["SKU"]))].filter(Boolean);
            setSkuList(skus);
            setOrderFiles(files);
            setIsLoading(false);
            setLoadingMessage("");
          }
        });
      });
    }, 100);
  };

  const handlePaymentFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    setIsLoading(true);
    setLoadingMessage(`Processing ${files.length} payment file(s)...`);
    const allPayments = [];
    let adsTotal = 0;
    let filesProcessed = 0;

    files.forEach((file) => {
      // Parse payment data from sheet index 1
      parseExcelOrCSV(file, (data) => {
        allPayments.push(...data);
        filesProcessed++;

        // Parse ads cost data from sheet index 2
        if (file.name.endsWith(".xlsx")) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            // Check if there's a second sheet for ads
            if (workbook.SheetNames.length > 2) {
              const adsSheetName = workbook.SheetNames[2];
              const adsSheet = workbook.Sheets[adsSheetName];
              const adsData = XLSX.utils.sheet_to_json(adsSheet, { header: 1, defval: "" });

              console.log(adsData);

              // Sum up ads cost (assuming it's in a specific column)
              adsData.slice(1).forEach((row) => {
                const cost = parseFloat(row[7]) || 0; // Adjust index based on your sheet structure
                adsTotal += cost;
              });
            }

            if (filesProcessed === files.length) {
              setProcessedPayments(allPayments);
              setPaymentFiles(files);
              setTotalAdsCost(adsTotal);
              setIsLoading(false);
              setLoadingMessage("");
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          if (filesProcessed === files.length) {
            setProcessedPayments(allPayments);
            setPaymentFiles(files);
            setTotalAdsCost(adsTotal);
            setIsLoading(false);
            setLoadingMessage("");
          }
        }
      }, 1);
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

  const exportToExcel = () => {
    const exportData = mergedData.map((order) => ({
      "Sub Order No": order.orderId,
      "SKU": order.sku,
      "Product Name": order["Product Name"] || "",

      "Total Settlement": order.totalSettlement.toFixed(2),
      "Purchase Cost": order.purchase.toFixed(2),
      "Profit/Loss": order.profit.toFixed(2),
      "order Date": order.paymentDetails.map((p) => p.orderDate).join(" | "),
      "Payment Date": order.paymentDetails.map((p) => p.paymentDate).join(" | "),
      "Order Status": order.paymentDetails.map((p) => p.status).join(" | "),

      // "Payment Details": order.paymentDetails.map((p) => 
      //   `${p.date} - ${p.status} - ₹${p.amount.toFixed(2)}`
      // ).join(" | ")
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Sub Order No
      { wch: 20 }, // SKU
      { wch: 30 }, // Product Name
      { wch: 18 }, // Total Settlement
      { wch: 18 }, // Purchase Cost
      { wch: 15 }, // Profit/Loss
      { wch: 25 }, // Order Date
      { wch: 25 }, // payment date
      { wch: 20 }, // order status
    ];

    ws['!cols'] = columnWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Details");

    const fileName = `HISAB-Meesho_Order_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const mergeOrdersWithPayments = () => {
    if (!orderData.length || !processedPayments.length) {
      setError("Please upload both order file and payment files");
      return;
    }

    console.log(orderData);

    setIsLoading(true);
    setLoadingMessage(`Processing ${orderData.length} orders...`);

    setTimeout(() => {
      const merged = orderData.map((order, index) => {
        setLoadingMessage(`Processing orders... ${index}/${orderData.length}`);
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
          orderDate: p["Order Date"] || "",
          paymentDate: p["Payment Date"] || "",
          status: p["Live Order Status"] || p["Payment Status"] || "",
          amount: parseFloat(p["Final Settlement Amount"]) || 0,
          type: p["Transaction Type"] || "Payment",
          transactionId: p["Transaction ID"] || p["transaction id"] || ""
        }));

        const isPaymentPending = matchingPayments.length === 0 || matchingPayments.some((p) => {
          const txnId = (p["Transaction ID"] || p["transaction id"] || "").toString().trim();
          return !txnId;
        });

        const sku = order["SKU"];
        const purchase = hasValidPayment ? (Number(customCosts[sku]) || 0) : 0;
        const orderStatus = order["Reason for Credit Entry"];

        const category = getCategory(order["Product Name"]);
        const profit = totalSettlement - purchase;

        return {
          ...order,
          orderId,
          sku,
          category,
          totalSettlement,
          orderStatus,
          purchase,
          profit,
          paymentDetails,
          paymentCount: matchingPayments.filter(p => (parseFloat(p["Final Settlement Amount"]) || 0) > 0).length,
          hasValidPayment,
          isPaymentPending
        };
      });

      setMergedData(merged);
      calculateSummaries(merged);
      console.log("sku list ===== " + skuList);
      setIsLoading(false);
      setLoadingMessage("");
      setStep("report");
    }, 500)

  };


  const calculateSummaries = (data) => {
    const categorySummary = {};
    const skuSum = {};
    console.log(data);

    data.forEach((item) => {
      const isCustomerReturned = item.paymentDetails.some((p) => {
        const status = p.status.toLowerCase().trim();
        return status === "return" || status === "returned";
      });

      const isRTO = item.paymentDetails.some((p) => {
        const status = p.status.toLowerCase().trim();
        return status === "rto";
      });

      const isCancelled = item.orderStatus && item.orderStatus.toLowerCase().trim() === "cancelled";
     const isPaymentPending = item.isPaymentPending && !isCancelled && !isCustomerReturned && !isRTO;
      const isAdOrder = (item["Order source"] || item["Order Source"] || "").toLowerCase().trim() === "ad order";


      if (!categorySummary[item.category]) {
        categorySummary[item.category] = {
          orders: 0,
          revenue: 0,
          purchase: 0,
          profit: 0,
          returned: 0
        };
      }
      if (isCustomerReturned) categorySummary[item.category].returned += 1;
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
          returned: 0,
          rto: 0,
          cancelled: 0,
          paymentPending: 0,
          adOrders: 0,
          adReturned: 0,
          adRto: 0,
          adCancelled: 0,
          adPayments: 0,
          adProfit: 0
        };
      }
      skuSum[item.SKU].orders += 1;
      skuSum[item.SKU].revenue += item.totalSettlement;
      skuSum[item.SKU].purchase += item.purchase;
      skuSum[item.SKU].profit += item.profit;
      skuSum[item.SKU].payments += item.paymentCount;
      if (isCustomerReturned) skuSum[item.SKU].returned += 1;
      if (isRTO) skuSum[item.SKU].rto += 1;
      if (isCancelled) skuSum[item.SKU].cancelled += 1;
      if (isPaymentPending) skuSum[item.SKU].paymentPending += 1;
      if (isAdOrder) {
        skuSum[item.SKU].adOrders += 1;
        skuSum[item.SKU].adPayments += item.paymentCount;
        skuSum[item.SKU].adProfit += item.profit;
        if (isCustomerReturned) skuSum[item.SKU].adReturned += 1;
        if (isRTO) skuSum[item.SKU].adRto += 1;
        if (isCancelled) skuSum[item.SKU].adCancelled += 1;
      }
    });

    setSummary(categorySummary);
    setSkuSummary(skuSum);
  };

 // 1. Create a dynamic dataset based on the "Show Cancelled" checkbox
 const activeData = showCancelled
 ? mergedData
 : mergedData.filter((order) => {
     const status = (order.orderStatus || "").toLowerCase().trim();
     return status !== "cancelled" && status !== "CANCELLED";
   });

// 2. Automatically recalculate the Bar Chart and SKU summaries when the checkbox is toggled
useEffect(() => {
 if (mergedData.length > 0) {
   calculateSummaries(activeData);
 }
}, [mergedData, showCancelled]); 

// 3. Update all calculations to use activeData instead of mergedData
const totalRevenue = activeData.reduce((a, b) => a + b.totalSettlement, 0);
const totalProfit = activeData.reduce((a, b) => a + b.profit, 0);
const netProfitAfterAds = totalProfit + totalAdsCost;
const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
const netProfitMargin = totalRevenue > 0 ? ((netProfitAfterAds / totalRevenue) * 100).toFixed(1) : 0;

const totalReturned = activeData.filter((order) =>
 order.paymentDetails.some((p) => {
   const status = p.status.toLowerCase().trim();
   return status === "return" || status === "returned";
 })
).length;

const rtoReturned = activeData.filter((order) =>
 order.paymentDetails.some((p) => {
   const status = p.status.toLowerCase().trim();
   return status === "rto" || status === "RTO";
 })
).length;

const cancelled = activeData.filter((order) => {
 const status = (order.orderStatus || "").toLowerCase().trim();
 return status === "cancelled" || status === "CANCELLED";
}).length;

const totalReturnCharges = activeData.reduce((sum, order) => {
 const returnCharge = order.paymentDetails
   .filter((p) => {
     const status = p.status.toLowerCase().trim();
     return status === "return" || status === "returned" || status === "rto";
   })
   .reduce((pSum, p) => pSum + p.amount, 0);
 return sum + returnCharge;
}, 0);

const nonCancelledOrders = activeData.length - cancelled; 
const overallReturnRate = nonCancelledOrders > 0 ? ((totalReturned / nonCancelledOrders) * 100).toFixed(1) : 0;
const rtoReturnRate = nonCancelledOrders > 0 ? ((rtoReturned / nonCancelledOrders) * 100).toFixed(1) : 0;
const cancelledRate = activeData.length > 0 ? ((cancelled / activeData.length) * 100).toFixed(1) : 0;
  // Filter and sort orders
  const getFilteredAndSortedOrders = () => {
    let filtered = [...activeData];

    // Apply SKU filter
    if (filterSKU) {
      filtered = filtered.filter((order) =>
        order.sku?.toLowerCase().includes(filterSKU.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus) {
      filtered = filtered.filter((order) => {
        if (filterStatus === "returned") {
          return order.paymentDetails.some((p) => {
            const status = p.status.toLowerCase().trim();
            return status === "return" || status === "returned" || status === "rto";
          });
        } else if (filterStatus === "valid") {
          return order.hasValidPayment;
        } else if (filterStatus === "pending") {
          const isCancelled = order.orderStatus && order.orderStatus.toLowerCase().trim() === "cancelled";
          const isReturned = order.paymentDetails.some((p) => {
            const status = p.status.toLowerCase().trim();
            return status === "return" || status === "returned";
          });
          const isRTO = order.paymentDetails.some((p) => {
            const status = p.status.toLowerCase().trim();
            return status === "rto";
          });
          return order.isPaymentPending && !isCancelled && !isReturned && !isRTO;
        }
        return true;
      });
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];

        if (sortField === "totalSettlement" || sortField === "purchase" || sortField === "profit") {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }

        if (sortDirection === "asc") {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }

    return filtered;
  };

  const filteredOrders = getFilteredAndSortedOrders();

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSkuSort = (field) => {
    if (skuSortField === field) {
      setSkuSortDirection(skuSortDirection === "asc" ? "desc" : "asc");
    } else {
      setSkuSortField(field);
      setSkuSortDirection("asc");
    }
  };

  const getSortedSkuEntries = () => {
    let entries = Object.entries(skuSummary);

    if (skuSearchFilter) {
      entries = entries.filter(([sku]) =>
        sku.toLowerCase().includes(skuSearchFilter.toLowerCase())
      );
    }

    if (!skuSortField) return entries;

    return entries.sort((a, b) => {
      let aVal, bVal;
      if (skuSortField === "returnRate") {
        aVal = a[1].orders > 0 ? (a[1].returned / a[1].orders) * 100 : 0;
        bVal = b[1].orders > 0 ? (b[1].returned / b[1].orders) * 100 : 0;
      } else {
        aVal = a[1][skuSortField] || 0;
        bVal = b[1][skuSortField] || 0;
      }
      return skuSortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  };

  const resetFilters = () => {
    setFilterSKU("");
    setFilterStatus("");
    setSortField("");
    setSortDirection("asc");
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "5px", fontFamily: "'Urbanist', sans-serif" }}>
      {/* <h1 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "30px" }}>
        📊 Multi-File P/L Dashboard
      </h1> */}

      {isLoading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          color: "white"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "6px solid #f3f3f3",
            borderTop: "6px solid #4CAF50",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ marginTop: "20px", fontSize: "18px", fontWeight: "600" }}>{loadingMessage}</p>
          <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
        </div>
      )}

      {step === "upload" && (
        <div style={{ background: "#f9f9f9", padding: "10px", borderRadius: "12px" }}>
          <div style={{ marginBottom: "25px" }}>
            <h3>📋 Step 1: Upload Order Files (Multiple)</h3>
            <input
              type="file"
              accept=".csv,.xlsx"
              multiple
              onChange={handleOrderFileUpload}
              style={{ padding: "10px", fontSize: "14px" }}
            />
            {orderData.length > 0 && (
              <p style={{ color: "green", marginTop: "10px" }}>✅ {orderData.length} orders loaded from {orderFiles.length} file(s)</p>
            )}
          </div>

          <div style={{ marginBottom: "25px" }}>
            <h3>💳 Step 2: Upload Payment Files (Multiple Allowed)</h3>
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
                fontWeight: "600",
                fontFamily: "Urbanist"
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
              marginBottom: "25px",
              fontFamily: "Urbanist"
            }}
          >
            {isLoading ? "⏳ Processing..." : "✅ Generate Report"}
          </button>

          <div style={{ marginBottom: "25px", padding: "15px", background: "white", borderRadius: "8px" }}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "600" }}>
              💼 Set Default Purchase Cost for All SKUs:
            </label>
            <input
              type="number"
              placeholder="e.g. 150"
              value={defaultCost}
              onChange={(e) => handleDefaultCostChange(e.target.value)}
              style={{ padding: "10px", fontSize: "14px", width: "200px", borderRadius: "6px", border: "1px solid #ddd", fontFamily: "Urbanist" }}
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
                    style={{ padding: "8px", fontSize: "14px", borderRadius: "6px", border: "1px solid #ddd", fontFamily: "Urbanist" }}
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
              marginTop: "25px",
              fontFamily: "Urbanist"

            }}
          >
            {isLoading ? "⏳ Processing..." : "✅ Generate Report"}
          </button>
        </div>
      )}

      {step === "report" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px", marginBottom: "30px" }}>
            <div style={{ background: "#e3f2fd", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>📦 Total Orders</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#1976d2" }}>{nonCancelledOrders}</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>Total incl. cancelled: {mergedData.length}</div>
            </div>
            <div style={{ background: "#e8f5e9", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>💰 Total Revenue</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#388e3c" }}>{formatIndianCurrency(totalRevenue)}</div>
            </div>
            <div style={{ background: "#fff3e0", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>💸 Net Profit</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#f57c00" }}>{formatIndianCurrency(netProfitAfterAds)}</div>
            </div>
            <div style={{ background: "#f3e5f5", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>📈 Profit Margin</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#7b1fa2" }}>{netProfitMargin}%</div>
            </div>
            <div style={{ background: "#fff9c4", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>📢 Total Ads Cost</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#f57f17" }}>{formatIndianCurrency(totalAdsCost)}</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>Marketing expenses</div>
            </div>
            <div style={{ background: "#ffebee", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>🔁 Cancelled Orders</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: overallReturnRate > 10 ? "#d32f2f" : "#388e3c" }}>{cancelledRate}%</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>{cancelled} of {mergedData.length} orders</div>
            </div>
            <div style={{ background: "#ffebee", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>🔁 RTO Returns</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: overallReturnRate > 10 ? "#d32f2f" : "#388e3c" }}>{rtoReturnRate}%</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>{rtoReturned} of {nonCancelledOrders} orders</div>
            </div>
            <div style={{ background: "#ffebee", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>🔁 Customer Returns</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: overallReturnRate > 10 ? "#d32f2f" : "#388e3c" }}>{overallReturnRate}%</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>{totalReturned} of {nonCancelledOrders} orders</div>
            </div>
            <div style={{ background: "#fce4ec", padding: "20px", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>💔 Return Charges</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#c21818ff" }}>{formatIndianCurrency(totalReturnCharges)}</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>Total deductions from returns</div>
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
          <div style={{ marginBottom: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <input
              type="text"
              placeholder="🔍 Search by SKU..."
              value={skuSearchFilter}
              onChange={(e) => setSkuSearchFilter(e.target.value)}
              style={{
                padding: "10px 14px",
                fontSize: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                outline: "none",
                width: "300px",
                fontFamily: "'Urbanist', sans-serif"
              }}
            />
            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#555", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={showCancelled}
                  onChange={(e) => setShowCancelled(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                Show Cancelled
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#555", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={showRTO}
                  onChange={(e) => setShowRTO(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                Show RTO
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#667eea", cursor: "pointer", userSelect: "none", fontWeight: "600" }}>
                <input
                  type="checkbox"
                  checked={showAdsComparison}
                  onChange={(e) => setShowAdsComparison(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                📢 Show Ads Comparison
              </label>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", marginBottom: "30px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>SKU</th>
                  <th
                    onClick={() => handleSkuSort("orders")}
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd", cursor: "pointer", userSelect: "none" }}
                  >
                    Orders {skuSortField === "orders" ? (skuSortDirection === "asc" ? "▲" : "▼") : "⇅"}
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Payments</th>
                  <th
                    onClick={() => handleSkuSort("returned")}
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd", cursor: "pointer", userSelect: "none" }}
                  >
                    Returned {skuSortField === "returned" ? (skuSortDirection === "asc" ? "▲" : "▼") : "⇅"}
                  </th>
                  <th
                    onClick={() => handleSkuSort("returnRate")}
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd", cursor: "pointer", userSelect: "none" }}
                  >
                    Return % {skuSortField === "returnRate" ? (skuSortDirection === "asc" ? "▲" : "▼") : "⇅"}
                  </th>
                  {showRTO && <th
                    onClick={() => handleSkuSort("rto")}
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd", cursor: "pointer", userSelect: "none" }}
                  >
                    RTO {skuSortField === "rto" ? (skuSortDirection === "asc" ? "▲" : "▼") : "⇅"}
                  </th>}
                  {showRTO && <th
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}
                  >
                    RTO %
                  </th>}
                  {showCancelled && <th
                    onClick={() => handleSkuSort("cancelled")}
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd", cursor: "pointer", userSelect: "none" }}
                  >
                    Cancelled {skuSortField === "cancelled" ? (skuSortDirection === "asc" ? "▲" : "▼") : "⇅"}
                  </th>}
                  <th
                    onClick={() => handleSkuSort("paymentPending")}
                    style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd", cursor: "pointer", userSelect: "none" }}
                  >
                    Pending {skuSortField === "paymentPending" ? (skuSortDirection === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Revenue</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Purchase</th>
                  <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Profit</th>
                  {showAdsComparison && <>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #667eea", background: "#f0f0ff", color: "#667eea", fontSize: "12px" }}>📢 Ad Orders</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #667eea", background: "#f0f0ff", color: "#667eea", fontSize: "12px" }}>Ad Ret%</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #667eea", background: "#f0f0ff", color: "#667eea", fontSize: "12px" }}>Ad RTO%</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #667eea", background: "#f0f0ff", color: "#667eea", fontSize: "12px" }}>Ad Canc%</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #388e3c", background: "#f0fff0", color: "#388e3c", fontSize: "12px" }}>🌿 Org Ret%</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #388e3c", background: "#f0fff0", color: "#388e3c", fontSize: "12px" }}>Org RTO%</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #388e3c", background: "#f0fff0", color: "#388e3c", fontSize: "12px" }}>Org Canc%</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {getSortedSkuEntries().map(([sku, val]) => {
                  const returnRate = (val.orders - val.cancelled) > 0 ? ((val.returned / (val.orders - val.cancelled)) * 100).toFixed(1) : 0;
                  return (

                    <tr key={sku} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px" }}>{sku}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>{val.orders}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>{val.payments}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>{val.returned}</td>
                      <td style={{ padding: "12px", textAlign: "right", color: returnRate > 10 ? "#d32f2f" : "#388e3c", fontWeight: "600" }}>
                        {returnRate}%
                      </td>
                      {showRTO && <td style={{ padding: "12px", textAlign: "right", color: val.rto > 0 ? "#d32f2f" : "inherit" }}>{val.rto}</td>}
                      {showRTO && (() => { const skuNonCancelled = val.orders - val.cancelled; const rtoRate = skuNonCancelled > 0 ? ((val.rto / skuNonCancelled) * 100).toFixed(1) : "0.0"; return <td style={{ padding: "12px", textAlign: "right", color: parseFloat(rtoRate) > 10 ? "#d32f2f" : "#388e3c", fontWeight: "600" }}>{rtoRate}%</td>; })()}
                      {showCancelled && <td style={{ padding: "12px", textAlign: "right", color: val.cancelled > 0 ? "#e65100" : "inherit" }}>{val.cancelled}</td>}
                      <td style={{ padding: "12px", textAlign: "right", color: val.paymentPending > 0 ? "#ef6c00" : "inherit", fontWeight: val.paymentPending > 0 ? "600" : "normal" }}>{val.paymentPending}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>₹{val.revenue.toFixed(2)}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>₹{val.purchase.toFixed(2)}</td>
                      <td style={{ padding: "12px", textAlign: "right", color: val.profit >= 0 ? "green" : "red", fontWeight: "600" }}>
                        ₹{val.profit.toFixed(2)}
                      </td>
                      {showAdsComparison && (() => {
                        const orgOrders = val.orders - val.adOrders;
                        const orgReturned = val.returned - val.adReturned;
                        const orgRto = val.rto - val.adRto;
                        const orgCancelled = val.cancelled - val.adCancelled;
                        const adNonCanc = val.adOrders - val.adCancelled;
                        const orgNonCanc = orgOrders - orgCancelled;
                        const adRetRate = adNonCanc > 0 ? ((val.adReturned / adNonCanc) * 100).toFixed(1) : "0.0";
                        const adRtoRate = adNonCanc > 0 ? ((val.adRto / adNonCanc) * 100).toFixed(1) : "0.0";
                        const adCancRate = val.adOrders > 0 ? ((val.adCancelled / val.adOrders) * 100).toFixed(1) : "0.0";
                        const orgRetRate = orgNonCanc > 0 ? ((orgReturned / orgNonCanc) * 100).toFixed(1) : "0.0";
                        const orgRtoRate = orgNonCanc > 0 ? ((orgRto / orgNonCanc) * 100).toFixed(1) : "0.0";
                        const orgCancRate = orgOrders > 0 ? ((orgCancelled / orgOrders) * 100).toFixed(1) : "0.0";
                        return <>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff", color: "#667eea", fontWeight: "600" }}>{val.adOrders}</td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff", color: parseFloat(adRetRate) > parseFloat(orgRetRate) ? "#d32f2f" : "#388e3c", fontWeight: "600" }}>{adRetRate}%</td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff", color: parseFloat(adRtoRate) > parseFloat(orgRtoRate) ? "#d32f2f" : "#388e3c", fontWeight: "600" }}>{adRtoRate}%</td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff", color: parseFloat(adCancRate) > parseFloat(orgCancRate) ? "#d32f2f" : "#388e3c", fontWeight: "600" }}>{adCancRate}%</td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#f5fff5", color: "#388e3c", fontWeight: "600" }}>{orgRetRate}%</td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#f5fff5", color: "#388e3c", fontWeight: "600" }}>{orgRtoRate}%</td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#f5fff5", color: "#388e3c", fontWeight: "600" }}>{orgCancRate}%</td>
                        </>;
                      })()}
                    </tr>
                  )
                })}
                {(() => {
                  const entries = getSortedSkuEntries();
                  const rowCount = entries.length;
                  if (rowCount === 0) return null;
                  const totalOrders = entries.reduce((sum, [, v]) => sum + v.orders, 0);
                  const totalPayments = entries.reduce((sum, [, v]) => sum + v.payments, 0);
                  const totalReturned = entries.reduce((sum, [, v]) => sum + v.returned, 0);
                  const totalCancelled = entries.reduce((sum, [, v]) => sum + v.cancelled, 0);
                  const totalPending = entries.reduce((sum, [, v]) => sum + v.paymentPending, 0);
                  const totalRevenue = entries.reduce((sum, [, v]) => sum + v.revenue, 0);
                  const totalPurchase = entries.reduce((sum, [, v]) => sum + v.purchase, 0);
                  const totalProfit = entries.reduce((sum, [, v]) => sum + v.profit, 0);
                  const nonCancelledTotal = totalOrders - totalCancelled;
                  const totalReturnRate = nonCancelledTotal > 0 ? ((totalReturned / nonCancelledTotal) * 100).toFixed(1) : "0.0";
                  const avgReturnRate = nonCancelledTotal > 0 ? ((totalReturned / nonCancelledTotal) * 100).toFixed(1) : "0.0";
                  const totalRTO = entries.reduce((sum, [, v]) => sum + v.rto, 0);
                  const deliveredOrders = totalPayments;
                  const avgProfit = deliveredOrders > 0 ? (totalProfit / deliveredOrders).toFixed(2) : "0.00";
                  return (
                    <>
                      <tr style={{ background: "#f5f5f5", borderTop: "3px solid #333" }}>
                        <td style={{ padding: "12px", fontWeight: "bold", fontSize: "14px" }}>TOTAL</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>{totalOrders}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>{totalPayments}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>{totalReturned}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: parseFloat(totalReturnRate) > 10 ? "#d32f2f" : "#388e3c" }}>
                          {totalReturnRate}%
                        </td>
                        {showRTO && <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: totalRTO > 0 ? "#d32f2f" : "inherit" }}>{totalRTO}</td>}
                        {showRTO && (() => { const totalRTORate = nonCancelledTotal > 0 ? ((totalRTO / nonCancelledTotal) * 100).toFixed(1) : "0.0"; return <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: parseFloat(totalRTORate) > 10 ? "#d32f2f" : "#388e3c" }}>{totalRTORate}%</td>; })()}
                        {showCancelled && <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: totalCancelled > 0 ? "#e65100" : "inherit" }}>{totalCancelled}</td>}
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: totalPending > 0 ? "#ef6c00" : "inherit" }}>{totalPending}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>{formatIndianCurrency(totalRevenue)}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>{formatIndianCurrency(totalPurchase)}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: totalProfit >= 0 ? "green" : "red" }}>
                          {formatIndianCurrency(totalProfit)}
                        </td>
                        {showAdsComparison && (() => {
                          const tAdOrders = entries.reduce((s, [, v]) => s + v.adOrders, 0);
                          const tAdReturned = entries.reduce((s, [, v]) => s + v.adReturned, 0);
                          const tAdRto = entries.reduce((s, [, v]) => s + v.adRto, 0);
                          const tAdCancelled = entries.reduce((s, [, v]) => s + v.adCancelled, 0);
                          const tOrgOrders = totalOrders - tAdOrders;
                          const tOrgReturned = totalReturned - tAdReturned;
                          const tOrgRto = totalRTO - tAdRto;
                          const tOrgCancelled = totalCancelled - tAdCancelled;
                          const adNonCanc = tAdOrders - tAdCancelled;
                          const orgNonCanc = tOrgOrders - tOrgCancelled;
                          const adRetRate = adNonCanc > 0 ? ((tAdReturned / adNonCanc) * 100).toFixed(1) : "0.0";
                          const adRtoRate = adNonCanc > 0 ? ((tAdRto / adNonCanc) * 100).toFixed(1) : "0.0";
                          const adCancRate = tAdOrders > 0 ? ((tAdCancelled / tAdOrders) * 100).toFixed(1) : "0.0";
                          const orgRetRate = orgNonCanc > 0 ? ((tOrgReturned / orgNonCanc) * 100).toFixed(1) : "0.0";
                          const orgRtoRate = orgNonCanc > 0 ? ((tOrgRto / orgNonCanc) * 100).toFixed(1) : "0.0";
                          const orgCancRate = tOrgOrders > 0 ? ((tOrgCancelled / tOrgOrders) * 100).toFixed(1) : "0.0";
                          return <>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#fafaff", color: "#667eea" }}>{tAdOrders}</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#fafaff", color: parseFloat(adRetRate) > parseFloat(orgRetRate) ? "#d32f2f" : "#388e3c" }}>{adRetRate}%</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#fafaff", color: parseFloat(adRtoRate) > parseFloat(orgRtoRate) ? "#d32f2f" : "#388e3c" }}>{adRtoRate}%</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#fafaff", color: parseFloat(adCancRate) > parseFloat(orgCancRate) ? "#d32f2f" : "#388e3c" }}>{adCancRate}%</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#f5fff5", color: "#388e3c" }}>{orgRetRate}%</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#f5fff5", color: "#388e3c" }}>{orgRtoRate}%</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", background: "#f5fff5", color: "#388e3c" }}>{orgCancRate}%</td>
                          </>;
                        })()}
                      </tr>
                      <tr style={{ background: "#e8eaf6" }}>
                        <td style={{ padding: "12px", fontWeight: "bold", fontSize: "14px" }}>AVERAGE</td>
                        <td style={{ padding: "12px", textAlign: "right" }}></td>
                        <td style={{ padding: "12px", textAlign: "right" }}></td>
                        <td style={{ padding: "12px", textAlign: "right" }}></td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "14px", color: parseFloat(avgReturnRate) > 10 ? "#d32f2f" : "#388e3c" }}>
                          {avgReturnRate}%
                        </td>
                        {showRTO && <td style={{ padding: "12px", textAlign: "right" }}></td>}
                        {showRTO && <td style={{ padding: "12px", textAlign: "right" }}></td>}
                        {showCancelled && <td style={{ padding: "12px", textAlign: "right" }}></td>}
                        <td style={{ padding: "12px", textAlign: "right" }}></td>
                        <td style={{ padding: "12px", textAlign: "right" }}></td>
                        <td style={{ padding: "12px", textAlign: "right" }}></td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "14px", color: parseFloat(avgProfit) >= 0 ? "green" : "red" }}>
                          ₹{avgProfit}
                        </td>
                        {showAdsComparison && <>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff" }}></td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff" }}></td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff" }}></td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#fafaff" }}></td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#f5fff5" }}></td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#f5fff5" }}></td>
                          <td style={{ padding: "12px", textAlign: "right", background: "#f5fff5" }}></td>
                        </>}
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          <h2>📋 Order-wise Payment Details</h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Showing {filteredOrders.length} of {mergedData.length} orders
            </div>
            <button
              onClick={exportToExcel}
              style={{
                background: "#4CAF50",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => e.target.style.background = "#45a049"}
              onMouseOut={(e) => e.target.style.background = "#4CAF50"}
            >
              📥 Export to Excel
            </button>
          </div>

          {/* Filters */}
          <div style={{
            background: "#f9f9f9",

            borderRadius: "12px",
            marginBottom: "10px",
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
            alignItems: "end"
          }}>
            <div style={{ flex: "1", minWidth: "100px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#666", marginBottom: "5px", fontWeight: "600" }}>
                🔍 Filter by SKU
              </label>
              <input
                type="text"
                placeholder="Enter SKU..."
                value={filterSKU}
                onChange={(e) => setFilterSKU(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  outline: "none"
                }}
              />
            </div>

            <div> </div>

            <div style={{ flex: "1", gap: "10px", minWidth: "100px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#666", marginBottom: "5px", fontWeight: "600" }}>
                📊 Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  outline: "none",
                  background: "white"
                }}
              >
                <option value="">All Orders</option>
                <option value="valid">Valid Payments Only</option>
                <option value="returned">Returned Orders Only</option>
                <option value="pending">Payment Pending</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <button
                onClick={resetFilters}
                style={{
                  background: "#ff9800",
                  color: "white",
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                🔄 Reset Filters
              </button>
            </div>
          </div>


          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "5px", textAlign: "left", borderBottom: "2px solid #ddd" }}>No.</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Sub Order No</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>SKU</th>
                  {/* <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Payment</th> */}
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Order Date</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Payment Date</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Order Status</th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Purchase</th>
                  <th style={{ padding: "10px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Total Settlement</th>
                  <th style={{ padding: "10px", textAlign: "right", borderBottom: "2px solid #ddd" }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, filteredOrders.length).map((order, idx) => {
                  const isReturnedOrder = order.paymentDetails.some((p) => {
                    const status = p.status.toLowerCase().trim();
                    return status === "return" || status === "returned";
                  });
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee", background: isReturnedOrder ? "rgba(255, 0, 0, 0.05)" : "transparent" }}>
                      <td style={{ padding: "5px", textAlign: "center", }}>{idx + 1}</td>
                      <td style={{ padding: "10px" }}>{order.orderId}</td>
                      <td style={{ padding: "10px" }}>{order.SKU}</td>
                      {/* <td style={{ padding: "10px" }}>
                      {order.paymentDetails.length > 0 ? (
                        <div>
                          {order.paymentDetails.map((p, i) => (
                            <div key={i} style={{ marginBottom: "4px", fontSize: "12px",color: p.amount >= 0 ? "black" : "red", }}>
                              ₹{p.amount.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#999" }}>No payments found</span>
                      )}
                    </td> */}
                      <td style={{ padding: "10px" }}>
                        {order.paymentDetails.length > 0 ? (
                          <div>
                            {order.paymentDetails.map((p, i) => (
                              <div key={i} style={{ marginBottom: "4px", fontSize: "12px" }}>
                                {p.orderDate}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#999" }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: "10px" }}>
                        {order.paymentDetails.length > 0 ? (
                          <div>
                            {order.paymentDetails.map((p, i) => (
                              <div key={i} style={{ marginBottom: "4px", fontSize: "12px" }}>
                                {p.paymentDate}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#999" }}>N/A</span>
                        )}
                      </td><td style={{ padding: "10px" }}>
                        {order.paymentDetails.length > 0 ? (
                          <div>
                            {order.paymentDetails.map((p, i) => (
                              <div key={i} style={{ marginBottom: "4px", fontSize: "12px", color: p.status == "Return" ? "red" : "black", }}>
                                {p.status}
                              </div>
                            ))}
                          </div>
                        ) : order.paymentDetails.length == 0 ? (<span style={{ color: "orange" }}>{order.orderStatus}</span>) : (
                          <span style={{ color: "#999" }}>N/A</span>
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
                  )
                })}
                <tr style={{ background: "#f5f5f5", borderTop: "3px solid #333" }}>
                  <td colSpan="6" style={{ padding: "12px", fontWeight: "bold", fontSize: "14px" }}>TOTAL</td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
                    {formatIndianCurrency(filteredOrders.reduce((sum, order) => sum + order.purchase, 0))}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
                    {formatIndianCurrency(filteredOrders.reduce((sum, order) => sum + order.totalSettlement, 0))}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "14px", color: filteredOrders.reduce((sum, order) => sum + order.profit, 0) >= 0 ? "green" : "red" }}>
                    {formatIndianCurrency(filteredOrders.reduce((sum, order) => sum + order.profit, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* {mergedData.length > 50 && (
            <p style={{ textAlign: "center", color: "#666", marginTop: "15px" }}>
              Showing first 50 orders. Total: {mergedData.length}
            </p>
          )} */}

          <div style={{
            marginTop: "60px",
            padding: "30px 0",
            borderTop: "1px solid #e0e0e0",
            background: "#fafafa"
          }}>
            <div style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px"
            }}>
              <div style={{ flex: "1", minWidth: "250px" }}>
                <div style={{ fontSize: "20px", fontWeight: "700", color: "#333", marginBottom: "8px" }}>
                  Meesho Analytics Dashboard
                </div>
                <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.6" }}>
                  Professional business intelligence and profit tracking solution for e-commerce sellers.
                </div>
              </div>

              <div style={{
                textAlign: "right",
                flex: "1",
                minWidth: "250px",
                fontSize: "13px",
                color: "#666"
              }}>
                <div style={{ marginBottom: "8px" }}>
                  <strong style={{ color: "#333" }}>Developed by</strong>
                </div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#667eea", marginBottom: "4px" }}>
                  DASH INFOTECH
                </div>
                {/* <div style={{ fontSize: "12px", color: "#999" }}>
                  Full Stack Developer | Data Analytics Specialist
                </div> */}
              </div>
            </div>
          </div>
          <div style={{
            textAlign: "center",
            marginTop: "25px",
            paddingTop: "20px",
            borderTop: "1px solid #e0e0e0",
            fontSize: "12px",
            color: "#999"
          }}>
            © {new Date().getFullYear()} All Rights Reserved. Built By Dash Infotech.
          </div>

        </div>
      )}





    </div>

  );
}