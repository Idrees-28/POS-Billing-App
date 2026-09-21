import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Pause,
  RotateCcw,
  CheckCircle,
  Package,
  X,
  Play,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import { getCustomers, addCustomer } from "../../utils/customerStore";

import "./POS.css";

const INVOICE_STORAGE_KEY = "pos_invoices";
const HELD_BILLS_STORAGE_KEY = "pos_held_bills";

const initialProducts = [
  {
    id: 1,
    name: "Chicken Biriyani",
    sku: "FOOD-001",
    category: "Main Course",
    price: 180,
    stock: 25,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 2,
    name: "Chicken 65",
    sku: "FOOD-002",
    category: "Starters",
    price: 150,
    stock: 30,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 3,
    name: "Mutton Biriyani",
    sku: "FOOD-003",
    category: "Main Course",
    price: 240,
    stock: 15,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 4,
    name: "Veg Fried Rice",
    sku: "FOOD-004",
    category: "Main Course",
    price: 130,
    stock: 20,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 5,
    name: "French Fries",
    sku: "SNACK-001",
    category: "Starters",
    price: 100,
    stock: 40,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 6,
    name: "Fresh Lime Juice",
    sku: "DRINK-001",
    category: "Beverages",
    price: 60,
    stock: 50,
    taxEnabled: false,
    taxRate: 0,
  },
  {
    id: 7,
    name: "Fresh Orange Juice",
    sku: "DRINK-002",
    category: "Beverages",
    price: 80,
    stock: 35,
    taxEnabled: false,
    taxRate: 0,
  },
  {
    id: 8,
    name: "Mineral Water",
    sku: "DRINK-003",
    category: "Beverages",
    price: 20,
    stock: 100,
    taxEnabled: false,
    taxRate: 0,
  },
];

const categories = ["All", "Main Course", "Starters", "Beverages"];

