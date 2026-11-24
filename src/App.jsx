import { useRef, useState } from "react";
import MeeshoProfitDashboard from "./components/MeeshoProfitDashboard";
import Icon from "./components/Icon";
import FlipkartSettlementUpload from "./components/FlipkartSettlementUpload";
import "./components/Marketplace.css";

export default function App() {
  const [marketplace, setMarketplace] = useState(null);
  const [meeshoOpened, setMeeshoOpened] = useState(false);
  const [flipkartOpened, setFlipkartOpened] = useState(false);
  const headingRef = useRef(null);

  const selectMarketplace = (value) => {
    if (value === "meesho") setMeeshoOpened(true);
    if (value === "flipkart") setFlipkartOpened(true);
    setMarketplace(value);
    window.scrollTo(0, 0);
  };

  const changeMarketplace = () => {
    setMarketplace(null);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  return (
    <>
      <div hidden={marketplace === "meesho"}>
        <div className="marketplace-shell">
          <header className="marketplace-header">
            <a className="brand" href="#" onClick={(event) => { event.preventDefault(); changeMarketplace(); }}>
              <span className="brand-mark">h<span>.</span></span>
              <span>hisab<span className="brand-caption">SELLER WORKSPACE</span></span>
            </a>
            <span className="marketplace-header-note"><Icon name="report" size={16} /> Your business, in numbers</span>
          </header>

          <main className={`marketplace-main${marketplace === "flipkart" ? " settlement-main" : ""}`}>
            {flipkartOpened && <div hidden={marketplace !== "flipkart"}><FlipkartSettlementUpload onChangeMarketplace={changeMarketplace} /></div>}
            {marketplace !== "flipkart" && (
              <>
                <div className="marketplace-intro">
                  <span className="marketplace-kicker">ONE WORKSPACE. MORE POSSIBILITIES.</span>
                  <h1 ref={headingRef} tabIndex={-1}>Where do you sell?</h1>
                  <p>Choose a marketplace to get started with your reports.</p>
                </div>
                <div className="marketplace-grid">
                  <button type="button" className="marketplace-card meesho-card" onClick={() => selectMarketplace("meesho")}>
                    <span className="marketplace-card-top"><span className="marketplace-logo meesho-logo" aria-hidden="true">m</span><span className="marketplace-status available"><i /> Available</span></span>
                    <span className="marketplace-name">Meesho</span>
                    <span className="marketplace-description">Turn your orders and payments into a clear picture of your business.</span>
                    <span className="marketplace-features"><span>Order reports</span><span>Profit analysis</span></span>
                    <span className="marketplace-card-action">Open Meesho workspace <Icon name="arrow" size={20} /></span>
                  </button>
                  <button type="button" className="marketplace-card flipkart-card" onClick={() => selectMarketplace("flipkart")}>
                    <span className="marketplace-card-top"><span className="marketplace-logo flipkart-logo" aria-hidden="true">f</span><span className="marketplace-status available"><i /> Upload ready</span></span>
                    <span className="marketplace-name">Flipkart</span>
                    <span className="marketplace-description">Upload your settlement sheet and preview your Flipkart payment data.</span>
                    <span className="marketplace-features"><span>Settlement sheets</span><span>XLS · XLSX</span></span>
                    <span className="marketplace-card-action">Open Flipkart workspace <Icon name="arrow" size={20} /></span>
                  </button>
                </div>
                <p className="marketplace-hint"><Icon name="shield" size={16} /> Separate marketplaces. The same clarity.</p>
              </>
            )}
          </main>
          <footer className="marketplace-footer"><span>hisab <span>Seller reports, simplified.</span></span><span>Made for your business.</span></footer>
        </div>
      </div>
      {meeshoOpened && (
        <div hidden={marketplace !== "meesho"}>
          <MeeshoProfitDashboard onChangeMarketplace={changeMarketplace} />
        </div>
      )}
    </>
  );
}
