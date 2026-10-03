/*
 * Customers are stored in Magento (through the backend).
 * The Walk-in customer is virtual (id 0) and is never sent to Magento.
 */

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const WALK_IN_ID = 0;

export const WALK_IN_CUSTOMER = {
  id: WALK_IN_ID,
  name: "Walk-in Customer",
  phone: "0000000000",
  email: "",
  company: "",
  address: "",
};

const request = async (path, options, fallback) => {
  const response = await fetch(`${API_URL}${path}`, options);

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error?.message || fallback);
  }

  return data;
};

const notify = () => window.dispatchEvent(new Event("customersUpdated"));

const jsonOptions = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getCustomers = async () => {
  const data = await request("/customers", undefined, "Failed to fetch customers");

  return [WALK_IN_CUSTOMER, ...(Array.isArray(data.items) ? data.items : [])];
};

export const addCustomer = async (customer) => {
  const data = await request(
    "/customers",
    jsonOptions("POST", customer),
    "Failed to create customer"
  );

  notify();

  return data.customer;
};

export const updateCustomer = async (id, customer) => {
  if (Number(id) === WALK_IN_ID) return null;

  const data = await request(
    `/customers/${Number(id)}`,
    jsonOptions("PUT", customer),
    "Failed to update customer"
  );

  notify();

  return data.customer;
};

export const deleteCustomer = async (id) => {
  if (Number(id) === WALK_IN_ID) return;

  await request(
    `/customers/${Number(id)}`,
    { method: "DELETE" },
    "Failed to delete customer"
  );

  notify();
};
