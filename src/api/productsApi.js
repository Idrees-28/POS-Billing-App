const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* =========================================================
   RESPONSE HELPER
========================================================= */

const parseResponse = async (response) => {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error?.message ||
        "Request failed"
    );

    error.status = response.status;
    error.code = data?.code || data?.error?.type;
    error.data = data;

    throw error;
  }

  return data;
};

/* =========================================================
   GET PRODUCTS
========================================================= */

export const getProducts = async () => {
  const response = await fetch(`${API_URL}/products`);

  const data = await parseResponse(response);

  return data.items || [];
};

/* =========================================================
   GET CATEGORIES
========================================================= */

export const getCategories = async () => {
  const response = await fetch(`${API_URL}/categories`);

  const data = await parseResponse(response);

  return data.items || [];
};

/* =========================================================
   CHECK SKU
========================================================= */

export const checkProductSku = async (sku) => {
  const cleanSku = String(sku || "").trim().toUpperCase();

  if (!cleanSku) {
    return { exists: false };
  }

  const response = await fetch(
    `${API_URL}/products/check-sku/${encodeURIComponent(cleanSku)}`
  );

  return parseResponse(response);
};

/* =========================================================
   ADD PRODUCT
========================================================= */

export const addProduct = async (product) => {
  const response = await fetch(`${API_URL}/products`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    body: JSON.stringify(product),
  });

  return parseResponse(response);
};

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export const updateProduct = async (sku, product) => {
  const cleanSku = String(sku || "").trim();

  if (!cleanSku) {
    throw new Error("Product SKU is required");
  }

  const response = await fetch(
    `${API_URL}/products/${encodeURIComponent(cleanSku)}`,
    {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(product),
    }
  );

  return parseResponse(response);
};

/* =========================================================
   DELETE PRODUCT
========================================================= */

export const deleteProduct = async (sku) => {
  const cleanSku = String(sku || "").trim();

  if (!cleanSku) {
    throw new Error("Product SKU is required");
  }

  const response = await fetch(
    `${API_URL}/products/${encodeURIComponent(cleanSku)}`,
    {
      method: "DELETE",

      headers: {
        Accept: "application/json",
      },
    }
  );

  return parseResponse(response);
};