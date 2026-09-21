const STORAGE_KEY = "pos_customers";

const WALK_IN_CUSTOMER = {
  id: 1,
  name: "Walk-in Customer",
  phone: "0000000000",
  email: "",
  company: "",
  address: "",
};

export const getCustomers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    const customers = stored ? JSON.parse(stored) : [];

    // Keep Walk-in Customer permanently at the beginning.
    const otherCustomers = Array.isArray(customers)
      ? customers.filter(
          (customer) =>
            customer.id !== 1 &&
            customer.name !== "Walk-in Customer"
        )
      : [];

    const updatedCustomers = [
      WALK_IN_CUSTOMER,
      ...otherCustomers,
    ];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedCustomers)
    );

    return updatedCustomers;
  } catch (error) {
    console.error("Unable to load customers:", error);
    return [WALK_IN_CUSTOMER];
  }
};

export const saveCustomers = (customers) => {
  const otherCustomers = customers.filter(
    (customer) =>
      customer.id !== 1 &&
      customer.name !== "Walk-in Customer"
  );

  const updatedCustomers = [
    WALK_IN_CUSTOMER,
    ...otherCustomers,
  ];

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updatedCustomers)
  );

  window.dispatchEvent(new Event("customersUpdated"));
};

export const addCustomer = (customer) => {
  const customers = getCustomers();

  const newCustomer = {
    ...customer,
    id: Date.now(),
  };

  saveCustomers([...customers, newCustomer]);

  return newCustomer;
};

export const updateCustomer = (id, customerData) => {
  const customers = getCustomers();

  // Do not allow Walk-in Customer to be modified.
  if (Number(id) === 1) {
    return customers;
  }

  const updatedCustomers = customers.map((customer) =>
    customer.id === Number(id)
      ? { ...customer, ...customerData }
      : customer
  );

  saveCustomers(updatedCustomers);

  return updatedCustomers;
};

export const deleteCustomer = (id) => {
  const customers = getCustomers();

  // Do not allow Walk-in Customer to be deleted.
  if (Number(id) === 1) {
    return customers;
  }

  const updatedCustomers = customers.filter(
    (customer) => customer.id !== Number(id)
  );

  saveCustomers(updatedCustomers);

  return updatedCustomers;
};