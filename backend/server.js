const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();



const env = (key, fallback = "") =>
  process.env[key] !== undefined && process.env[key] !== ""
    ? process.env[key]
    : fallback;

const PORT = Number(env("PORT", 5000));

const MAGENTO_BASE_URL = env("MAGENTO_BASE_URL").replace(/\/+$/, "");
const MAGENTO_REST_BASE_URL = env("MAGENTO_REST_BASE_URL").replace(/\/+$/, "");

const REST_BASE = MAGENTO_REST_BASE_URL || `${MAGENTO_BASE_URL}/rest/V1`;


const REST_ALL_BASE = REST_BASE.replace(
  /\/rest(\/[A-Za-z0-9_-]+)?\/V1$/,
  "/rest/all/V1"
);

const CONSUMER_KEY = env("MAGENTO_CONSUMER_KEY");
const CONSUMER_SECRET = env("MAGENTO_CONSUMER_SECRET");
const ACCESS_TOKEN = env("MAGENTO_ACCESS_TOKEN");
const ACCESS_TOKEN_SECRET = env("MAGENTO_ACCESS_TOKEN_SECRET");
const ADMIN_TOKEN = env("MAGENTO_ADMIN_TOKEN"); // optional alternative to OAuth

const ATTRIBUTE_SET_ID = Number(env("MAGENTO_ATTRIBUTE_SET_ID", 4));
const WEBSITE_ID = Number(env("MAGENTO_WEBSITE_ID", 1));
const CUSTOMER_GROUP_ID = Number(env("MAGENTO_CUSTOMER_GROUP_ID", 1));
const SOURCE_CODE = env("MAGENTO_SOURCE_CODE", "default");

const SHIPPING_CARRIER = env("MAGENTO_SHIPPING_CARRIER", "freeshipping");
const SHIPPING_METHOD = env("MAGENTO_SHIPPING_METHOD", "freeshipping");
const PAYMENT_METHOD = env("MAGENTO_PAYMENT_METHOD", "checkmo");

const DEFAULT_COUNTRY_ID = env("DEFAULT_COUNTRY_ID", "IN");
const DEFAULT_REGION = env("DEFAULT_REGION", "");
const DEFAULT_CITY = env("DEFAULT_CITY", "NA");
const DEFAULT_POSTCODE = env("DEFAULT_POSTCODE", "000000");
const PLACEHOLDER_EMAIL_DOMAIN = env(
  "PLACEHOLDER_EMAIL_DOMAIN",
  "pos-customers.example.com"
);

const AUTO_SETUP = env("AUTO_SETUP", "true") !== "false";

const POS_CATEGORY_NAMES = ["Main Course", "Starters", "Beverages", "Desserts"];

const TAX_ENABLED_ATTRIBUTE = "pos_tax_enabled";
const TAX_RATE_ATTRIBUTE = "pos_tax_rate";

if (!MAGENTO_BASE_URL && !MAGENTO_REST_BASE_URL) {
  console.warn("WARNING: MAGENTO_BASE_URL is not configured in backend/.env");
}

if (!ADMIN_TOKEN && !(CONSUMER_KEY && CONSUMER_SECRET && ACCESS_TOKEN && ACCESS_TOKEN_SECRET)) {
  console.warn(
    "WARNING: no Magento credentials configured (OAuth keys or MAGENTO_ADMIN_TOKEN)."
  );
}

app.use(
  cors({
    origin: env("CORS_ORIGIN") ? env("CORS_ORIGIN").split(",") : true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());


class ApiError extends Error {
  constructor(status, message, code = "API_ERROR", details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* Magento error bodies use "%1", "%2" placeholders + parameters */
function magentoMessage(data) {
  if (!data) return "";

  if (typeof data === "string") return data;

  if (Array.isArray(data.errors) && data.errors.length) {
    return data.errors.map((e) => magentoMessage(e)).join("; ");
  }

  let message = data.message || "";

  if (message && data.parameters) {
    const params = Array.isArray(data.parameters)
      ? data.parameters
      : Object.values(data.parameters);

    params.forEach((value, index) => {
      message = message.split(`%${index + 1}`).join(String(value));
    });
    // named placeholders: %fieldName
    if (!Array.isArray(data.parameters)) {
      Object.entries(data.parameters).forEach(([key, value]) => {
        message = message.split(`%${key}`).join(String(value));
      });
    }
  }

  if (Array.isArray(data.errors)) return message;

  return message;
}

/* =========================================================
   OAUTH 1.0a  (HMAC-SHA256)  or  Bearer admin token
========================================================= */

function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildAuthHeader(method, url, queryString) {
  if (ADMIN_TOKEN) {
    return `Bearer ${ADMIN_TOKEN}`;
  }

  const queryParams = {};

  if (queryString) {
    for (const [k, v] of new URLSearchParams(queryString).entries()) {
      queryParams[k] = v;
    }
  }

  const oauth = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000),
    oauth_token: ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const all = { ...queryParams, ...oauth };

  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    rfc3986(url.replace(/\/+$/, "")),
    rfc3986(paramString),
  ].join("&");

  const key = `${rfc3986(CONSUMER_SECRET)}&${rfc3986(ACCESS_TOKEN_SECRET)}`;

  oauth.oauth_signature = crypto
    .createHmac("sha256", key)
    .update(baseString)
    .digest("base64");

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k])}"`)
      .join(", ")
  );
}

/* =========================================================
   MAGENTO CLIENT
   mg()        -> { ok, status, data }   (never throws on HTTP errors)
   mgOrThrow() -> data                   (throws ApiError with Magento text)
========================================================= */

