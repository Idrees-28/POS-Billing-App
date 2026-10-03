import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Package,
} from "lucide-react";

import {
  getProducts,
  getCategories,
  addProduct,
  updateProduct,
  deleteProduct,
  checkProductSku,
} from "../../api/productsApi";

import "./Products.css";

/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
  name: "",
  sku: "",
  price: "",
  quantity: 0,
  categoryId: "",
  taxEnabled: true,
  taxRate: 5,
};

/* =========================================================
   POS CATEGORIES
========================================================= */

const POS_CATEGORY_NAMES = [
  "Main Course",
  "Starters",
  "Beverages",
  "Desserts",
];

/* =========================================================
   COMPONENT
========================================================= */

const Products = () => {
  const [products, setProducts] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [
    showDeleteModal,
    setShowDeleteModal,
  ] = useState(false);

  const [
    editingProduct,
    setEditingProduct,
  ] = useState(null);

  const [
    productToDelete,
    setProductToDelete,
  ] = useState(null);

  const [form, setForm] =
    useState({
      ...EMPTY_FORM,
    });

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        productsData,
        categoriesData,
      ] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);

      console.log(
        "PRODUCTS FROM BACKEND:",
        productsData
      );

      console.log(
        "CATEGORIES FROM BACKEND:",
        categoriesData
      );

      setProducts(
        Array.isArray(
          productsData
        )
          ? productsData
          : []
      );

      const posCategories =
        (
          Array.isArray(
            categoriesData
          )
            ? categoriesData
            : []
        )
          .filter((category) =>
            POS_CATEGORY_NAMES.includes(
              category.name
            )
          )
          .sort(
            (a, b) =>
              POS_CATEGORY_NAMES.indexOf(
                a.name
              ) -
              POS_CATEGORY_NAMES.indexOf(
                b.name
              )
          );

      setCategories(
        posCategories
      );
    } catch (err) {
      console.error(
        "LOAD DATA ERROR:",
        err
      );

      setError(
        err.message ||
          "Failed to load products"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredProducts =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return products;
      }

      return products.filter(
        (product) =>
          String(
            product.name || ""
          )
            .toLowerCase()
            .includes(value) ||
          String(
            product.sku || ""
          )
            .toLowerCase()
            .includes(value) ||
          String(
            product.category || ""
          )
            .toLowerCase()
            .includes(value)
      );
    }, [
      products,
      search,
    ]);

  /* =======================================================
     ADD
  ======================================================= */

  const handleAddProduct =
    () => {
      setEditingProduct(null);

      setForm({
        ...EMPTY_FORM,
      });

      setError("");

      setShowModal(true);
    };

  /* =======================================================
     EDIT
  ======================================================= */

  const handleEditProduct =
    (product) => {
      console.log(
        "EDIT PRODUCT:",
        product
      );

      let categoryId =
        "";

      /* ---------------------------------------------------
         FIND CATEGORY BY ID
      --------------------------------------------------- */

      if (
        Array.isArray(
          product.categoryIds
        )
      ) {
        for (
          const id of
            product.categoryIds
        ) {
          const found =
            categories.find(
              (category) =>
                String(
                  category.id
                ) ===
                String(id)
            );

          if (found) {
            categoryId =
              String(
                found.id
              );

            break;
          }
        }
      }

      /* ---------------------------------------------------
         FALLBACK CATEGORY NAME
      --------------------------------------------------- */

      if (
        !categoryId &&
        product.category
      ) {
        const found =
          categories.find(
            (category) =>
              String(
                category.name
              )
                .trim()
                .toLowerCase() ===
              String(
                product.category
              )
                .trim()
                .toLowerCase()
          );

        if (found) {
          categoryId =
            String(
              found.id
            );
        }
      }

      /* ---------------------------------------------------
         TAX
      --------------------------------------------------- */

      const taxEnabled =
        product.taxEnabled !==
        false;

      const taxRate =
        product.taxRate !==
          undefined &&
        product.taxRate !==
          null
          ? Number(
              product.taxRate
            )
          : taxEnabled
          ? 5
          : 0;

      /* ---------------------------------------------------
         FORM
      --------------------------------------------------- */

      setEditingProduct(
        product
      );

      setForm({
        name:
          product.name ||
          "",

        sku:
          product.sku ||
          "",

        price:
          product.price ??
          "",

        quantity:
          product.quantity ??
          0,

        categoryId,

        taxEnabled,

        taxRate,
      });

      setError("");

      setShowModal(true);
    };

  /* =======================================================
     CLOSE
  ======================================================= */

  const handleCloseModal =
    () => {
      if (saving) {
        return;
      }

      setShowModal(false);

      setEditingProduct(
        null
      );

      setForm({
        ...EMPTY_FORM,
      });

      setError("");
    };

  /* =======================================================
     INPUT
  ======================================================= */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm(
      (previous) => ({
        ...previous,

        [name]:
          type ===
          "checkbox"
            ? checked
            : value,
      })
    );

    if (error) {
      setError("");
    }
  };

  /* =======================================================
     TAX
  ======================================================= */

  const handleTaxToggle =
    () => {
      setForm(
        (previous) => {
          const enabled =
            !previous.taxEnabled;

          return {
            ...previous,

            taxEnabled:
              enabled,

            taxRate:
              enabled
                ? Number(
                    previous.taxRate
                  ) > 0
                  ? previous.taxRate
                  : 5
                : 0,
          };
        }
      );
    };

  /* =======================================================
     VALIDATE
  ======================================================= */

  const validateForm =
    () => {
      if (
        !form.name.trim()
      ) {
        return "Product name is required";
      }

      if (
        !form.sku.trim()
      ) {
        return "SKU is required";
      }

      if (
        form.price === "" ||
        Number(form.price) <
          0
      ) {
        return "Enter a valid price";
      }

      if (
        form.quantity === "" ||
        Number(form.quantity) <
          0
      ) {
        return "Enter a valid quantity";
      }

      if (
        !form.categoryId
      ) {
        return "Please select a category";
      }

      if (
        form.taxEnabled &&
        (
          form.taxRate ===
            "" ||
          Number(
            form.taxRate
          ) < 0 ||
          Number(
            form.taxRate
          ) > 100
        )
      ) {
        return "Enter a valid tax rate";
      }

      return "";
    };

  /* =======================================================
     SAVE
  ======================================================= */

  const handleSaveProduct =
    async (event) => {
      event.preventDefault();

      const validationError =
        validateForm();

      if (
        validationError
      ) {
        setError(
          validationError
        );

        return;
      }

      try {
        setSaving(true);
        setError("");

        const cleanSku =
          form.sku
            .trim()
            .toUpperCase();

        /* -------------------------------------------------
           CHECK SKU FOR NEW PRODUCT
        ------------------------------------------------- */

        if (!editingProduct) {
          const result =
            await checkProductSku(
              cleanSku
            );

          if (result.exists) {
            setError(
              `SKU "${cleanSku}" already exists.`
            );

            setSaving(false);

            return;
          }
        }

        /* -------------------------------------------------
           CATEGORY
        ------------------------------------------------- */

        const category =
          categories.find(
            (item) =>
              String(
                item.id
              ) ===
              String(
                form.categoryId
              )
          );

        if (!category) {
          setError(
            "Selected category is invalid."
          );

          setSaving(false);

          return;
        }

        /* -------------------------------------------------
           FINAL VALUES
        ------------------------------------------------- */

        const payload = {
          name:
            form.name.trim(),

          sku: cleanSku,

          price:
            Number(form.price),

          quantity:
            Number(
              form.quantity
            ),

          categoryId:
            String(
              category.id
            ),

          categoryName:
            category.name,

          taxEnabled:
            Boolean(
              form.taxEnabled
            ),

          taxRate:
            form.taxEnabled
              ? Number(
                  form.taxRate
                )
              : 0,
        };

        console.log(
          "================================"
        );

        console.log(
          "SENDING PRODUCT PAYLOAD"
        );

        console.log(
          payload
        );

        console.log(
          "================================"
        );

        /* -------------------------------------------------
           UPDATE
        ------------------------------------------------- */

        if (editingProduct) {
          await updateProduct(
            editingProduct.sku,
            payload
          );
        }

        /* -------------------------------------------------
           CREATE
        ------------------------------------------------- */

        else {
          await addProduct(
            payload
          );
        }

        /* -------------------------------------------------
           RELOAD FROM MAGENTO
        ------------------------------------------------- */

        await loadData();

        setShowModal(
          false
        );

        setEditingProduct(
          null
        );

        setForm({
          ...EMPTY_FORM,
        });

        setError("");
      } catch (err) {
        console.error(
          "SAVE PRODUCT ERROR:",
          err
        );

        setError(
          err.message ||
            "Failed to save product"
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDeleteClick =
    (product) => {
      setProductToDelete(
        product
      );

      setError("");

      setShowDeleteModal(
        true
      );
    };

  const handleCancelDelete =
    () => {
      if (saving) {
        return;
      }

      setProductToDelete(
        null
      );

      setShowDeleteModal(
        false
      );
    };

  const handleConfirmDelete =
    async () => {
      if (
        !productToDelete
      ) {
        return;
      }

      try {
        setSaving(true);
        setError("");

        await deleteProduct(
          productToDelete.sku
        );

        await loadData();

        setProductToDelete(
          null
        );

        setShowDeleteModal(
          false
        );
      } catch (err) {
        console.error(
          "DELETE ERROR:",
          err
        );

        setError(
          err.message ||
            "Failed to delete product"
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     PRICE
  ======================================================= */

  const formatPrice =
    (price) =>
      `₹${Number(
        price || 0
      ).toFixed(2)}`;

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="products-page">

      {/* HEADER */}

      <div className="page-header">

        <div>
          <h2>
            Products
          </h2>

          <p>
            Manage your products
            and inventory
          </p>
        </div>

        <button
          type="button"
          className="add-btn"
          onClick={
            handleAddProduct
          }
        >
          <Plus size={18} />

          Add Product
        </button>

      </div>

      {/* ERROR */}

      {error &&
        !showModal && (
          <div
            style={{
              marginBottom:
                "16px",

              padding:
                "12px 14px",

              borderRadius:
                "8px",

              background:
                "#fef2f2",

              color:
                "#dc2626",
            }}
          >
            {error}
          </div>
        )}

      {/* TOOLBAR */}

      <div className="products-toolbar">

        <div className="search-box">

          <Search
            size={18}
          />

          <input
            type="text"
            placeholder="Search product or SKU..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() =>
                setSearch("")
              }
            >
              <X size={16} />
            </button>
          )}

        </div>

        <div className="product-count">

          {
            filteredProducts.length
          }{" "}

          {filteredProducts.length ===
          1
            ? "product"
            : "products"}

        </div>

      </div>

      {/* TABLE */}

      <div className="products-table-container">

        {loading ? (
          <div className="empty-table">

            <Package
              size={40}
            />

            <h3>
              Loading products...
            </h3>

            <p>
              Fetching products
              from Magento
            </p>

          </div>
        ) : filteredProducts.length ===
          0 ? (
          <div className="empty-table">

            <Package
              size={40}
            />

            <h3>
              No products found
            </h3>

            <p>
              {search
                ? "Try a different search"
                : "Add your first product"}
            </p>

          </div>
        ) : (
          <table className="products-table">

            <thead>

              <tr>

                <th>
                  Product
                </th>

                <th>
                  SKU
                </th>

                <th>
                  Category
                </th>

                <th>
                  Price
                </th>

                <th>
                  Stock
                </th>

                <th>
                  Tax
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredProducts.map(
                (product) => (
                  <tr
                    key={
                      product.id ||
                      product.sku
                    }
                  >

                    <td>

                      <div className="product-name-cell">

                        <div className="product-icon">

                          <Package
                            size={17}
                          />

                        </div>

                        <strong>
                          {
                            product.name
                          }
                        </strong>

                      </div>

                    </td>

                    <td>
                      {
                        product.sku
                      }
                    </td>

                    <td>
                      {
                        product.category ||
                        "Uncategorized"
                      }
                    </td>

                    <td>
                      {formatPrice(
                        product.price
                      )}
                    </td>

                    <td>
                      {Number(
                        product.quantity ??
                          0
                      )}
                    </td>

                    <td>

                      {product.taxEnabled ? (
                        <span className="tax-badge">

                          GST{" "}

                          {Number(
                            product.taxRate ??
                              0
                          )}

                          %

                        </span>
                      ) : (
                        <span className="no-tax-badge">
                          No Tax
                        </span>
                      )}

                    </td>

                    <td>

                      <div className="action-buttons">

                        <button
                          type="button"
                          className="edit-btn"
                          title="Edit product"
                          onClick={() =>
                            handleEditProduct(
                              product
                            )
                          }
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          title="Delete product"
                          onClick={() =>
                            handleDeleteClick(
                              product
                            )
                          }
                        >
                          <Trash2
                            size={16}
                          />
                        </button>

                      </div>

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>
        )}

      </div>

      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {showModal && (
        <div className="product-modal-overlay">

          <div className="product-modal">

            <div className="modal-header">

              <div>

                <h3>
                  {editingProduct
                    ? "Edit Product"
                    : "Add Product"}
                </h3>

                <p>
                  {editingProduct
                    ? "Update product details"
                    : "Add a new product"}
                </p>

              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={
                  handleCloseModal
                }
                disabled={saving}
              >
                <X size={18} />
              </button>

            </div>

            <form
              className="product-form"
              onSubmit={
                handleSaveProduct
              }
            >

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {/* NAME / SKU */}

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Product Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={
                      form.name
                    }
                    placeholder="Enter product name"
                    onChange={
                      handleChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    SKU
                  </label>

                  <input
                    type="text"
                    name="sku"
                    value={
                      form.sku
                    }
                    placeholder="Enter SKU"
                    disabled={
                      Boolean(
                        editingProduct
                      )
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

              </div>

              {/* PRICE / QUANTITY */}

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Price
                  </label>

                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    value={
                      form.price
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Quantity
                  </label>

                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    step="1"
                    value={
                      form.quantity
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

              </div>

              {/* CATEGORY */}

              <div className="form-group">

                <label>
                  Category
                </label>

                <select
                  name="categoryId"
                  value={
                    form.categoryId
                  }
                  onChange={
                    handleChange
                  }
                >

                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (
                      category
                    ) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {
                          category.name
                        }
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* TAX */}

              <div className="tax-section">

                <div className="tax-toggle">

                  <div>

                    <strong>
                      Enable GST
                    </strong>

                    <p>
                      Apply GST to this
                      product
                    </p>

                  </div>

                  <label className="switch">

                    <input
                      type="checkbox"
                      checked={
                        form.taxEnabled
                      }
                      onChange={
                        handleTaxToggle
                      }
                    />

                    <span className="slider" />

                  </label>

                </div>

                {form.taxEnabled && (
                  <>
                    <div
                      className="form-group"
                      style={{
                        marginTop:
                          "16px",
                      }}
                    >

                      <label>
                        Tax Rate (%)
                      </label>

                      <input
                        type="number"
                        name="taxRate"
                        min="0"
                        max="100"
                        step="0.01"
                        value={
                          form.taxRate
                        }
                        onChange={
                          handleChange
                        }
                      />

                    </div>

                    <div
                      className="gst-preview"
                      style={{
                        marginTop:
                          "12px",
                      }}
                    >

                      <span>
                        CGST
                      </span>

                      <strong>
                        {(
                          Number(
                            form.taxRate
                          ) / 2
                        ).toFixed(2)}
                        %
                      </strong>

                      <span>
                        SGST
                      </span>

                      <strong>
                        {(
                          Number(
                            form.taxRate
                          ) / 2
                        ).toFixed(2)}
                        %
                      </strong>

                    </div>
                  </>
                )}

              </div>

              {/* ACTIONS */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={
                    handleCloseModal
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                    ? "Update Product"
                    : "Save Product"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* =================================================
          DELETE
      ================================================= */}

      {showDeleteModal &&
        productToDelete && (
          <div className="product-modal-overlay">

            <div className="delete-modal">

              <div className="delete-icon">

                <Trash2
                  size={22}
                />

              </div>

              <h3>
                Delete Product?
              </h3>

              <p>

                Are you sure you want
                to delete{" "}

                <strong>
                  {
                    productToDelete.name
                  }
                </strong>
                ?

              </p>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={
                    handleCancelDelete
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="confirm-delete-btn"
                  onClick={
                    handleConfirmDelete
                  }
                  disabled={saving}
                >
                  {saving
                    ? "Deleting..."
                    : "Delete Product"}
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
};

export default Products;