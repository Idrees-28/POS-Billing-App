/*
 * Products always come from Magento through the backend.
 * This file only re-exports the single products API so older imports keep working.
 */
export {
  getProducts,
  getCategories,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../api/productsApi";
