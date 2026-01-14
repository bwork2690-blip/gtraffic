import React from "react";
import ReactDOM from "react-dom/client";

const App = () => {
  return <h1>G Traffic is running</h1>;
};

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
