const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const parseResponse = async (response, fallback) => {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error?.message || fallback
    );

    error.status = response.status;
    error.code = data?.code;
    error.data = data;

    throw error;
  }

  return data;
};

/* POS cart -> Magento order -> Magento invoice */
export const createOrder = async (order) => {
  const response = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });

  const data = await parseResponse(response, "Failed to create order");

  return data.invoice;
};

export const getInvoices = async () => {
  const response = await fetch(`${API_URL}/invoices`);

  const data = await parseResponse(response, "Failed to fetch invoices");

  return Array.isArray(data.items) ? data.items : [];
};