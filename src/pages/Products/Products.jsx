import { Search, Plus, Edit, Trash2, X, Package } from "lucide-react";

import { useState } from "react";
import "./Products.css";

import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../../utils/productStore";

function Products() {
  const [products, setProducts] = useState(() => getProducts());

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState(null);

  const [productToDelete, setProductToDelete] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "Main Course",
    price: "",
    quantity: "",
    taxEnabled: false,
    taxRate: "",
  });

  const categories = [
    "Main Course",
    "Starters",
    "Beverages",
    "Desserts",
    "Snacks",
  ];

  const gstRates = [0, 5, 12, 18, 28];

// Filter Products

  const filteredProducts = products.filter((product) => {
    const searchValue = searchTerm.toLowerCase().trim();

    return (
      product.name.toLowerCase().includes(searchValue) ||
      product.sku.toLowerCase().includes(searchValue)
    );
  });

// Open add modal

  const handleAddProduct = () => {
    setEditingProduct(null);

    setFormData({
      name: "",
      sku: "",
      category: "Main Course",
      price: "",
      quantity: "",
      taxEnabled: false,
      taxRate: "",
    });

    setErrors({});

    setIsModalOpen(true);
  };

// Open edit Moral

  const handleEditProduct = (product) => {
    setEditingProduct(product);

    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      taxEnabled: product.taxEnabled,
      taxRate: product.taxEnabled ? product.taxRate : "",
    });

    setErrors({});

    setIsModalOpen(true);
  };

// Close Modal

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setErrors({});
  };

