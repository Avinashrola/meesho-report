// components/Tabs.jsx
import React, { useState } from "react";
import "./Tabs.css";

export function Tabs({ defaultValue, children }) {
  const [active, setActive] = useState(defaultValue);
  const triggers = [];
  const contents = [];

  React.Children.forEach(children, (child) => {
    if (child.type.name === "TabsTrigger") {
      triggers.push(React.cloneElement(child, { active, setActive }));
    }
    if (child.type.name === "TabsContent") {
      contents.push(child);
    }
  });

  return (
    <>
      <div className="tab-triggers">{triggers}</div>
      <div className="tab-content">
        {contents.find((c) => c.props.value === active)}
      </div>
    </>
  );
}

export function TabsTrigger({ value, children, active, setActive }) {
  return (
    <button
      className={`tab-button ${active === value ? "active" : ""}`}
      onClick={() => setActive(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }) {
  return <div>{children}</div>;
}
