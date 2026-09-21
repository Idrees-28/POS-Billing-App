import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";

import Dashboard from "./pages/Dashboard/Dashboard";
import Customers from "./pages/Customers/Customers";
import Invoices from "./pages/Invoices/Invoices";
import POS from "./pages/POS/POS";
import Products from "./pages/Products/Products";
import Settings from "./pages/Settings/Settings";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">

        <Sidebar />

        <div className="content-area">

          <Header />

          <main className="main-content">
            <Routes>

              <Route
                path="/"
                element={<Dashboard />}
              />

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/customers"
                element={<Customers />}
              />

              <Route
                path="/products"
                element={<Products />}
              />

              <Route
                path="/pos"
                element={<POS />}
              />

              <Route
                path="/invoices"
                element={<Invoices />}
              />

              <Route
                path="/settings"
                element={<Settings />}
              />

            </Routes>
          </main>

        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;