async function mg(endpoint, { method = "GET", body, scope = "default" } = {}) {
  method = method.toUpperCase();

  const base = scope === "all" ? REST_ALL_BASE : REST_BASE;

  const q = endpoint.indexOf("?");
  const pathPart = q >= 0 ? endpoint.slice(0, q) : endpoint;
  const queryString = q >= 0 ? endpoint.slice(q + 1) : "";

  const url = `${base}${pathPart}`;
  const finalUrl = queryString ? `${url}?${queryString}` : url;

  const headers = {
    Accept: "application/json",
    Authorization: buildAuthHeader(method, url, queryString),
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";

  console.log(`MAGENTO ${method} ${finalUrl}`);

  let response;

  try {
    response = await fetch(finalUrl, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new ApiError(
      502,
      `Cannot reach Magento (${error.cause?.code || error.message})`,
      "MAGENTO_UNREACHABLE"
    );
  }

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    console.error(
      `MAGENTO ERROR ${response.status} ${method} ${pathPart}:`,
      magentoMessage(data) || data
    );
  }

  return { ok: response.ok, status: response.status, data };
}

function toApiError(result, friendly) {
  const detail = magentoMessage(result.data) || `HTTP ${result.status}`;

  let status = 502;
  let code = "MAGENTO_ERROR";

  if (result.status === 404) {
    status = 404;
    code = "MAGENTO_NOT_FOUND";
  } else if (result.status === 400 || result.status === 409) {
    status = 400;
    code = "MAGENTO_REJECTED";
  } else if (result.status === 401 || result.status === 403) {
    code = "MAGENTO_AUTH_ERROR";
  }

  return new ApiError(status, `${friendly}: ${detail}`, code, result.data);
}

async function mgOrThrow(endpoint, options, friendly) {
  const result = await mg(endpoint, options);

  if (!result.ok) throw toApiError(result, friendly);

  return result.data;
}

/* =========================================================
   CATEGORIES
========================================================= */

async function getCategoryTree() {
  return mgOrThrow("/categories", {}, "Failed to fetch categories");
}

function flattenCategories(category, result = []) {
  if (!category) return result;

  if (category.id !== undefined) result.push(category);

  if (Array.isArray(category.children_data)) {
    category.children_data.forEach((child) => flattenCategories(child, result));
  }

  return result;
}

function findCategoryByName(tree, name) {
  return (
    flattenCategories(tree).find(
      (c) =>
        String(c.name).trim().toLowerCase() === String(name).trim().toLowerCase()
    ) || null
  );
}

async function ensurePosCategories() {
  const tree = await getCategoryTree();

  const defaultCategory = findCategoryByName(tree, "Default Category");

  if (!defaultCategory) {
    throw new ApiError(400, "Default Category not found in Magento", "NO_DEFAULT_CATEGORY");
  }

  const created = [];
  const alreadyExists = [];

  for (let i = 0; i < POS_CATEGORY_NAMES.length; i++) {
    const name = POS_CATEGORY_NAMES[i];
    const existing = findCategoryByName(tree, name);

    if (existing) {
      alreadyExists.push({ id: existing.id, name: existing.name });
      continue;
    }

    const data = await mgOrThrow(
      "/categories",
      {
        method: "POST",
        body: {
          category: {
            parent_id: Number(defaultCategory.id),
            name,
            is_active: true,
            position: i + 1,
            include_in_menu: true,
          },
        },
      },
      `Failed to create category "${name}"`
    );

    created.push({ id: data.id, name: data.name });
  }

  return { created, alreadyExists };
}

/* =========================================================
   TAX ATTRIBUTES  (pos_tax_enabled / pos_tax_rate)
   Created in Magento automatically if they do not exist.
========================================================= */

let taxAttributesReady = false;

async function findAttributeGroupId() {
  const filter =
    "searchCriteria[filterGroups][0][filters][0][field]=attribute_set_id" +
    `&searchCriteria[filterGroups][0][filters][0][value]=${ATTRIBUTE_SET_ID}` +
    "&searchCriteria[filterGroups][0][filters][0][condition_type]=eq";

  const result = await mg(`/products/attribute-sets/groups/list?${filter}`);

  const groups = result.ok && Array.isArray(result.data.items) ? result.data.items : [];

  const preferred =
    groups.find((g) => /product details/i.test(g.attribute_group_name)) ||
    groups.find((g) => /general/i.test(g.attribute_group_name)) ||
    groups[0];

  return preferred ? Number(preferred.attribute_group_id) : 7;
}

async function ensureAttribute(code, label) {
  const existing = await mg(`/products/attributes/${code}`);

  if (!existing.ok) {
    if (existing.status !== 404) {
      throw toApiError(existing, `Cannot check attribute ${code}`);
    }

    await mgOrThrow(
      "/products/attributes",
      {
        method: "POST",
        body: {
          attribute: {
            attribute_code: code,
            frontend_input: "text",
            default_frontend_label: label,
            is_required: false,
            is_unique: false,
            is_user_defined: true,
            scope: "global",
            backend_type: "varchar",
          },
        },
      },
      `Failed to create Magento attribute ${code}`
    );

    console.log(`Created Magento product attribute: ${code}`);
  }

  const setAttributes = await mg(`/products/attribute-sets/${ATTRIBUTE_SET_ID}/attributes`);

  const inSet =
    setAttributes.ok &&
    Array.isArray(setAttributes.data) &&
    setAttributes.data.some((a) => a.attribute_code === code);

  if (!inSet) {
    const groupId = await findAttributeGroupId();

    await mgOrThrow(
      "/products/attribute-sets/attributes",
      {
        method: "POST",
        body: {
          attributeSetId: ATTRIBUTE_SET_ID,
          attributeGroupId: groupId,
          attributeCode: code,
          sortOrder: 100,
        },
      },
      `Failed to add ${code} to attribute set ${ATTRIBUTE_SET_ID}`
    );

    console.log(`Added ${code} to attribute set ${ATTRIBUTE_SET_ID}`);
  }
}

async function ensureTaxAttributes() {
  if (taxAttributesReady) return;

  try {
    await ensureAttribute(TAX_ENABLED_ATTRIBUTE, "POS Tax Enabled");
    await ensureAttribute(TAX_RATE_ATTRIBUTE, "POS Tax Rate");
    taxAttributesReady = true;
  } catch (error) {
    throw new ApiError(
      error.status || 502,
      `GST attributes are not available in Magento. ${error.message}. ` +
        `Create text attributes "${TAX_ENABLED_ATTRIBUTE}" and "${TAX_RATE_ATTRIBUTE}" ` +
        `in Magento admin (Stores > Attributes > Product) and add them to the attribute set.`,
      "TAX_ATTRIBUTES_MISSING",
      error.details
    );
  }
}

/* =========================================================
   PRODUCT HELPERS
========================================================= */

function getCustomAttribute(product, code) {
  return (product?.custom_attributes || []).find((a) => a.attribute_code === code)
    ?.value;
}

/*
 * Returns exactly what is stored in Magento.
 * Products that never had GST saved are reported as GST disabled / 0%
 * (nothing is invented).
 */
function getTaxInformation(product) {
  const enabledValue = getCustomAttribute(product, TAX_ENABLED_ATTRIBUTE);
  const rateValue = getCustomAttribute(product, TAX_RATE_ATTRIBUTE);

  const taxEnabled =
    enabledValue === true || enabledValue === "1" || enabledValue === 1;

  let taxRate = Number(rateValue);

  if (rateValue === undefined || rateValue === null || rateValue === "" || Number.isNaN(taxRate)) {
    taxRate = 0;
  }

  return { taxEnabled, taxRate: taxEnabled ? taxRate : 0 };
}

function getCategoryIdsFromProduct(product) {
  const links = product?.extension_attributes?.category_links;

  if (Array.isArray(links)) {
    return links.map((l) => String(l.category_id)).filter(Boolean);
  }

  const value = getCustomAttribute(product, "category_ids");

  if (Array.isArray(value)) return value.map(String);

  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }

  return [];
}

