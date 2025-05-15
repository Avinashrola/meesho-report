import React, { useState } from "react";
import "./Tabs.css";

export function Tabs({ defaultValue, children }) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const triggers = [];
  const contents = [];

  React.Children.forEach(children, (child) => {
    if (child.type === TabsTrigger) {
      triggers.push(
        React.cloneElement(child, {
          active: child.props.value === activeTab,
          onClick: () => setActiveTab(child.props.value),
        })
      );
    } else if (child.type === TabsContent) {
      contents.push(child);
    }
  });

  return (
    <div className="tabs">
      <div className="tabs-header" style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        {triggers}
      </div>
      <div className="tabs-body">
        {contents.map((content) =>
          content.props.value === activeTab ? (
            <div key={content.props.value}>{content.props.children}</div>
          ) : null
        )}
      </div>
    </div>
  );


}

export function TabsTrigger({ value, children, active, onClick }) {
  return (
    <button
      className={`tab-button ${active === value ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }) {
  return <div>{children}</div>;
}
