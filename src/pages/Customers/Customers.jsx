import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Users,
} from "lucide-react";

import { useEffect, useState } from "react";

import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
} from "../../utils/customerStore";

import "./Customers.css";

function Customers() {
  const [customers, setCustomers] = useState(() => getCustomers());

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  });

  // Keep this page synchronized with shared customer storage.
  useEffect(() => {
    const syncCustomers = () => {
      setCustomers(getCustomers());
    };

    window.addEventListener("customersUpdated", syncCustomers);

    return () => {
      window.removeEventListener("customersUpdated", syncCustomers);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      company: "",
      address: "",
    });

    setErrors({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    resetForm();
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    if (Number(customer.id) === 1) return;

    setEditingCustomer(customer);

    setFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      company: customer.company || "",
      address: customer.address || "",
    });

    setErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Customer name is required";
    }

    if (!/^[0-9]{10}$/.test(formData.phone.trim())) {
      newErrors.phone = "Enter a valid 10-digit phone number";
    }

    if (
      formData.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      newErrors.email = "Enter a valid email address";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    const customerData = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      address: formData.address.trim(),
    };

    if (editingCustomer) {
      updateCustomer(Number(editingCustomer.id), customerData);
    } else {
      addCustomer(customerData);
    }

    setCustomers(getCustomers());
    closeModal();
  };

  const handleConfirmDelete = () => {
    if (!customerToDelete || Number(customerToDelete.id) === 1) return;

    deleteCustomer(Number(customerToDelete.id));
    setCustomers(getCustomers());
    setCustomerToDelete(null);
  };

  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase().trim();

    return (
      (customer.name || "").toLowerCase().includes(search) ||
      (customer.phone || "").includes(search) ||
      (customer.email || "").toLowerCase().includes(search) ||
      (customer.company || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="customers-page">
      <div className="page-actions">
        <div className="search-box">
          <Search size={20} />

          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <button className="add-btn" onClick={openAddModal}>
          <Plus size={20} />
          Add Customer
        </button>
      </div>

      <div className="customer-count">
        <Users size={20} />
        <span>Total Customers: {customers.length}</span>
      </div>

      <div className="table-container">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone Number</th>
              <th>Email</th>
              <th>Company</th>
              <th>Address</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.email || "-"}</td>
                  <td>{customer.company || "-"}</td>
                  <td>{customer.address || "-"}</td>

                  <td>
                    <div className="table-actions">
                      <button
                        className="edit-btn"
                        title="Edit customer"
                        disabled={Number(customer.id) === 1}
                        onClick={() => openEditModal(customer)}
                      >
                        <Edit size={17} />
                      </button>

                      <button
                        className="delete-btn"
                        title={
                          Number(customer.id) === 1
                            ? "Walk-in Customer cannot be deleted"
                            : "Delete customer"
                        }
                        disabled={Number(customer.id) === 1}
                        onClick={() => setCustomerToDelete(customer)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-table">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="customer-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingCustomer ? "Edit Customer" : "Add Customer"}
                </h2>
                <p>Enter the customer details below.</p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={closeModal}
              >
                <X size={21} />
              </button>
            </div>

            <form className="customer-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="customer-name">Customer Name *</label>
                <input
                  id="customer-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter customer name"
                />
                {errors.name && (
                  <span className="error-message">{errors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="customer-phone">Phone Number *</label>
                <input
                  id="customer-phone"
                  name="phone"
                  type="tel"
                  maxLength={10}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit phone number"
                />
                {errors.phone && (
                  <span className="error-message">{errors.phone}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="customer-email">Email</label>
                <input
                  id="customer-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <span className="error-message">{errors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="customer-company">Company Name</label>
                <input
                  id="customer-company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Enter company name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="customer-address">Address</label>
                <textarea
                  id="customer-address"
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter address"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="save-btn">
                  {editingCustomer ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customerToDelete && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <h2>Delete Customer</h2>
            </div>

            <div className="delete-modal-content">
              <p>
                Are you sure you want to delete{" "}
                <strong>{customerToDelete.name}</strong>?
              </p>
              <p className="delete-warning">
                This action cannot be undone.
              </p>
            </div>

            <div className="delete-modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setCustomerToDelete(null)}
              >
                Cancel
              </button>

              <button
                className="confirm-delete-btn"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;