function getStockQty(product) {
  const qty = product?.extension_attributes?.stock_item?.qty;

  return qty === undefined || qty === null ? null : Number(qty);
}

async function getStockItem(sku) {
  const result = await mg(`/stockItems/${encodeURIComponent(sku)}`);

  return result.ok ? result.data : null;
}

/* Some Magento installs (MSI) omit stock_item in the product list */
async function hydrateStock(products) {
  const missing = products.filter((p) => getStockQty(p) === null);
  const size = 8;

  for (let i = 0; i < missing.length; i += size) {
    await Promise.all(
      missing.slice(i, i + size).map(async (product) => {
        const stock = await getStockItem(product.sku);

        if (stock) {
          product.extension_attributes = product.extension_attributes || {};
          product.extension_attributes.stock_item = stock;
        }
      })
    );
  }
}

function formatProduct(product, categories) {
  const categoryIds = getCategoryIdsFromProduct(product);

  const posMatch = categoryIds
    .map((id) => categories.find((c) => String(c.id) === String(id)))
    .find((c) => c && POS_CATEGORY_NAMES.includes(c.name));

  const anyMatch = categoryIds
    .map((id) => categories.find((c) => String(c.id) === String(id)))
    .find((c) => c && c.name !== "Default Category" && c.name !== "Root Catalog");

  const category = posMatch || anyMatch;

  const tax = getTaxInformation(product);
  const quantity = getStockQty(product) ?? 0;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    price: Number(product.price || 0),
    quantity,
    stock: quantity,
    categoryIds,
    categoryId: category ? String(category.id) : "",
    categoryName: category?.name || "Uncategorized",
    category: category?.name || "Uncategorized",
    taxEnabled: tax.taxEnabled,
    taxRate: tax.taxRate,
  };
}

function buildTaxAttributes(taxEnabled, taxRate) {
  return [
    { attribute_code: TAX_ENABLED_ATTRIBUTE, value: taxEnabled ? "1" : "0" },
    { attribute_code: TAX_RATE_ATTRIBUTE, value: String(taxRate) },
  ];
}

function parseTax(taxEnabled, taxRate, fallback) {
  const enabled = taxEnabled !== undefined ? Boolean(taxEnabled) : fallback.taxEnabled;

  if (!enabled) return { taxEnabled: false, taxRate: 0 };

  const rate = Number(taxRate !== undefined && taxRate !== "" ? taxRate : fallback.taxRate);

  if (Number.isNaN(rate) || rate < 0 || rate > 100) {
    throw new ApiError(400, "GST rate must be between 0 and 100", "INVALID_TAX_RATE");
  }

  return { taxEnabled: true, taxRate: rate };
}

/* =========================================================
   INVENTORY
   1. legacy stock item  PUT /products/:sku/stockItems/:itemId
   2. MSI source item    POST /inventory/source-items
========================================================= */

async function setStock(sku, quantity) {
  const qty = Number(quantity);

  if (Number.isNaN(qty) || qty < 0) {
    throw new ApiError(400, "Quantity must be 0 or more", "INVALID_QUANTITY");
  }

  const errors = [];
  let legacyOk = false;
  let msiOk = false;

  /* legacy */
  const current = await getStockItem(sku);
  const itemId = current?.item_id ?? 1;

  const legacy = await mg(
    `/products/${encodeURIComponent(sku)}/stockItems/${itemId}`,
    {
      method: "PUT",
      body: { stockItem: { qty, is_in_stock: qty > 0, manage_stock: true } },
    }
  );

  if (legacy.ok) legacyOk = true;
  else errors.push(`stockItems: ${magentoMessage(legacy.data) || legacy.status}`);

  /* MSI (skipped silently when the module is not installed) */
  const msi = await mg("/inventory/source-items", {
    method: "POST",
    body: {
      sourceItems: [
        { sku, source_code: SOURCE_CODE, quantity: qty, status: qty > 0 ? 1 : 0 },
      ],
    },
  });

  if (msi.ok) msiOk = true;
  else if (msi.status !== 404) {
    errors.push(`source-items: ${magentoMessage(msi.data) || msi.status}`);
  }

  if (!legacyOk && !msiOk) {
    throw new ApiError(
      502,
      `Failed to update stock: ${errors.join(" | ")}`,
      "MAGENTO_STOCK_ERROR"
    );
  }
}

/* =========================================================
   CATEGORY LINKS
========================================================= */

function computeCategoryLinks(existingIds, newCategoryId, posCategoryIds) {
  const keep = existingIds.filter((id) => !posCategoryIds.includes(String(id)));

  return [...keep, String(newCategoryId)].map((id) => ({
    category_id: String(id),
    position: 0,
  }));
}

/* Fallback if the product save did not change the links */
async function forceCategory(sku, existingIds, newId, posCategoryIds) {
  for (const oldId of existingIds) {
    if (String(oldId) === String(newId) || !posCategoryIds.includes(String(oldId))) continue;

    await mg(`/categories/${encodeURIComponent(oldId)}/products/${encodeURIComponent(sku)}`, {
      method: "DELETE",
    });
  }

  await mgOrThrow(
    `/categories/${encodeURIComponent(newId)}/products`,
    {
      method: "PUT",
      body: {
        productLink: {
          sku,
          category_id: String(newId),
          position: 0,
          extension_attributes: {},
        },
      },
    },
    "Failed to update product category"
  );
}