const readStorage = (key, fallback = []) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function POS() {
  const [products] = useState(initialProducts);

  const [customers, setCustomers] = useState(() => getCustomers());
  const [selectedCustomer, setSelectedCustomer] = useState("1");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");

  const [heldBills, setHeldBills] = useState(() =>
    readStorage(HELD_BILLS_STORAGE_KEY),
  );

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
  });

  useEffect(() => {
    const syncCustomers = () => {
      setCustomers(getCustomers());
    };

    window.addEventListener("customersUpdated", syncCustomers);

    return () => {
      window.removeEventListener("customersUpdated", syncCustomers);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search);

      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const getCartQuantity = (productId) => {
    const item = cart.find((cartItem) => cartItem.id === productId);
    return item ? item.quantity : 0;
  };

  const showMessage = (message, type = "success") => {
    if (type === "error") {
      setErrorMessage(message);
      setSuccessMessage("");
    } else {
      setSuccessMessage(message);
      setErrorMessage("");
    }
  };

  const addToCart = (product) => {
    const currentQuantity = getCartQuantity(product.id);

    if (currentQuantity >= product.stock) {
      showMessage("Available stock limit reached.", "error");
      return;
    }

    setCart((previous) => {
      const existing = previous.find((item) => item.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...previous,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    setErrorMessage("");
  };

  const increaseQuantity = (productId) => {
    const product = products.find((item) => item.id === productId);
    const quantity = getCartQuantity(productId);

    if (!product || quantity >= product.stock) {
      showMessage("Available stock limit reached.", "error");
      return;
    }

    setCart((previous) =>
      previous.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );

    setErrorMessage("");
  };

  const decreaseQuantity = (productId) => {
    setCart((previous) =>
      previous
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId) => {
    setCart((previous) => previous.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount("");
    setAmountReceived("");
    setErrorMessage("");
    showMessage("Cart cleared.");
  };

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const discountValue = Math.min(subtotal, Math.max(0, Number(discount) || 0));

  const discountRatio = subtotal > 0 ? discountValue / subtotal : 0;

  const totalCGST = cart.reduce((total, item) => {
    if (!item.taxEnabled) return total;

    const itemSubtotal = item.price * item.quantity;
    const discountedSubtotal = itemSubtotal * (1 - discountRatio);
    const cgstRate = (Number(item.taxRate) || 0) / 2;

    return total + (discountedSubtotal * cgstRate) / 100;
  }, 0);

  const totalSGST = cart.reduce((total, item) => {
    if (!item.taxEnabled) return total;

    const itemSubtotal = item.price * item.quantity;
    const discountedSubtotal = itemSubtotal * (1 - discountRatio);
    const sgstRate = (Number(item.taxRate) || 0) / 2;

    return total + (discountedSubtotal * sgstRate) / 100;
  }, 0);

  const totalTax = totalCGST + totalSGST;
  const grandTotal = Math.max(0, subtotal - discountValue + totalTax);

  const received = Number(amountReceived) || 0;
  const balanceAmount = Math.max(0, grandTotal - received);
  const changeAmount = Math.max(0, received - grandTotal);

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  const selectedCustomerDetails = customers.find(
    (customer) => String(customer.id) === String(selectedCustomer),
  );

  const clearSearch = () => {
    setSearchTerm("");
    setSelectedCategory("All");
  };

  const handleNewCustomerChange = (event) => {
    const { name, value } = event.target;

    setNewCustomer((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAddQuickCustomer = (event) => {
    event.preventDefault();

    if (!newCustomer.name.trim()) {
      showMessage("Enter the customer's name.", "error");
      return;
    }

    if (!/^[0-9]{10}$/.test(newCustomer.phone.trim())) {
      showMessage("Enter a valid 10-digit phone number.", "error");
      return;
    }

    const createdCustomer = addCustomer({
      name: newCustomer.name.trim(),
      phone: newCustomer.phone.trim(),
      email: "",
      company: "",
      address: "",
    });

    setCustomers(getCustomers());
    setSelectedCustomer(String(createdCustomer.id));
    setNewCustomer({ name: "", phone: "" });
    setShowCustomerForm(false);

    showMessage("Customer added successfully.");
  };

  const holdBill = () => {
    if (cart.length === 0) {
      showMessage("Add products before holding the bill.", "error");
      return;
    }

    const bill = {
      id: Date.now(),
      customerId: selectedCustomer,
      cart,
      discount,
      paymentMethod,
      amountReceived,
      createdAt: new Date().toISOString(),
    };

    const updatedBills = [...heldBills, bill];

    setHeldBills(updatedBills);
    writeStorage(HELD_BILLS_STORAGE_KEY, updatedBills);

    setCart([]);
    setDiscount("");
    setAmountReceived("");

    showMessage("Bill held successfully.");
  };

  const resumeHeldBill = (billId) => {
    const bill = heldBills.find((item) => item.id === billId);

    if (!bill) return;

    if (cart.length > 0) {
      showMessage(
        "Hold or clear the current cart before restoring another bill.",
        "error",
      );
      return;
    }

    setCart(bill.cart);
    setSelectedCustomer(String(bill.customerId || "1"));
    setDiscount(bill.discount || "");
    setPaymentMethod(bill.paymentMethod || "Cash");
    setAmountReceived(bill.amountReceived || "");

    const updatedBills = heldBills.filter((item) => item.id !== billId);

    setHeldBills(updatedBills);
    writeStorage(HELD_BILLS_STORAGE_KEY, updatedBills);

    showMessage("Held bill restored.");
  };

  const deleteHeldBill = (billId) => {
    const updatedBills = heldBills.filter((bill) => bill.id !== billId);

    setHeldBills(updatedBills);
    writeStorage(HELD_BILLS_STORAGE_KEY, updatedBills);

    showMessage("Held bill removed.");
  };

  const generateBill = () => {
    if (cart.length === 0) {
      showMessage("Please add products to the cart.", "error");
      return;
    }

    if (!selectedCustomerDetails) {
      showMessage("Please select a customer.", "error");
      return;
    }

    if (paymentMethod === "Cash" && received < grandTotal) {
      showMessage("Received amount is less than the bill total.", "error");
      return;
    }

    const invoice = {
      id: `INV-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customer: { ...selectedCustomerDetails },
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        taxEnabled: item.taxEnabled,
        taxRate: item.taxRate,
        lineSubtotal: item.price * item.quantity,
      })),
      subtotal,
      discount: discountValue,
      cgst: totalCGST,
      sgst: totalSGST,
      tax: totalTax,
      total: grandTotal,
      paymentMethod,
      amountReceived: paymentMethod === "Cash" ? received : grandTotal,
      change: paymentMethod === "Cash" ? changeAmount : 0,
      status: "Paid",
    };

    const existingInvoices = readStorage(INVOICE_STORAGE_KEY);
    writeStorage(INVOICE_STORAGE_KEY, [invoice, ...existingInvoices]);

    window.dispatchEvent(new Event("invoicesUpdated"));

    setCart([]);
    setDiscount("");
    setAmountReceived("");

    showMessage(`Invoice ${invoice.id} generated successfully.`);
  };

  return (
    <div className="pos-page">
      {(successMessage || errorMessage) && (
        <div className={`pos-message ${errorMessage ? "error" : "success"}`}>
          {errorMessage ? errorMessage : successMessage}
          <button
            type="button"
            onClick={() => {
              setSuccessMessage("");
              setErrorMessage("");
            }}
            aria-label="Close message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="pos-header">
        <div>
          <h2>POS Billing</h2>
          <p>Create a customer bill and process payments.</p>
        </div>

        <div className="pos-header-actions">
          <button className="hold-bill-btn" onClick={holdBill}>
            <Pause size={17} />
            Hold Bill
          </button>

          <button className="clear-cart-btn" onClick={clearCart}>
            <RotateCcw size={17} />
            Clear Cart
          </button>
        </div>
      </div>

      <div className="pos-layout">
        {/* PRODUCTS PANEL */}
        <section className="pos-products-panel">
          <div className="pos-search">
            <Search size={19} />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search products by name or SKU..."
            />

            {searchTerm && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="category-list">
            {categories.map((category) => (
              <button
                key={category}
                className={
                  selectedCategory === category
                    ? "category-btn active"
                    : "category-btn"
                }
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="pos-product-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const quantityInCart = getCartQuantity(product.id);
                const outOfStock = quantityInCart >= product.stock;

                return (
                  <div className="pos-product-card" key={product.id}>
                    <div className="product-card-top">
                      <span className="product-category">
                        {product.category}
                      </span>

                      {product.taxEnabled && (
                        <span className="product-tax">
                          GST {product.taxRate}%
                        </span>
                      )}
                    </div>

                    <h3>{product.name}</h3>
                    <p className="product-sku">SKU: {product.sku}</p>

                    <div className="product-card-bottom">
                      <div>
                        <strong>{money(product.price)}</strong>
                        <small>{product.stock - quantityInCart} in stock</small>
                      </div>

                      <button
                        className="add-product-btn"
                        disabled={outOfStock}
                        onClick={() => addToCart(product)}
                        title={
                          outOfStock ? "Stock limit reached" : "Add product"
                        }
                      >
                        <Plus size={17} />
                        Add
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-products">
                <Package size={45} />
                <h3>No Products Found</h3>
                <p>
                  No products match{" "}
                  {searchTerm ? `"${searchTerm}"` : "your selected category"}.
                </p>
                <button
                  className="clear-search-btn-large"
                  onClick={clearSearch}
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        </section>

        {/* BILL PANEL */}
        <section className="pos-bill-panel">
          <div className="bill-section">
            <div className="section-title">
              <User size={19} />
              <h3>Customer</h3>
            </div>

            <select
              className="customer-select"
              value={String(selectedCustomer)}
              onChange={(event) => setSelectedCustomer(event.target.value)}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={String(customer.id)}>
                  {customer.name} - {customer.phone}
                </option>
              ))}
            </select>

            <button
              className="quick-add-customer-btn"
              onClick={() => setShowCustomerForm((previous) => !previous)}
            >
              <Plus size={16} />
              {showCustomerForm ? "Cancel Add Customer" : "Add Customer"}
            </button>

            {showCustomerForm && (
              <form
                className="quick-customer-form"
                onSubmit={handleAddQuickCustomer}
              >
                <input
                  name="name"
                  value={newCustomer.name}
                  onChange={handleNewCustomerChange}
                  placeholder="Customer name"
                />

                <input
                  name="phone"
                  type="tel"
                  maxLength={10}
                  value={newCustomer.phone}
                  onChange={handleNewCustomerChange}
                  placeholder="10-digit phone number"
                />

                <button type="submit">Save Customer</button>
              </form>
            )}
          </div>

          <div className="bill-section cart-section">
            <div className="section-title">
              <ShoppingCart size={19} />
              <h3>Current Bill</h3>
              <span className="cart-count">{totalItems} items</span>
            </div>

            {cart.length > 0 ? (
              <div className="cart-items">
                {cart.map((item) => (
                  <div className="cart-item" key={item.id}>
                    <div className="cart-item-info">
                      <strong>{item.name}</strong>
                      <small>
                        {money(item.price)} × {item.quantity}
                      </small>
                      {item.taxEnabled && (
                        <small>
                          GST {item.taxRate}% included in calculation
                        </small>
                      )}
                    </div>

                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <button
                          onClick={() => decreaseQuantity(item.id)}
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          <Minus size={14} />
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          onClick={() => increaseQuantity(item.id)}
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <strong>{money(item.price * item.quantity)}</strong>

                      <button
                        className="remove-cart-item-btn"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-cart">
                <ShoppingCart size={35} />
                <p>Your cart is empty</p>
                <small>Select products to start a bill.</small>
              </div>
            )}
          </div>

          <div className="bill-section bill-summary">
            <div className="section-title">
              <Receipt size={19} />
              <h3>Bill Summary</h3>
            </div>

            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>

            <div className="summary-row discount-row">
              <label htmlFor="bill-discount">Discount (₹)</label>
              <input
                id="bill-discount"
                type="number"
                min="0"
                max={subtotal}
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="summary-row">
              <span>CGST</span>
              <strong>{money(totalCGST)}</strong>
            </div>

            <div className="summary-row">
              <span>SGST</span>
              <strong>{money(totalSGST)}</strong>
            </div>

            <div className="summary-row">
              <span>Total Tax</span>
              <strong>{money(totalTax)}</strong>
            </div>

            <div className="summary-row grand-total">
              <span>Grand Total</span>
              <strong>{money(grandTotal)}</strong>
            </div>
          </div>

          <div className="bill-section payment-section">
            <div className="section-title">
              <CreditCard size={19} />
              <h3>Payment Method</h3>
            </div>

            <div className="payment-methods">
              <button
                className={
                  paymentMethod === "Cash"
                    ? "payment-method active"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("Cash")}
              >
                <Banknote size={18} />
                Cash
              </button>

              <button
                className={
                  paymentMethod === "Card"
                    ? "payment-method active"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("Card")}
              >
                <CreditCard size={18} />
                Card
              </button>

              <button
                className={
                  paymentMethod === "UPI"
                    ? "payment-method active"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("UPI")}
              >
                <Smartphone size={18} />
                UPI
              </button>
            </div>

            {paymentMethod === "Cash" && (
              <>
                <label className="received-label" htmlFor="amount-received">
                  Amount Received (₹)
                </label>

                <input
                  id="amount-received"
                  className="amount-received-input"
                  type="number"
                  min="0"
                  value={amountReceived}
                  onChange={(event) => setAmountReceived(event.target.value)}
                  placeholder="Enter amount received"
                />

                <div className="payment-result">
                  <div>
                    <span>Balance Due</span>
                    <strong>{money(balanceAmount)}</strong>
                  </div>

                  <div>
                    <span>Change</span>
                    <strong>{money(changeAmount)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            className="generate-bill-btn"
            onClick={generateBill}
            disabled={cart.length === 0}
          >
            <CheckCircle size={19} />
            Generate Bill
          </button>
        </section>
      </div>

      {/* HELD BILLS */}
      <section className="held-bills-section">
        <div className="section-title">
          <Pause size={19} />
          <h3>Held Bills ({heldBills.length})</h3>
        </div>

        {heldBills.length > 0 ? (
          <div className="held-bills-list">
            {heldBills.map((bill) => {
              const customer = customers.find(
                (item) => String(item.id) === String(bill.customerId),
              );

              return (
                <div className="held-bill-card" key={bill.id}>
                  <div>
                    <strong>{customer?.name || "Walk-in Customer"}</strong>
                    <small>
                      {bill.cart.length} product types ·{" "}
                      {new Date(bill.createdAt).toLocaleString()}
                    </small>
                  </div>

                  <div className="held-bill-actions">
                    <button onClick={() => resumeHeldBill(bill.id)}>
                      <Play size={15} />
                      Restore
                    </button>

                    <button onClick={() => deleteHeldBill(bill.id)}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-held-bills">There are no held bills.</p>
        )}
      </section>
    </div>
  );
}

export default POS;