// Form change

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  // Validation

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Product name is required";
    }

    if (!formData.sku.trim()) {
      newErrors.sku = "SKU is required";
    }

    if (!formData.category) {
      newErrors.category = "Category is required";
    }

    if (formData.price === "" || Number(formData.price) <= 0) {
      newErrors.price = "Enter a valid price";
    }

    if (formData.quantity === "" || Number(formData.quantity) < 0) {
      newErrors.quantity = "Enter a valid quantity";
    }

    if (formData.taxEnabled && formData.taxRate === "") {
      newErrors.taxRate = "Select GST rate";
    }

    // Check duplicate SKU
    const duplicateSku = products.some(
      (product) =>
        product.sku.toLowerCase() === formData.sku.trim().toLowerCase() &&
        product.id !== editingProduct?.id,
    );

    if (duplicateSku) {
      newErrors.sku = "SKU already exists";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

// Save Product

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const productData = {
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      category: formData.category,
      price: Number(formData.price),
      quantity: Number(formData.quantity),
      taxEnabled: formData.taxEnabled,
      taxRate: formData.taxEnabled ? Number(formData.taxRate) : 0,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, productData);

      const updatedProducts = getProducts();

      setProducts(updatedProducts);
    } else {
      addProduct(productData);

      const updatedProducts = getProducts();

      setProducts(updatedProducts);
    }

    handleCloseModal();
  };

  // Delete

  const handleDelete = () => {
    if (!productToDelete) {
      return;
    }

    deleteProduct(productToDelete.id);

    setProducts(getProducts());

    setProductToDelete(null);
  };

  return (
    <div className="products-page">
      
      {/* Page Header */}

      <div className="page-header">
        <div>
          <h2>Products</h2>

          <p>Manage your restaurant products</p>
        </div>

        <button className="add-btn" onClick={handleAddProduct}>
          <Plus size={18} />
          Add Product
        </button>
      </div>

      {/* Search */}

      <div className="products-toolbar">
        <div className="search-box">
          <Search size={19} />

          <input
            type="text"
            placeholder="Search product or SKU..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchTerm("")}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <span className="product-count">
          {filteredProducts.length} products
        </span>
      </div>

      {/* Product Table */}

      <div className="products-table-container">
        {filteredProducts.length > 0 ? (
          <table className="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Tax</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-name-cell">
                      <div className="product-icon">
                        <Package size={18} />
                      </div>

                      <strong>{product.name}</strong>
                    </div>
                  </td>

                  <td>{product.sku}</td>

                  <td>{product.category}</td>

                  <td>₹{product.price.toFixed(2)}</td>

                  <td>{product.quantity}</td>

                  <td>
                    {product.taxEnabled ? (
                      <span className="tax-badge">GST {product.taxRate}%</span>
                    ) : (
                      <span className="no-tax-badge">No Tax</span>
                    )}
                  </td>

                  <td>
                    <div className="action-buttons">
                      <button
                        className="edit-btn"
                        onClick={() => handleEditProduct(product)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => setProductToDelete(product)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-table">
            <Package size={45} />

            <h3>No Products Found</h3>

            <p>
              {searchTerm
                ? `No product matches "${searchTerm}"`
                : "No products available"}
            </p>

            {searchTerm && (
              <button
                className="clear-search-btn-large"
                onClick={() => setSearchTerm("")}
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

     {/*  Add/Edit Modal */}

      {isModalOpen && (
        <div className="product-modal-overlay">
          <div className="product-modal">
            <div className="modal-header">
              <div>
                <h3>{editingProduct ? "Edit Product" : "Add Product"}</h3>

                <p>
                  {editingProduct
                    ? "Update product details"
                    : "Add a new restaurant product"}
                </p>
              </div>

              <button className="modal-close-btn" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <form className="product-form" onSubmit={handleSubmit}>
              {/* PRODUCT NAME */}

              <div className="form-group">
                <label>Product Name *</label>

                <input
                  type="text"
                  name="name"
                  placeholder="Enter product name"
                  value={formData.name}
                  onChange={handleChange}
                />

                {errors.name && (
                  <span className="error-message">{errors.name}</span>
                )}
              </div>

              {/* SKU */}

              <div className="form-group">
                <label>SKU *</label>

                <input
                  type="text"
                  name="sku"
                  placeholder="Example: FOOD-009"
                  value={formData.sku}
                  onChange={handleChange}
                />

                {errors.sku && (
                  <span className="error-message">{errors.sku}</span>
                )}
              </div>

              {/* CATEGORY */}

              <div className="form-group">
                <label>Category *</label>

                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                {errors.category && (
                  <span className="error-message">{errors.category}</span>
                )}
              </div>

              {/* PRICE + QUANTITY */}

              <div className="form-row">
                <div className="form-group">
                  <label>Price *</label>

                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={handleChange}
                  />

                  {errors.price && (
                    <span className="error-message">{errors.price}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>Stock Quantity *</label>

                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={handleChange}
                  />

                  {errors.quantity && (
                    <span className="error-message">{errors.quantity}</span>
                  )}
                </div>
              </div>

              {/* TAX */}

              <div className="tax-section">
                <div className="tax-toggle">
                  <div>
                    <strong>Enable GST</strong>

                    <p>Apply GST for this product</p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      name="taxEnabled"
                      checked={formData.taxEnabled}
                      onChange={handleChange}
                    />

                    <span className="slider" />
                  </label>
                </div>

                {formData.taxEnabled && (
                  <div className="form-group">
                    <label>GST Rate *</label>

                    <select
                      name="taxRate"
                      value={formData.taxRate}
                      onChange={handleChange}
                    >
                      <option value="">Select GST Rate</option>

                      {gstRates.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>

                    {errors.taxRate && (
                      <span className="error-message">{errors.taxRate}</span>
                    )}
                  </div>
                )}

                {formData.taxEnabled && formData.taxRate !== "" && (
                  <div className="gst-preview">
                    <span>CGST</span>

                    <strong>{Number(formData.taxRate) / 2}%</strong>

                    <span>SGST</span>

                    <strong>{Number(formData.taxRate) / 2}%</strong>
                  </div>
                )}
              </div>

              {/* BUTTONS */}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>

                <button type="submit" className="save-btn">
                  {editingProduct ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{/* Delete Modal */}

      {productToDelete && (
        <div className="product-modal-overlay">
          <div className="delete-modal">
            <div className="delete-icon">
              <Trash2 size={24} />
            </div>

            <h3>Delete Product?</h3>

            <p>
              Are you sure you want to delete{" "}
              <strong>{productToDelete.name}</strong>?
            </p>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setProductToDelete(null)}
              >
                Cancel
              </button>

              <button className="confirm-delete-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
