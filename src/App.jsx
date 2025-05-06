import React, { useState } from "react";
import Papa from "papaparse";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import "./index.css";

function getCategory(productName) {
  const name = productName?.toLowerCase() || "";
  if (name.includes("saree")) return "Saree";
  if (name.includes("money bank")) return "Money Bank";
  return "Other";
}

function parseCSV(file, setData, setSummary, setReturnInfo) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      console.log("Raw CSV Data:", results); // ADD THIS
      const rows = results.data;

      const delivered = rows.filter(
        (row) => row["Live Order Status"]?.trim().toLowerCase() === "delivered"
      );

      const returns = rows.filter(
        (row) => {
          const status = row["Live Order Status"]?.trim().toLowerCase();
          return status === "return";
        }
      );

      const returnCount = returns.length;
      const returnCharge = returnCount * 170;

      // Existing mapping logic
      const enriched = delivered.map((row) => {
        const settlement = parseFloat(row["Final Settlement Amount"]) || 0;
        const category = getCategory(row["Product Name"]);
        const purchase = category === "Saree" ? 360 : category === "Money Bank" ? 140 : 0;
        const profit = settlement - purchase;
        return { ...row, settlement, category, purchase, profit };
      });

      setReturnInfo({ returnCount, returnCharge }); // NEW STATE

      setData(enriched);
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
      setSummary(summary);
    },
  });
}

export default function App() {
  console.log("✅ App component mounted");
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [returnInfo, setReturnInfo] = useState({
    returnCount: 0,
    returnCharge: 0,
  });


  const handleFile = (e) => {
    console.log("File selected:", e.target.files[0]); // ADD THIS
    const file = e.target.files[0];
    console.log("Selected File:", file); // ADD THIS
    if (file) parseCSV(file, setData, setSummary, setReturnInfo);
  };
  console.log("Data:", data);
  console.log("Summary:", summary);
  console.log("Return:", returnInfo);

  return (

    <div className="container">
      <h1>🧾 Meesho Profit Dashboard</h1>
      <input type="file" accept=".csv" onChange={handleFile} className="border rounded px-4 py-2" />

      {data.length > 0 && <h2>🚀 Data Loaded!</h2>}


      {data.length > 0 && (
        <>

          <div className="cards">
            <div className="card">Total Orders: <strong>{data.length}</strong></div>
            <div className="card">
              Total Profit (Payment - Return):
              <strong>
                ₹{(
                  data.reduce((a, b) => a + b.profit, 0) -
                  data.reduce((a, b) => (returnInfo.returnCharge || 0), 0)
                ).toFixed(2)}
              </strong>
            </div>

            <div className="card">Profit/Piece: <strong>₹{(data.reduce((a, b) => a + b.profit, 0) / data.length).toFixed(2)}</strong></div>
            <div className="card">Total Returns: <strong>{returnInfo.returnCount}</strong></div>
            <div className="card">Return Charges: <strong>₹{returnInfo.returnCharge}</strong></div>
          </div>

          <div className="chart">
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
                  <td>₹{val.purchase.toFixed(2)}</td>
                  <td>₹{val.profit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="note">
            * Only 'Delivered' orders counted. Purchase cost: ₹360 (Saree), ₹140 (Money Bank).
          </p>
        </>
      )}
    </div>
  );
}
