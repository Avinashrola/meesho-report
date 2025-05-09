import React, { useState } from "react";
import Papa from "papaparse";

export default function OrderAnalytics() {
  const [orderData, setOrderData] = useState([]);
  const [skuSummary, setSkuSummary] = useState({});
  const [stateSummary, setStateSummary] = useState({});

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;

        setOrderData(rows);
        generateSKUStateSummary(rows);
      },
    });
  };

  const generateSKUStateSummary = (rows) => {
    const skuMap = {};
    const stateMap = {};

    rows.forEach((row) => {
      const sku = row["SKU"]?.trim() || "Unknown";
      const state = row["Customer State"]?.trim() || "Unknown";
      const reason = row["Reason for Credit Entry"]?.toLowerCase() || "";
      const isDelivered = reason.includes("delivered");
      const isFailed = reason.includes("rto") || reason.includes("failed");

      // SKU summary
      if (!skuMap[sku]) {
        skuMap[sku] = { delivered: 0, failed: 0 };
      }
      if (isDelivered) skuMap[sku].delivered += 1;
      if (isFailed) skuMap[sku].failed += 1;

      // State summary
      if (!stateMap[state]) {
        stateMap[state] = { delivered: 0, failed: 0 };
      }
      if (isDelivered) stateMap[state].delivered += 1;
      if (isFailed) stateMap[state].failed += 1;
    });

    setSkuSummary(skuMap);
    setStateSummary(stateMap);
  };

  return (
    <div className="container">
      {/* <h2 className="text-xl font-bold">📦 Order Analytics</h2> */}
      <h1 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img src="/D-com-bg.png" alt="logo" style={{ width: "60px", height: "55px" }} />
        Order Analytics
      </h1>
      <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-4" />

      {orderData.length > 0 && (
        <>
          {/* SKU-wise Summary Table */}
          <div>
            <h3 className="text-lg font-semibold mb-2">📦 SKU-wise Summary</h3>
            <table className="min-w-full text-sm text-left border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">SKU</th>
                  <th className="border px-2 py-1">Delivered</th>
                  <th className="border px-2 py-1">RTO / Failed</th>
                  <th className="border px-2 py-1">Success %</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(skuSummary).map(([sku, val]) => {
                  const total = val.delivered + val.failed;
                  const successRate = total > 0 ? ((val.delivered / total) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={sku}>
                      <td className="border px-2 py-1">{sku}</td>
                      <td className="border px-2 py-1">{val.delivered}</td>
                      <td className="border px-2 py-1">{val.failed}</td>
                      <td className="border px-2 py-1">{successRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* State-wise Summary Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-2">🌍 State-wise Summary</h3>
            <table className="min-w-full text-sm text-left border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">State</th>
                  <th className="border px-2 py-1">Delivered</th>
                  <th className="border px-2 py-1">RTO / Failed</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stateSummary).map(([state, val]) => (
                  <tr key={state}>
                    <td className="border px-2 py-1">{state}</td>
                    <td className="border px-2 py-1">{val.delivered}</td>
                    <td className="border px-2 py-1">{val.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
