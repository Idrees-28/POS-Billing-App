const STORAGE_KEY = "pos_products";

const defaultProducts = [
  {
    id: 1,
    name: "Chicken Biriyani",
    sku: "FOOD-001",
    category: "Main Course",
    price: 180,
    quantity: 25,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 2,
    name: "Chicken 65",
    sku: "FOOD-002",
    category: "Starters",
    price: 150,
    quantity: 30,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 3,
    name: "Mutton Biriyani",
    sku: "FOOD-003",
    category: "Main Course",
    price: 240,
    quantity: 15,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 4,
    name: "Veg Fried Rice",
    sku: "FOOD-004",
    category: "Main Course",
    price: 130,
    quantity: 20,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 5,
    name: "French Fries",
    sku: "SNACK-001",
    category: "Starters",
    price: 100,
    quantity: 40,
    taxEnabled: true,
    taxRate: 5,
  },
  {
    id: 6,
    name: "Fresh Lime Juice",
    sku: "DRINK-001",
    category: "Beverages",
    price: 60,
    quantity: 50,
    taxEnabled: false,
    taxRate: 0,
  },
  {
    id: 7,
    name: "Fresh Orange Juice",
    sku: "DRINK-002",
    category: "Beverages",
    price: 80,
    quantity: 35,
    taxEnabled: false,
    taxRate: 0,
  },
  {
    id: 8,
    name: "Mineral Water",
    sku: "DRINK-003",
    category: "Beverages",
    price: 20,
    quantity: 100,
    taxEnabled: false,
    taxRate: 0,
  },
];

export const getProducts = () => {
  const storedProducts = localStorage.getItem(STORAGE_KEY);

  if (!storedProducts) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(defaultProducts)
    );

    return defaultProducts;
  }

  try {
    return JSON.parse(storedProducts);
  } catch (error) {
    console.error("Error reading products:", error);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(defaultProducts)
    );

    return defaultProducts;
  }
};

export const saveProducts = (products) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(products)
  );

  window.dispatchEvent(new Event("productsUpdated"));
};

export const addProduct = (product) => {
  const products = getProducts();

  const newProduct = {
    ...product,
    id: Date.now(),
  };

  const updatedProducts = [
    ...products,
    newProduct,
  ];

  saveProducts(updatedProducts);

  return newProduct;
};

export const updateProduct = (id, updatedProduct) => {
  const products = getProducts();

  const updatedProducts = products.map((product) =>
    product.id === id
      ? {
          ...product,
          ...updatedProduct,
          id,
        }
      : product
  );

  saveProducts(updatedProducts);
};

export const deleteProduct = (id) => {
  const products = getProducts();

  const updatedProducts = products.filter(
    (product) => product.id !== id
  );

  saveProducts(updatedProducts);
};

export const resetProducts = () => {
  saveProducts(defaultProducts);
};