/*
 * A product can only be added to a Magento cart when it is
 * enabled, assigned to the website, and in stock.
 * Products created through the REST API are often NOT assigned to a
 * website, which gives: "Product that you are trying to add is not available."
 * This repairs that automatically.
 */
async function ensureSellable(raw, quantity) {
  const sku = raw.sku;

  const websiteIds = (raw?.extension_attributes?.website_ids || []).map(Number);

  if (!websiteIds.includes(WEBSITE_ID)) {
    const link = { productWebsiteLink: { sku, website_id: WEBSITE_ID } };
    const path = `/products/${encodeURIComponent(sku)}/websites`;

    let r = await mg(path, { method: "PUT", body: link, scope: "all" });
    if (!r.ok) r = await mg(path, { method: "POST", body: link, scope: "all" });

    if (!r.ok) {
      throw toApiError(r, `Failed to assign ${sku} to website ${WEBSITE_ID}`);
    }

    console.log(`Assigned ${sku} to website ${WEBSITE_ID}`);
  }

  if (Number(raw.status) !== 1) {
    await mgOrThrow(
      `/products/${encodeURIComponent(sku)}`,
      { method: "PUT", body: { product: { sku, status: 1 } }, scope: "all" },
      `Failed to enable ${sku}`
    );

    console.log(`Enabled ${sku}`);
  }

  const stock = await getStockItem(sku);

  if (stock && (!stock.is_in_stock || stock.manage_stock === false) && Number(stock.qty) >= quantity) {
    await setStock(sku, Number(stock.qty));
  }
}

/* Loads one product from Magento in the POS format */
async function loadFormattedProduct(sku) {
  const product = await mgOrThrow(
    `/products/${encodeURIComponent(sku)}`,
    { scope: "all" },
    "Failed to read product"
  );

  await hydrateStock([product]);

  const stock = await getStockItem(sku);
  if (stock) {
    product.extension_attributes = product.extension_attributes || {};
    product.extension_attributes.stock_item = stock;
  }

  const categories = flattenCategories(await getCategoryTree());

  return { raw: product, formatted: formatProduct(product, categories), categories };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "POS backend is running" });
});

/* =========================================================
   SETUP  (categories + GST attributes) — safe to call repeatedly
========================================================= */

app.post(
  "/api/setup",
  asyncHandler(async (req, res) => {
    const categories = await ensurePosCategories();
    await ensureTaxAttributes();

    res.json({ success: true, message: "POS categories and GST attributes are ready", categories });
  })
);

/* =========================================================
   CATEGORIES
========================================================= */

app.get(
  "/api/categories",
  asyncHandler(async (req, res) => {
    const categories = flattenCategories(await getCategoryTree());

    res.json({
      items: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parent_id: c.parent_id ?? null,
      })),
    });
  })
);

app.post(
  "/api/categories/setup",
  asyncHandler(async (req, res) => {
    const result = await ensurePosCategories();

    res.json({ success: true, message: "POS categories are ready", ...result });
  })
);

/* =========================================================
   PRODUCTS — LIST
========================================================= */

app.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    const data = await mgOrThrow(
      "/products?searchCriteria[pageSize]=1000",
      { scope: "all" },
      "Failed to fetch products"
    );

    const products = Array.isArray(data.items) ? data.items : [];

    await hydrateStock(products);

    const categories = flattenCategories(await getCategoryTree());

    const items = products.map((p) => formatProduct(p, categories));

    res.json({ items, total_count: data.total_count || items.length });
  })
);

/* =========================================================
   PRODUCTS — CHECK SKU
========================================================= */

app.get(
  "/api/products/check-sku/:sku",
  asyncHandler(async (req, res) => {
    const sku = String(req.params.sku || "").trim().toUpperCase();

    if (!sku) return res.status(400).json({ exists: false, message: "SKU is required" });

    const result = await mg(`/products/${encodeURIComponent(sku)}`, { scope: "all" });

    if (result.ok) {
      return res.json({
        exists: true,
        product: { id: result.data.id, sku: result.data.sku, name: result.data.name },
      });
    }

    if (result.status === 404) return res.json({ exists: false });

    throw toApiError(result, "Failed to check SKU");
  })
);

/* =========================================================
   PRODUCTS — CREATE
========================================================= */

app.post(
  "/api/products",
  asyncHandler(async (req, res) => {
    const { name, sku, price, quantity, categoryId, taxEnabled, taxRate } = req.body;

    if (!name || !String(name).trim()) throw new ApiError(400, "Product name is required", "VALIDATION");
    if (!sku || !String(sku).trim()) throw new ApiError(400, "SKU is required", "VALIDATION");
    if (price === undefined || price === null || price === "" || Number(price) < 0 || Number.isNaN(Number(price))) {
      throw new ApiError(400, "A valid price is required", "VALIDATION");
    }
    if (quantity === undefined || quantity === null || quantity === "" || Number(quantity) < 0 || Number.isNaN(Number(quantity))) {
      throw new ApiError(400, "A valid quantity is required", "VALIDATION");
    }
    if (!categoryId) throw new ApiError(400, "Category is required", "VALIDATION");

    const cleanSku = String(sku).trim().toUpperCase();
    const qty = Number(quantity);
    const tax = parseTax(taxEnabled, taxRate, { taxEnabled: false, taxRate: 0 });

    await ensureTaxAttributes();

    /* duplicate SKU */
    const dup = await mg(`/products/${encodeURIComponent(cleanSku)}`, { scope: "all" });

    if (dup.ok) {
      return res.status(409).json({
        success: false,
        message: `SKU "${cleanSku}" already exists.`,
        code: "DUPLICATE_SKU",
        error: {
          type: "DUPLICATE_SKU",
          product: { id: dup.data.id, name: dup.data.name, sku: dup.data.sku },
        },
      });
    }

    if (dup.status !== 404) throw toApiError(dup, "Unable to verify SKU");

    const payload = {
      product: {
        sku: cleanSku,
        name: String(name).trim(),
        price: Number(price),
        status: 1,
        visibility: 4,
        type_id: "simple",
        attribute_set_id: ATTRIBUTE_SET_ID,
        extension_attributes: {
          category_links: [{ position: 0, category_id: String(categoryId) }],
          website_ids: [WEBSITE_ID],
        },
        custom_attributes: buildTaxAttributes(tax.taxEnabled, tax.taxRate),
      },
    };

    await mgOrThrow(
      "/products",
      { method: "POST", body: payload, scope: "all" },
      "Failed to create product"
    );

    /* stock must succeed, otherwise roll the product back */
    try {
      await setStock(cleanSku, qty);
    } catch (error) {
      await mg(`/products/${encodeURIComponent(cleanSku)}`, { method: "DELETE", scope: "all" });
      throw error;
    }

    const { formatted } = await loadFormattedProduct(cleanSku);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: formatted,
    });
  })
);

