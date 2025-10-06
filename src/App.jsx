import { Tabs, TabsTrigger, TabsContent } from "./components/Tabs";
import MeeshoProfitDashboard from "./components/MeeshoProfitDashboard";
import OrderAnalytics from "./components/OrderAnalytics";

export default function App() {
  return (
    <div className="p-4">
      <h1 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img src="/D-com-bg.png" alt="logo" style={{ width: "65px", height: "60px" }} />
        Meesho Business Dashboard
      </h1>

 <MeeshoProfitDashboard />

      {/* <Tabs defaultValue="profit">
        <TabsTrigger value="profit">🧾 Profit Report</TabsTrigger>
        <TabsTrigger value="orders">📦 Order Analytics</TabsTrigger>


        <TabsContent value="profit">
          <MeeshoProfitDashboard />
        </TabsContent>

        <TabsContent value="orders">
          <OrderAnalytics />
        </TabsContent>
      </Tabs> */}
    </div>
  );
}
