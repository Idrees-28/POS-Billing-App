import { useEffect, useMemo, useState } from "react";
import {Users,Package,FileText,IndianRupee,ShoppingCart,TrendingUp,CreditCard,Banknote,Smartphone,AlertTriangle,
Award,
} from "lucide-react";

import { getCustomers } from "../../utils/customerStore";
import { getProducts } from "../../api/productsApi";
import { getInvoices } from "../../api/ordersApi";

import "./Dashboard.css";

const readStorage = (key, fallback = []) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState({});
  const [period, setPeriod] = useState("week");

  /* Customers, products and invoices come from Magento via the backend.
     Only the display settings (currency etc.) stay in the browser. */
  const loadDashboardData = async () => {
    const savedSettings = readStorage("pos_settings", {});

    const [customerResult, productResult, invoiceResult] =
      await Promise.allSettled([
        getCustomers(),
        getProducts(),
        getInvoices(),
      ]);

    if (customerResult.status === "fulfilled") {
      // exclude the virtual walk-in customer from the customer count
      setCustomers(customerResult.value.filter((c) => Number(c.id) !== 0));
    }

    if (productResult.status === "fulfilled") {
      setProducts(productResult.value);
    }

    if (invoiceResult.status === "fulfilled") {
      setInvoices(invoiceResult.value);
    }

    setSettings(
      savedSettings && typeof savedSettings === "object" ? savedSettings : {},
    );
  };

  useEffect(() => {
    loadDashboardData();

    const handleUpdate = () => loadDashboardData();

    window.addEventListener("customersUpdated", handleUpdate);
    window.addEventListener("productsUpdated", handleUpdate);
    window.addEventListener("invoicesUpdated", handleUpdate);
    window.addEventListener("settingsUpdated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    return () => {
      window.removeEventListener("customersUpdated", handleUpdate);
      window.removeEventListener("productsUpdated", handleUpdate);
      window.removeEventListener("invoicesUpdated", handleUpdate);
      window.removeEventListener("settingsUpdated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, []);

  const currency = settings.currency || "INR";

  const formatMoney = (amount) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
    }
  };

  const getInvoiceTotal = (invoice) =>
    Number(invoice.total ?? invoice.grandTotal ?? invoice.totalAmount ?? 0) ||
    0;

  const getInvoiceDate = (invoice) => {
    const value = invoice.createdAt || invoice.date || invoice.invoiceDate;
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getInvoiceId = (invoice) =>
    invoice.id || invoice.invoiceNumber || invoice.invoiceId || "—";

  const getCustomerName = (invoice) => {
    if (typeof invoice.customer === "string") {
      return invoice.customer || "Walk-in Customer";
    }

    return invoice.customer?.name || invoice.customerName || "Walk-in Customer";
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const todayInvoices = invoices.filter((invoice) => {
    const date = getInvoiceDate(invoice);
    return date && date >= todayStart && date < tomorrowStart;
  });

  const totalSales = invoices.reduce(
    (sum, invoice) => sum + getInvoiceTotal(invoice),
    0,
  );

  const todaySales = todayInvoices.reduce(
    (sum, invoice) => sum + getInvoiceTotal(invoice),
    0,
  );

  const averageOrderValue =
    invoices.length > 0 ? totalSales / invoices.length : 0;

  const paidInvoices = invoices.filter(
    (invoice) => String(invoice.status || "Paid").toLowerCase() === "paid",
  );

  const paymentTotals = paidInvoices.reduce(
    (totals, invoice) => {
      const method = String(invoice.paymentMethod || "").toLowerCase();
      const amount = getInvoiceTotal(invoice);

      if (method === "cash") totals.cash += amount;
      else if (method === "card") totals.card += amount;
      else if (method === "upi") totals.upi += amount;

      return totals;
    },
    { cash: 0, card: 0, upi: 0 },
  );

  const stockAlerts = products.filter((product) => {
    const stock = Number(product.quantity ?? product.stock) || 0;
    return stock <= 5;
  });

  const outOfStockCount = products.filter(
    (product) => (Number(product.quantity ?? product.stock) || 0) <= 0,
  ).length;

  const lowStockCount = stockAlerts.filter(
    (product) => (Number(product.quantity ?? product.stock) || 0) > 0,
  ).length;

  const productSales = useMemo(() => {
    const salesMap = {};

    invoices.forEach((invoice) => {
      if (!Array.isArray(invoice.items)) return;

      invoice.items.forEach((item) => {
        const key = String(item.id ?? item.sku ?? item.name);

        if (!salesMap[key]) {
          salesMap[key] = {
            id: key,
            name: item.name || "Unnamed Product",
            quantity: 0,
            revenue: 0,
          };
        }

        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        salesMap[key].quantity += quantity;
        salesMap[key].revenue += Number(item.lineSubtotal) || price * quantity;
      });
    });

    return Object.values(salesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [invoices]);

  const chartData = useMemo(() => {
    const now = new Date();
    const days = period === "day" ? 1 : period === "week" ? 7 : 30;
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);

      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const sales = invoices
        .filter((invoice) => {
          const invoiceDate = getInvoiceDate(invoice);
          return invoiceDate && invoiceDate >= start && invoiceDate < end;
        })
        .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);

      result.push({
        label:
          period === "day"
            ? "Today"
            : start.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              }),
        sales,
      });
    }

    return result;
  }, [invoices, period]);

  const maxChartSales = Math.max(...chartData.map((item) => item.sales), 1);

  const recentInvoices = [...invoices]
    .sort((a, b) => {
      const dateA = getInvoiceDate(a)?.getTime() || 0;
      const dateB = getInvoiceDate(b)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const stats = [
    {
      title: "Total Customers",
      value: customers.length,
      icon: Users,
      color: "blue",
    },
    {
      title: "Total Products",
      value: products.length,
      icon: Package,
      color: "purple",
    },
    {
      title: "Total Invoices",
      value: invoices.length,
      icon: FileText,
      color: "orange",
    },
    {
      title: "Total Sales",
      value: formatMoney(totalSales),
      icon: IndianRupee,
      color: "green",
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your restaurant's billing activity.</p>
        </div>
      </div>

      {/* Main statistics */}
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="stat-card" key={stat.title}>
              <div>
                <p className="stat-title">{stat.title}</p>
                <h2 className="stat-value">{stat.value}</h2>
              </div>

              <div className={`stat-icon ${stat.color}`}>
                <Icon size={23} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's summary */}
      <div className="dashboard-substats">
        <div className="substat-card">
          <div className="substat-icon blue">
            <TrendingUp size={20} />
          </div>
          <div>
            <p>Today's Sales</p>
            <h3>{formatMoney(todaySales)}</h3>
          </div>
        </div>

        <div className="substat-card">
          <div className="substat-icon purple">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p>Today's Orders</p>
            <h3>{todayInvoices.length}</h3>
          </div>
        </div>

        <div className="substat-card">
          <div className="substat-icon green">
            <IndianRupee size={20} />
          </div>
          <div>
            <p>Average Order Value</p>
            <h3>{formatMoney(averageOrderValue)}</h3>
          </div>
        </div>
      </div>

      {/* Sales chart */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>Sales Analytics</h2>
            <p className="section-subtitle">Sales generated by date</p>
          </div>

          <div className="period-filter">
            <button
              className={period === "day" ? "active" : ""}
              onClick={() => setPeriod("day")}
            >
              Today
            </button>
            <button
              className={period === "week" ? "active" : ""}
              onClick={() => setPeriod("week")}
            >
              7 Days
            </button>
            <button
              className={period === "month" ? "active" : ""}
              onClick={() => setPeriod("month")}
            >
              30 Days
            </button>
          </div>
        </div>

        {period === "day" ? (
          <div className="single-day-chart">
            <div className="single-day-bar">
              <div
                className="single-day-fill"
                style={{
                  height: `${todaySales > 0 ? 100 : 0}%`,
                }}
              />
            </div>
            <div className="single-day-details">
              <span>Today's sales</span>
              <strong>{formatMoney(todaySales)}</strong>
            </div>
          </div>
        ) : (
          <div className="sales-chart">
            {chartData.map((item) => (
              <div className="chart-column" key={item.label}>
                <span className="chart-value">
                  {item.sales > 0 ? formatMoney(item.sales) : ""}
                </span>
                <div className="chart-bar-track">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(item.sales / maxChartSales) * 100}%`,
                    }}
                    title={`${item.label}: ${formatMoney(item.sales)}`}
                  />
                </div>
                <span className="chart-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payments and inventory */}
      <div className="dashboard-two-column">
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <div>
              <h2>Payment Summary</h2>
              <p className="section-subtitle">Paid invoice totals by method</p>
            </div>
          </div>

          <div className="payment-summary-list">
            <div className="payment-summary-row">
              <div className="payment-label">
                <span className="payment-icon cash">
                  <Banknote size={18} />
                </span>
                <span>Cash</span>
              </div>
              <strong>{formatMoney(paymentTotals.cash)}</strong>
            </div>

            <div className="payment-summary-row">
              <div className="payment-label">
                <span className="payment-icon card">
                  <CreditCard size={18} />
                </span>
                <span>Card</span>
              </div>
              <strong>{formatMoney(paymentTotals.card)}</strong>
            </div>

            <div className="payment-summary-row">
              <div className="payment-label">
                <span className="payment-icon upi">
                  <Smartphone size={18} />
                </span>
                <span>UPI</span>
              </div>
              <strong>{formatMoney(paymentTotals.upi)}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <div>
              <h2>Inventory Alerts</h2>
              <p className="section-subtitle">Products with 5 or fewer units</p>
            </div>
            <AlertTriangle size={20} className="inventory-alert-icon" />
          </div>

          <div className="inventory-counts">
            <div className="inventory-count-card">
              <span>Low Stock</span>
              <strong>{lowStockCount}</strong>
            </div>
            <div className="inventory-count-card danger">
              <span>Out of Stock</span>
              <strong>{outOfStockCount}</strong>
            </div>
          </div>

          {stockAlerts.length > 0 ? (
            <div className="stock-alert-list">
              {stockAlerts.slice(0, 4).map((product) => {
                const stock = Number(product.quantity ?? product.stock) || 0;

                return (
                  <div className="stock-alert-item" key={product.id}>
                    <span>{product.name || "Unnamed Product"}</span>
                    <span className={stock <= 0 ? "stock-zero" : "stock-low"}>
                      {stock <= 0 ? "Out of stock" : `${stock} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mini-empty-state">
              <Package size={25} />
              <p>No low-stock products</p>
            </div>
          )}
        </section>
      </div>

      {/* Best sellers */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>Best-Selling Products</h2>
            <p className="section-subtitle">Ranked by quantity sold</p>
          </div>
          <Award size={21} className="best-seller-icon" />
        </div>

        {productSales.length > 0 ? (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity Sold</th>
                  <th className="dashboard-amount">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {productSales.map((product, index) => (
                  <tr key={product.id}>
                    <td>
                      <span className="product-rank">{index + 1}</span>
                      {product.name}
                    </td>
                    <td>{product.quantity}</td>
                    <td className="dashboard-amount">
                      {formatMoney(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mini-empty-state">
            <Package size={30} />
            <p>Product sales will appear after invoices are generated.</p>
          </div>
        )}
      </section>

      {/* Recent invoices */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>Recent Invoices</h2>
            <p className="section-subtitle">Your latest billing activity</p>
          </div>
          <span className="invoice-count">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </span>
        </div>

        {recentInvoices.length > 0 ? (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="dashboard-amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((invoice, index) => {
                  const invoiceDate = getInvoiceDate(invoice);

                  return (
                    <tr key={invoice.id || invoice.invoiceNumber || index}>
                      <td className="dashboard-invoice-id">
                        {getInvoiceId(invoice)}
                      </td>
                      <td>{getCustomerName(invoice)}</td>
                      <td>
                        {invoiceDate
                          ? invoiceDate.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td>{invoice.paymentMethod || "—"}</td>
                      <td>
                        <span
                          className={`invoice-status ${
                            String(invoice.status || "Paid").toLowerCase() ===
                            "paid"
                              ? "paid"
                              : "pending"
                          }`}
                        >
                          {invoice.status || "Paid"}
                        </span>
                      </td>
                      <td className="dashboard-amount">
                        {formatMoney(getInvoiceTotal(invoice))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={40} />
            <p>No invoices available yet</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