/* =========================================================
   PRODUCTS — UPDATE
========================================================= */

app.put(
  "/api/products/:sku",
  asyncHandler(async (req, res) => {
    const sku = String(req.params.sku || "").trim();

    if (!sku) throw new ApiError(400, "SKU is required", "VALIDATION");

    const { name, price, quantity, categoryId, taxEnabled, taxRate } = req.body;

    console.log("\n==========================================");
    console.log("API UPDATE PRODUCT", sku);
    console.log("REQUEST BODY:", JSON.stringify(req.body));

    if (!categoryId) throw new ApiError(400, "Category is required", "VALIDATION");

    if (price !== undefined && price !== "" && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      throw new ApiError(400, "Price must be a valid number", "VALIDATION");
    }

    if (quantity !== undefined && quantity !== "" && (Number.isNaN(Number(quantity)) || Number(quantity) < 0)) {
      throw new ApiError(400, "Quantity must be a valid number", "VALIDATION");
    }

    await ensureTaxAttributes();

    /* current product */
    const existingResult = await mg(`/products/${encodeURIComponent(sku)}`, { scope: "all" });

    if (!existingResult.ok) throw toApiError(existingResult, "Product not found");

    const existing = existingResult.data;
    const existingTax = getTaxInformation(existing);
    const tax = parseTax(taxEnabled, taxRate, existingTax);

    const categoryTree = await getCategoryTree();
    const categories = flattenCategories(categoryTree);

    const posCategoryIds = categories
      .filter((c) => POS_CATEGORY_NAMES.includes(c.name))
      .map((c) => String(c.id));

    const existingIds = getCategoryIdsFromProduct(existing);
    const newCategoryId = String(categoryId);

    if (!categories.some((c) => String(c.id) === newCategoryId)) {
      throw new ApiError(400, "Selected category does not exist in Magento", "INVALID_CATEGORY");
    }

    /* 1. product data + category links + GST */
    const payload = {
      product: {
        sku: existing.sku,
        name: name !== undefined && String(name).trim() ? String(name).trim() : existing.name,
        price:
          price !== undefined && price !== "" ? Number(price) : Number(existing.price || 0),
        extension_attributes: {
          category_links: computeCategoryLinks(existingIds, newCategoryId, posCategoryIds),
        },
        custom_attributes: buildTaxAttributes(tax.taxEnabled, tax.taxRate),
      },
    };

    console.log("PRODUCT UPDATE PAYLOAD:", JSON.stringify(payload));

    await mgOrThrow(
      `/products/${encodeURIComponent(sku)}`,
      { method: "PUT", body: payload, scope: "all" },
      "Failed to update product"
    );

    await ensureSellable(existing, 0);

    /* 2. stock */
    const currentStock = await getStockItem(sku);
    const finalQty =
      quantity !== undefined && quantity !== ""
        ? Number(quantity)
        : Number(currentStock?.qty ?? getStockQty(existing) ?? 0);

    await setStock(sku, finalQty);

    /* 3. verify category, repair if Magento ignored the links */
    let verify = await loadFormattedProduct(sku);

    if (String(verify.formatted.categoryId) !== newCategoryId) {
      console.log("Category links not applied by product save — using category API");
      await forceCategory(sku, existingIds, newCategoryId, posCategoryIds);
      verify = await loadFormattedProduct(sku);
    }

    /* 4. never report success unless Magento really holds the values */
    const mismatches = [];
    const f = verify.formatted;

    if (String(f.categoryId) !== newCategoryId) mismatches.push(`category (expected ${newCategoryId}, got ${f.categoryId || "none"})`);
    if (Number(f.quantity) !== finalQty) mismatches.push(`quantity (expected ${finalQty}, got ${f.quantity})`);
    if (f.taxEnabled !== tax.taxEnabled) mismatches.push(`GST enabled (expected ${tax.taxEnabled}, got ${f.taxEnabled})`);
    if (Number(f.taxRate) !== Number(tax.taxRate)) mismatches.push(`GST rate (expected ${tax.taxRate}, got ${f.taxRate})`);

    if (mismatches.length) {
      throw new ApiError(
        502,
        `Magento accepted the request but did not keep: ${mismatches.join(", ")}`,
        "MAGENTO_NOT_PERSISTED"
      );
    }

    console.log("PRODUCT UPDATE COMPLETE:", f);
    console.log("==========================================\n");

    res.json({ success: true, message: "Product updated successfully", product: f });
  })
);

/* =========================================================
   PRODUCTS — DELETE
========================================================= */

app.delete(
  "/api/products/:sku",
  asyncHandler(async (req, res) => {
    const sku = String(req.params.sku || "").trim();

    if (!sku) throw new ApiError(400, "SKU is required", "VALIDATION");

    await mgOrThrow(
      `/products/${encodeURIComponent(sku)}`,
      { method: "DELETE", scope: "all" },
      "Failed to delete product"
    );

    res.json({ success: true, message: "Product deleted successfully" });
  })
);

/* =========================================================
   CUSTOMERS
   name    -> firstname / lastname
   phone   -> default address telephone
   company -> default address company
   address -> default address street
========================================================= */

let regionCache = null;

