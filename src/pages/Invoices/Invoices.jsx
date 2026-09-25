import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Eye,
  Printer,
  X,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  ShoppingBag,
  ChevronDown,
} from "lucide-react";

import { getSettings } from "../../utils/settingStore";
import "./Invoices.css";

const INVOICE_STORAGE_KEY = "pos_invoices";

const readInvoices = () => {
  try {
    const stored = localStorage.getItem(INVOICE_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read invoices:", error);
    return [];
  }
};

const money = (value, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getPaymentIcon = (method) => {
  switch (method) {
    case "Cash":
      return <Banknote size={16} />;
    case "Card":
      return <CreditCard size={16} />;
    case "UPI":
      return <Smartphone size={16} />;
    default:
      return <CreditCard size={16} />;
  }
};

function Invoices() {
  const [invoices, setInvoices] = useState(() => readInvoices());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("All");

  const [settings, setSettings] = useState(() => getSettings());

  const currency = settings?.currency || "INR";
  const formatMoney = (value) => money(value, currency);

  // Keep invoices synchronized with the POS invoice store.
  useEffect(() => {
    const syncInvoices = () => {
      setInvoices(readInvoices());
    };

    window.addEventListener("invoicesUpdated", syncInvoices);
    window.addEventListener("storage", syncInvoices);

    return () => {
      window.removeEventListener("invoicesUpdated", syncInvoices);
      window.removeEventListener("storage", syncInvoices);
    };
  }, []);

  // Keep restaurant settings synchronized with the Settings page.
  useEffect(() => {
    const syncSettings = () => {
      setSettings(getSettings());
    };

    window.addEventListener("settingsUpdated", syncSettings);
    window.addEventListener("storage", syncSettings);

    return () => {
      window.removeEventListener("settingsUpdated", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const invoiceId = String(invoice.id || "").toLowerCase();
      const customerName = String(invoice.customer?.name || "").toLowerCase();
      const customerPhone = String(invoice.customer?.phone || "").toLowerCase();

      const matchesSearch =
        invoiceId.includes(search) ||
        customerName.includes(search) ||
        customerPhone.includes(search);

      const matchesPayment =
        paymentFilter === "All" || invoice.paymentMethod === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [invoices, searchTerm, paymentFilter]);

  const totalRevenue = invoices.reduce(
    (total, invoice) => total + (Number(invoice.total) || 0),
    0,
  );

  const totalTax = invoices.reduce(
    (total, invoice) => total + (Number(invoice.tax) || 0),
    0,
  );

  const handlePrint = (invoice) => {
    setSelectedInvoice(invoice);

    window.setTimeout(() => {
      window.print();
    }, 150);
  };

  const closeDetails = () => {
    setSelectedInvoice(null);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDetails();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const restaurantName = settings?.restaurantName?.trim() || "Restaurant";

  const restaurantAddress = settings?.address?.trim();
  const restaurantPhone = settings?.phone?.trim();
  const restaurantEmail = settings?.email?.trim();

  const receiptFooter = settings?.footer?.trim() || "Thank you for visiting!";

  const getInvoiceTax = (invoice) => {
    if (invoice.tax !== undefined && invoice.tax !== null) {
      return Number(invoice.tax) || 0;
    }

    return (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0);
  };

  return (
    <div className="invoices-page">
      <div className="invoices-header">
        <div>
          <h2>Invoices</h2>
          <p>View, manage, and print your restaurant bills.</p>
        </div>

        <div className="invoice-header-badge">
          <Receipt size={18} />
          <span>{invoices.length} invoices</span>
        </div>
      </div>

      <div className="invoice-stats">
        <div className="invoice-stat-card">
          <div className="invoice-stat-icon blue">
            <FileText size={21} />
          </div>
          <div>
            <span>Total Invoices</span>
            <strong>{invoices.length}</strong>
          </div>
        </div>

        <div className="invoice-stat-card">
          <div className="invoice-stat-icon green">
            <Receipt size={21} />
          </div>
          <div>
            <span>Total Revenue</span>
            <strong>{formatMoney(totalRevenue)}</strong>
          </div>
        </div>

        <div className="invoice-stat-card">
          <div className="invoice-stat-icon orange">
            <CreditCard size={21} />
          </div>
          <div>
            <span>Total GST</span>
            <strong>{formatMoney(totalTax)}</strong>
          </div>
        </div>
      </div>

      <section className="invoices-panel">
        <div className="invoices-toolbar">
          <div className="invoices-toolbar-title">
            <h3>All Invoices</h3>
            <span>{filteredInvoices.length} records</span>
          </div>

          <div className="invoice-filters">
            <div className="invoice-search">
              <Search size={18} />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search invoice or customer..."
                aria-label="Search invoices"
              />

              {searchTerm && (
                <button
                  type="button"
                  className="invoice-search-clear"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="invoice-filter-select">
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                aria-label="Filter by payment method"
              >
                <option value="All">All Payments</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {filteredInvoices.length > 0 ? (
          <div className="invoice-table-wrapper">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date &amp; Time</th>
                  <th>Customer</th>
                  <th>Subtotal</th>
                  <th>Discount</th>
                  <th>CGST</th>
                  <th>SGST</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong className="invoice-number">
                        {invoice.id || "—"}
                      </strong>
                    </td>

                    <td>
                      <div className="invoice-date-cell">
                        <span>{formatDate(invoice.createdAt)}</span>
                        <small>
                          {invoice.createdAt
                            ? new Date(invoice.createdAt).toLocaleTimeString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "—"}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="invoice-customer-cell">
                        <strong>
                          {invoice.customer?.name || "Walk-in Customer"}
                        </strong>
                        <small>{invoice.customer?.phone || "—"}</small>
                      </div>
                    </td>

                    <td>{formatMoney(invoice.subtotal)}</td>
                    <td>{formatMoney(invoice.discount)}</td>
                    <td>{formatMoney(invoice.cgst)}</td>
                    <td>{formatMoney(invoice.sgst)}</td>

                    <td>
                      <strong className="invoice-total">
                        {formatMoney(invoice.total)}
                      </strong>
                    </td>

                    <td>
                      <span className="invoice-payment">
                        {getPaymentIcon(invoice.paymentMethod)}
                        {invoice.paymentMethod || "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`invoice-status ${
                          String(invoice.status || "").toLowerCase() === "paid"
                            ? "paid"
                            : "unpaid"
                        }`}
                      >
                        {invoice.status || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <div className="invoice-action-buttons">
                        <button
                          type="button"
                          className="invoice-view-btn"
                          onClick={() => setSelectedInvoice(invoice)}
                          title="View invoice"
                          aria-label={`View invoice ${invoice.id}`}
                        >
                          <Eye size={17} />
                        </button>

                        <button
                          type="button"
                          className="invoice-print-btn"
                          onClick={() => handlePrint(invoice)}
                          title="Print invoice"
                          aria-label={`Print invoice ${invoice.id}`}
                        >
                          <Printer size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="invoices-empty-state">
            <div className="invoices-empty-icon">
              <Receipt size={35} />
            </div>

            <h3>
              {invoices.length === 0
                ? "No Invoices Yet"
                : "No Matching Invoices"}
            </h3>

            <p>
              {invoices.length === 0
                ? "Generated bills from the POS page will appear here."
                : "Try changing your search term or payment filter."}
            </p>

            {(searchTerm || paymentFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setPaymentFilter("All");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </section>

      {/* INVOICE DETAILS MODAL */}

      {selectedInvoice && (
        <div
          className="invoice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetails();
            }
          }}
        >
          <section
            className="invoice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-modal-title"
          >
            <div className="invoice-modal-header no-print">
              <div>
                <h3 id="invoice-modal-title">Invoice Details</h3>
                <p>{selectedInvoice.id || "Invoice"}</p>
              </div>

              <button
                type="button"
                className="invoice-modal-close"
                onClick={closeDetails}
                aria-label="Close invoice details"
              >
                <X size={20} />
              </button>
            </div>

            {/* PRINTABLE RECEIPT */}

            <div className="invoice-print-content">
              <div className="print-business-header">
                <div className="print-business-icon">
                  <ShoppingBag size={24} />
                </div>

                <h2>{restaurantName}</h2>
                <p>Restaurant Billing Receipt</p>

                {restaurantAddress && <p>{restaurantAddress}</p>}
                {restaurantPhone && <p>Phone: {restaurantPhone}</p>}
                {restaurantEmail && <p>Email: {restaurantEmail}</p>}
              </div>

              <div className="print-invoice-heading">
                <h3>INVOICE</h3>
                <strong>{selectedInvoice.id || "—"}</strong>
              </div>

              <div className="print-info-grid">
                <div>
                  <span>Invoice Date</span>
                  <strong>{formatDateTime(selectedInvoice.createdAt)}</strong>
                </div>

                <div>
                  <span>Payment Method</span>
                  <strong>{selectedInvoice.paymentMethod || "—"}</strong>
                </div>

                <div>
                  <span>Customer</span>
                  <strong>
                    {selectedInvoice.customer?.name || "Walk-in Customer"}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{selectedInvoice.customer?.phone || "—"}</strong>
                </div>

                {selectedInvoice.customer?.email && (
                  <div>
                    <span>Email</span>
                    <strong>{selectedInvoice.customer.email}</strong>
                  </div>
                )}

                {selectedInvoice.customer?.address && (
                  <div>
                    <span>Address</span>
                    <strong>{selectedInvoice.customer.address}</strong>
                  </div>
                )}
              </div>

              <div className="print-items-wrapper">
                <table className="print-items-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(selectedInvoice.items || []).map((item, index) => (
                      <tr key={`${item.id ?? item.sku ?? item.name}-${index}`}>
                        <td>
                          <strong>{item.name || "Product"}</strong>
                          {item.sku && <small>SKU: {item.sku}</small>}
                        </td>

                        <td>{Number(item.quantity) || 0}</td>
                        <td>{formatMoney(item.price)}</td>
                        <td>
                          {formatMoney(
                            item.lineSubtotal ??
                              (Number(item.price) || 0) *
                                (Number(item.quantity) || 0),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="print-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(selectedInvoice.subtotal)}</strong>
                </div>

                <div>
                  <span>Discount</span>
                  <strong>- {formatMoney(selectedInvoice.discount)}</strong>
                </div>

                <div>
                  <span>CGST</span>
                  <strong>{formatMoney(selectedInvoice.cgst)}</strong>
                </div>

                <div>
                  <span>SGST</span>
                  <strong>{formatMoney(selectedInvoice.sgst)}</strong>
                </div>

                <div>
                  <span>Total Tax</span>
                  <strong>{formatMoney(getInvoiceTax(selectedInvoice))}</strong>
                </div>

                <div className="print-grand-total">
                  <span>Grand Total</span>
                  <strong>{formatMoney(selectedInvoice.total)}</strong>
                </div>
              </div>

              <div className="print-payment-info">
                <div>
                  <span>Payment Status</span>
                  <strong>{selectedInvoice.status || "—"}</strong>
                </div>

                <div>
                  <span>Amount Received</span>
                  <strong>{formatMoney(selectedInvoice.amountReceived)}</strong>
                </div>

                <div>
                  <span>Change</span>
                  <strong>{formatMoney(selectedInvoice.change)}</strong>
                </div>
              </div>

              <div className="print-footer">
                <p>{receiptFooter}</p>
                <small>We look forward to serving you again.</small>
              </div>
            </div>

            <div className="invoice-modal-footer no-print">
              <button
                type="button"
                className="invoice-close-btn"
                onClick={closeDetails}
              >
                Close
              </button>

              <button
                type="button"
                className="invoice-print-main-btn"
                onClick={() => window.print()}
              >
                <Printer size={17} />
                Print Invoice
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Invoices;