async function getDefaultRegion() {
  if (regionCache) return regionCache;

  const result = await mg(`/directory/countries/${encodeURIComponent(DEFAULT_COUNTRY_ID)}`);

  const regions =
    result.ok && Array.isArray(result.data.available_regions)
      ? result.data.available_regions
      : [];

  if (!regions.length) {
    regionCache = {};
    return regionCache;
  }

  const chosen =
    regions.find((r) => DEFAULT_REGION && r.name.toLowerCase() === DEFAULT_REGION.toLowerCase()) ||
    regions[0];

  regionCache = {
    region_id: Number(chosen.id),
    region: chosen.name,
    region_code: chosen.code,
  };

  return regionCache;
}

const isPlaceholderEmail = (email) =>
  String(email || "").toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`.toLowerCase());

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);

  return { firstname: parts[0] || "-", lastname: parts.slice(1).join(" ") || "-" };
}

function mapCustomer(c) {
  const address = (c.addresses || [])[0] || {};

  const street = Array.isArray(address.street) ? address.street.join(", ") : "";

  return {
    id: c.id,
    name: [c.firstname, c.lastname === "-" ? "" : c.lastname].filter(Boolean).join(" ").trim(),
    phone: address.telephone || "",
    email: isPlaceholderEmail(c.email) ? "" : c.email || "",
    company: address.company || "",
    address: street === "NA" ? "" : street,
    createdAt: c.created_at || null,
  };
}

async function buildCustomerAddress(input, names) {
  const region = await getDefaultRegion();

  return {
    firstname: names.firstname,
    lastname: names.lastname,
    telephone: String(input.phone || "").trim(),
    company: String(input.company || "").trim(),
    street: [String(input.address || "").trim() || "NA"],
    city: DEFAULT_CITY,
    postcode: DEFAULT_POSTCODE,
    country_id: DEFAULT_COUNTRY_ID,
    /* Customer addresses need region as a NESTED object
       (flat "region_code" gives: "RegionCode" is not supported) */
    ...(region.region_id
      ? {
          region: {
            region: region.region,
            region_code: region.region_code,
            region_id: region.region_id,
          },
          region_id: region.region_id,
        }
      : {}),
    default_billing: true,
    default_shipping: true,
  };
}

function customerEmail(input) {
  const email = String(input.email || "").trim();

  if (email) return email;

  const phone = String(input.phone || "").replace(/\D/g, "");

  return `${phone || Date.now()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function validateCustomer(input) {
  if (!input.name || !String(input.name).trim()) {
    throw new ApiError(400, "Customer name is required", "VALIDATION");
  }

  if (!/^[0-9]{10}$/.test(String(input.phone || "").trim())) {
    throw new ApiError(400, "Enter a valid 10-digit phone number", "VALIDATION");
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email).trim())) {
    throw new ApiError(400, "Enter a valid email address", "VALIDATION");
  }
}

app.get(
  "/api/customers",
  asyncHandler(async (req, res) => {
    const data = await mgOrThrow(
      "/customers/search?searchCriteria[pageSize]=1000",
      {},
      "Failed to fetch customers"
    );

    const items = (data.items || []).map(mapCustomer);

    res.json({ items, total_count: data.total_count ?? items.length });
  })
);

app.post(
  "/api/customers",
  asyncHandler(async (req, res) => {
    validateCustomer(req.body);

    const names = splitName(req.body.name);
    const address = await buildCustomerAddress(req.body, names);

    const created = await mgOrThrow(
      "/customers",
      {
        method: "POST",
        body: {
          customer: {
            email: customerEmail(req.body),
            firstname: names.firstname,
            lastname: names.lastname,
            website_id: WEBSITE_ID,
            group_id: CUSTOMER_GROUP_ID,
            addresses: [address],
          },
        },
      },
      "Failed to create customer"
    );

    res.status(201).json({ success: true, customer: mapCustomer(created) });
  })
);

app.put(
  "/api/customers/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (!id) throw new ApiError(400, "Invalid customer id", "VALIDATION");

    validateCustomer(req.body);

    const existing = await mgOrThrow(`/customers/${id}`, {}, "Customer not found");

    const names = splitName(req.body.name);
    const newAddress = await buildCustomerAddress(req.body, names);
    const oldAddress = (existing.addresses || [])[0];

    const address = oldAddress
      ? { ...oldAddress, ...newAddress, id: oldAddress.id, customer_id: id }
      : newAddress;

    const updated = await mgOrThrow(
      `/customers/${id}`,
      {
        method: "PUT",
        body: {
          customer: {
            id,
            email: customerEmail(req.body),
            firstname: names.firstname,
            lastname: names.lastname,
            website_id: existing.website_id ?? WEBSITE_ID,
            group_id: existing.group_id ?? CUSTOMER_GROUP_ID,
            addresses: [address],
          },
        },
      },
      "Failed to update customer"
    );

    res.json({ success: true, customer: mapCustomer(updated) });
  })
);

app.delete(
  "/api/customers/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (!id) throw new ApiError(400, "Invalid customer id", "VALIDATION");

    await mgOrThrow(`/customers/${id}`, { method: "DELETE" }, "Failed to delete customer");

    res.json({ success: true, message: "Customer deleted successfully" });
  })
);

/* =========================================================
   INVOICE LEDGER
   Magento cannot hold POS-specific CGST/SGST split, discount
   and payment/change details, so each completed sale is stored
   here (server-side, not in the browser) and linked to the
   Magento order id + Magento invoice id.
========================================================= */

const DATA_DIR = path.join(__dirname, "data");
const LEDGER_FILE = path.join(DATA_DIR, "invoices.json");

function readLedger() {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return [];

    const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read invoice ledger:", error.message);
    return [];
  }
}

function writeLedger(invoices) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const tmp = `${LEDGER_FILE}.tmp`;

  fs.writeFileSync(tmp, JSON.stringify(invoices, null, 2));
  fs.renameSync(tmp, LEDGER_FILE);
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* =========================================================
   ORDERS  (POS cart -> Magento order -> Magento invoice)
========================================================= */

async function buildOrderAddress(customer, region) {
  return {
    firstname: customer.firstname,
    lastname: customer.lastname,
    email: customer.email,
    telephone: customer.phone || "0000000000",
    company: customer.company || "",
    street: [customer.street || "NA"],
    city: DEFAULT_CITY,
    postcode: DEFAULT_POSTCODE,
    country_id: DEFAULT_COUNTRY_ID,
    ...region,
  };
}

app.post(
  "/api/orders",
  asyncHandler(async (req, res) => {
    const {
      customerId,
      items,
      discount,
      taxEnabled,
      paymentMethod,
      amountReceived,
      invoiceId,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "Cart is empty", "VALIDATION");
    }

    const payMethod = ["Cash", "Card", "UPI"].includes(paymentMethod) ? paymentMethod : "Cash";

    /* ---- 1. price every line from Magento (client prices are never trusted) ---- */
    const lines = [];

    for (const item of items) {
      const sku = String(item.sku || "").trim();
      const qty = Number(item.quantity);

      if (!sku || !Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new ApiError(400, `Invalid quantity for ${sku || "an item"}`, "VALIDATION");
      }

      const { raw, formatted } = await loadFormattedProduct(sku);

      if (formatted.quantity < qty) {
        throw new ApiError(
          400,
          `Only ${formatted.quantity} of "${raw.name}" in stock`,
          "INSUFFICIENT_STOCK"
        );
      }

      await ensureSellable(raw, qty);

      lines.push({
        stockBefore: Number(formatted.quantity),
        id: raw.id,
        name: raw.name,
        sku: raw.sku,
        price: Number(raw.price || 0),
        quantity: qty,
        taxEnabled: Boolean(taxEnabled !== false && formatted.taxEnabled),
        taxRate: taxEnabled !== false && formatted.taxEnabled ? formatted.taxRate : 0,
      });
    }

    /* ---- 2. totals (same rules the POS screen uses) ---- */
    const subtotal = round2(lines.reduce((t, l) => t + l.price * l.quantity, 0));
    const discountValue = round2(Math.min(subtotal, Math.max(0, Number(discount) || 0)));
    const ratio = subtotal > 0 ? discountValue / subtotal : 0;

    let cgst = 0;
    let sgst = 0;

    lines.forEach((line) => {
      line.lineSubtotal = round2(line.price * line.quantity);

      if (line.taxEnabled) {
        const taxable = line.price * line.quantity * (1 - ratio);
        cgst += (taxable * (line.taxRate / 2)) / 100;
        sgst += (taxable * (line.taxRate / 2)) / 100;
      }
    });

    cgst = round2(cgst);
    sgst = round2(sgst);

    const tax = round2(cgst + sgst);
    const total = round2(subtotal - discountValue + tax);

    const received = payMethod === "Cash" ? Number(amountReceived) || 0 : total;

    if (payMethod === "Cash" && received + 0.001 < total) {
      throw new ApiError(400, "Received amount is less than the bill total", "VALIDATION");
    }

    /* ---- 3. customer ---- */
    const isWalkIn = !customerId || Number(customerId) === 0;
    const region = await getDefaultRegion();

    let customerRecord = {
      id: 0,
      name: "Walk-in Customer",
      phone: "0000000000",
      email: "",
      company: "",
      address: "",
    };

    let orderCustomer = {
      firstname: "Walk-in",
      lastname: "Customer",
      email: `walkin@${PLACEHOLDER_EMAIL_DOMAIN}`,
      phone: "0000000000",
      company: "",
      street: "NA",
    };

    if (!isWalkIn) {
      const magentoCustomer = await mgOrThrow(
        `/customers/${Number(customerId)}`,
        {},
        "Customer not found"
      );

      customerRecord = mapCustomer(magentoCustomer);

      const a = (magentoCustomer.addresses || [])[0] || {};

      orderCustomer = {
        firstname: magentoCustomer.firstname,
        lastname: magentoCustomer.lastname,
        email: magentoCustomer.email,
        phone: a.telephone || customerRecord.phone,
        company: a.company || "",
        street: Array.isArray(a.street) && a.street[0] ? a.street[0] : "NA",
      };
    }

    /* ---- 4. Magento cart ---- */
    let cartBase;
    let cartId;

    if (isWalkIn) {
      cartId = await mgOrThrow("/guest-carts", { method: "POST", body: {} }, "Failed to create cart");
      cartBase = `/guest-carts/${cartId}`;
    } else {
      cartId = await mgOrThrow(
        `/customers/${Number(customerId)}/carts`,
        { method: "POST", body: {} },
        "Failed to create customer cart"
      );
      cartBase = `/carts/${cartId}`;
    }

    for (const line of lines) {
      await mgOrThrow(
        `${cartBase}/items`,
        {
          method: "POST",
          body: { cartItem: { sku: line.sku, qty: line.quantity, quote_id: String(cartId) } },
        },
        `Failed to add ${line.sku} to Magento cart (product must be enabled, on website ${WEBSITE_ID} and in stock; if it was just fixed, run: bin/magento indexer:reindex && bin/magento cache:flush)`
      );
    }

    const address = await buildOrderAddress(orderCustomer, region);

    await mgOrThrow(
      `${cartBase}/shipping-information`,
      {
        method: "POST",
        body: {
          addressInformation: {
            shipping_address: address,
            billing_address: address,
            shipping_carrier_code: SHIPPING_CARRIER,
            shipping_method_code: SHIPPING_METHOD,
          },
        },
      },
      `Failed to set shipping (${SHIPPING_CARRIER}_${SHIPPING_METHOD} must be enabled in Magento)`
    );

    /* ---- 5. Magento order ---- */
    const magentoOrderId = await mgOrThrow(
      `${cartBase}/order`,
      { method: "PUT", body: { paymentMethod: { method: PAYMENT_METHOD } } },
      `Failed to place Magento order (payment method "${PAYMENT_METHOD}" must be enabled)`
    );

    const order = await mgOrThrow(`/orders/${magentoOrderId}`, {}, "Failed to read Magento order");

    /* ---- 6. Magento invoice ---- */
    const invoiceResult = await mg(`/order/${magentoOrderId}/invoice`, {
      method: "POST",
      body: { capture: true, notify: false },
    });

    if (!invoiceResult.ok) {
      throw new ApiError(
        502,
        `Magento order ${order.increment_id} was created but the invoice failed: ${magentoMessage(invoiceResult.data)}`,
        "MAGENTO_INVOICE_ERROR",
        { magentoOrderId, magentoOrderIncrementId: order.increment_id }
      );
    }

    const magentoInvoiceId = invoiceResult.data;

    /* ---- 6b. Magento shipment ----
       With Magento's inventory (MSI) an order only RESERVES stock; the real
       quantity is deducted when the order is shipped. A POS sale is handed over
       immediately, so ship it now. */
    let shipmentOk = false;

    const shipItems = (order.items || [])
      .filter((i) => !i.parent_item_id)
      .map((i) => ({ order_item_id: i.item_id, qty: Number(i.qty_ordered) }));

    if (shipItems.length) {
      const ship = await mg(`/order/${magentoOrderId}/ship`, {
        method: "POST",
        body: { items: shipItems, notify: false, appendComment: false },
      });

      shipmentOk = ship.ok;

      if (!ship.ok) {
        console.error("Shipment failed (stock not deducted):", magentoMessage(ship.data));
      }
    }

    /* make sure the quantity Magento reports is stock-before minus sold */
    if (shipmentOk) {
      for (const line of lines) {
        try {
          const expected = Math.max(0, line.stockBefore - line.quantity);
          const current = await getStockItem(line.sku);

          if (!current || Number(current.qty) !== expected) {
            console.log(`Syncing stock for ${line.sku}: ${current?.qty} -> ${expected}`);
            await setStock(line.sku, expected);
          }
        } catch (error) {
          console.error(`Stock sync failed for ${line.sku}:`, error.message);
        }
      }
    }

    /* ---- 7. ledger ---- */
    const ledger = readLedger();

    let finalInvoiceId = String(invoiceId || "").trim() || `INV-${Date.now()}`;

    if (ledger.some((inv) => inv.id === finalInvoiceId)) finalInvoiceId = `${finalInvoiceId}-${Date.now()}`;

    const invoice = {
      id: finalInvoiceId,
      createdAt: new Date().toISOString(),
      customer: customerRecord,
      items: lines.map(({ stockBefore, ...line }) => line),
      subtotal,
      discount: discountValue,
      cgst,
      sgst,
      tax,
      total,
      paymentMethod: payMethod,
      amountReceived: round2(received),
      change: payMethod === "Cash" ? round2(Math.max(0, received - total)) : 0,
      status: "Paid",
      magentoOrderId: Number(magentoOrderId),
      magentoOrderNumber: order.increment_id,
      magentoInvoiceId: String(magentoInvoiceId),
      shipped: shipmentOk,
    };

    writeLedger([invoice, ...ledger]);

    /* record POS figures on the Magento order (non-fatal) */
    mg(`/orders/${magentoOrderId}/comments`, {
      method: "POST",
      body: {
        statusHistory: {
          comment:
            `POS invoice ${invoice.id} | ${payMethod} | subtotal ${subtotal} | ` +
            `discount ${discountValue} | CGST ${cgst} | SGST ${sgst} | total ${total}`,
          is_customer_notified: 0,
          is_visible_on_front: 0,
          parent_id: Number(magentoOrderId),
          status: order.status || "processing",
        },
      },
    }).catch(() => {});

    res.status(201).json({ success: true, message: "Order and invoice created", invoice });
  })
);

/* =========================================================
   INVOICES
========================================================= */

app.get("/api/invoices", (req, res) => {
  const items = readLedger().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  res.json({ items, total_count: items.length });
});

app.get("/api/invoices/:id", (req, res) => {
  const invoice = readLedger().find((inv) => inv.id === req.params.id);

  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  res.json({ invoice });
});

/* =========================================================
   DEBUG — why can't a product be sold?
   GET /api/debug/product/FOOD-148
   Shows the product exactly as the Magento cart sees it.
   Disable with ENABLE_DEBUG=false in backend/.env
========================================================= */

app.get(
  "/api/debug/product/:sku",
  asyncHandler(async (req, res) => {
    if (env("ENABLE_DEBUG", "true") === "false") {
      throw new ApiError(404, "Not found", "ROUTE_NOT_FOUND");
    }

    const sku = encodeURIComponent(String(req.params.sku).trim());

    const summary = (r) => ({ ok: r.ok, status: r.status, error: r.ok ? undefined : magentoMessage(r.data) });

    const storeView = await mg(`/products/${sku}`);
    const admin = await mg(`/products/${sku}`, { scope: "all" });
    const legacy = await mg(`/stockItems/${sku}`);
    const salable = await mg(`/inventory/get-product-salable-quantity/${sku}/1`);
    const sources = await mg(
      "/inventory/source-items?searchCriteria[filter_groups][0][filters][0][field]=sku" +
        `&searchCriteria[filter_groups][0][filters][0][value]=${sku}` +
        "&searchCriteria[filter_groups][0][filters][0][condition_type]=eq"
    );

    const view = (r) =>
      r.ok
        ? {
            status: r.data.status,
            visibility: r.data.visibility,
            type_id: r.data.type_id,
            website_ids: r.data.extension_attributes?.website_ids,
          }
        : summary(r);

    res.json({
      "1_defaultStoreView (what the cart uses)": view(storeView),
      "2_adminScope": view(admin),
      "3_legacyStock": legacy.ok
        ? { qty: legacy.data.qty, is_in_stock: legacy.data.is_in_stock, manage_stock: legacy.data.manage_stock }
        : summary(legacy),
      "4_msiSalableQty (stock 1)": salable.ok ? salable.data : summary(salable),
      "5_msiSourceItems": sources.ok ? sources.data.items : summary(sources),
      hint:
        "Needs: status=1, visibility 2/3/4, website_ids contains 1, is_in_stock=true, salable qty > 0. " +
        "If legacy qty is > 0 but msiSalableQty is 0 or missing, reindex (bin/magento indexer:reindex).",
    });
  })
);

/* =========================================================
   404 + GLOBAL ERROR
========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;

  if (status >= 500) console.error("REQUEST ERROR:", error);

  res.status(status).json({
    message: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
    details: error.details,
  });
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, () => {
  console.log("==========================================");
  console.log(`POS Backend running on http://localhost:${PORT}`);
  console.log(`Magento REST: ${REST_BASE}`);
  console.log("==========================================");

  if (AUTO_SETUP && (MAGENTO_BASE_URL || MAGENTO_REST_BASE_URL)) {
    ensurePosCategories()
      .then(() => ensureTaxAttributes())
      .then(() => console.log("Magento setup OK (categories + GST attributes)"))
      .catch((error) => console.error("Magento setup skipped:", error.message));
  }
});