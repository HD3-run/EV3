# Product Catalog Schema Relationships Explained

## 📊 **Current OMS Table Structure**

### **1. `oms.products` Table (Already Exists)**
```sql
-- Existing columns:
product_id          SERIAL PRIMARY KEY
merchant_id         INTEGER          -- Already exists! ✅
product_name        VARCHAR(255)
sku                 VARCHAR(100)
description         TEXT
category            VARCHAR(100)
brand               VARCHAR(100)
hsn_code            VARCHAR(20)
gst_rate            DECIMAL(5,2)
created_at          TIMESTAMP

-- NEW columns added by migration:
selling_price       DECIMAL(12,2)    -- NEW for catalog
unit_of_measure     VARCHAR(20)      -- NEW for catalog
min_stock_level     INTEGER          -- NEW for catalog
max_stock_level     INTEGER          -- NEW for catalog
is_featured         BOOLEAN          -- NEW for catalog
is_active           BOOLEAN          -- NEW for catalog
primary_image_url   TEXT             -- NEW for S3
primary_image_s3_key TEXT            -- NEW for S3
additional_images   JSONB            -- NEW for S3
tags                JSONB            -- NEW for catalog
catalog_metadata    JSONB            -- NEW for catalog
updated_at          TIMESTAMP        -- NEW
updated_by          INTEGER          -- NEW
```

### **2. `oms.inventory` Table (Already Exists)**
```sql
-- Existing columns:
inventory_id        SERIAL PRIMARY KEY  -- This is in inventory table, NOT products!
merchant_id         INTEGER              -- Already exists! ✅
product_id          INTEGER              -- Foreign key to oms.products.product_id
quantity_available  INTEGER
reorder_level       INTEGER
cost_price          DECIMAL(12,2)

-- NEW columns added by migration:
reserved_quantity   INTEGER              -- NEW for catalog
warehouse_location  VARCHAR(100)         -- NEW for catalog
updated_by          INTEGER              -- NEW
```

---

## 🔗 **Key Relationships**

### **Relationship Structure:**
```
oms.products (1) ──(product_id)──> (many) oms.inventory
     │
     └── merchant_id (for multi-tenancy)
```

### **Important Points:**

1. **`merchant_id` is already in `oms.products`** ✅
   - No need to add it - it's already there!
   - Every product belongs to a merchant
   - The migration script doesn't touch this

2. **`inventory_id` is in `oms.inventory`, NOT in `oms.products`** ✅
   - `inventory_id` is the PRIMARY KEY of `oms.inventory` table
   - You link products to inventory using `product_id`
   - Relationship: `oms.products.product_id = oms.inventory.product_id`

3. **Catalog only shows products that exist in inventory** ✅
   - The view uses `INNER JOIN`:
   ```sql
   FROM oms.products p
   INNER JOIN oms.inventory i ON p.product_id = i.product_id
   ```
   - This means: **Only products with inventory records will appear in catalog**
   - Products without inventory = NOT in catalog ✅

---

## 📋 **How It Works**

### **Scenario: Creating a Product Catalog Entry**

**Step 1: Product must exist in `oms.products`**
```sql
-- Product already exists (created through inventory or orders)
INSERT INTO oms.products (merchant_id, product_name, sku, ...)
VALUES (1, 'iPhone 15', 'IPH15-001', ...);
-- Returns: product_id = 123
```

**Step 2: Product must have inventory record**
```sql
-- Inventory record must exist
INSERT INTO oms.inventory (merchant_id, product_id, quantity_available, ...)
VALUES (1, 123, 50, ...);
-- Returns: inventory_id = 456
```

**Step 3: Add catalog data (images, tags, etc.)**
```sql
-- Now you can add catalog-specific data
UPDATE oms.products 
SET 
  selling_price = 999.99,
  primary_image_url = 'https://s3.../iphone15.jpg',
  primary_image_s3_key = 'products/123/uuid.jpg',
  tags = '["new-arrival", "bestseller"]'::jsonb,
  is_featured = true,
  is_active = true
WHERE product_id = 123;
```

**Step 4: Query catalog**
```sql
-- This query only returns products that have inventory!
SELECT * FROM oms.catalog_products 
WHERE merchant_id = 1 AND is_active = true;
-- Returns: product_id 123 with all catalog data + inventory data
```

---

## 🎯 **Answers to Your Questions**

### **Q: "We will only make a product catalog for products that exist in inventory?"**
**A: YES! ✅**
- The `oms.catalog_products` view uses `INNER JOIN`
- Only products with matching inventory records appear
- If a product has no inventory → Not in catalog

### **Q: "Products table takes merchant_id from existing tables?"**
**A: YES! ✅**
- `merchant_id` already exists in `oms.products`
- No changes needed
- The migration script doesn't add this - it's already there

### **Q: "Inventory id from existing tables?"**
**A: PARTIALLY CORRECT**
- `inventory_id` exists in `oms.inventory` table (not in products)
- You don't need `inventory_id` in products table
- You link them using `product_id`:
  - `oms.products.product_id` → `oms.inventory.product_id`

---

## 📊 **Data Flow Example**

```
┌─────────────────────────────────────────────────────────┐
│ 1. Product Created in oms.products                       │
│    - product_id: 123                                     │
│    - merchant_id: 1                                      │
│    - product_name: "iPhone 15"                          │
└─────────────────────────────────────────────────────────┘
                    │
                    │ product_id = 123
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Inventory Created in oms.inventory                    │
│    - inventory_id: 456                                   │
│    - merchant_id: 1                                      │
│    - product_id: 123 (links to products)                │
│    - quantity_available: 50                             │
│    - cost_price: 800.00                                  │
└─────────────────────────────────────────────────────────┘
                    │
                    │ Both records exist
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Catalog Data Added to oms.products                   │
│    - selling_price: 999.99                              │
│    - primary_image_url: "https://s3.../img.jpg"         │
│    - primary_image_s3_key: "products/123/uuid.jpg"     │
│    - tags: ["new-arrival", "bestseller"]                │
│    - is_featured: true                                  │
│    - is_active: true                                    │
└─────────────────────────────────────────────────────────┘
                    │
                    │ Query catalog
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Catalog View (oms.catalog_products)                  │
│    Returns:                                              │
│    - All product data (from oms.products)               │
│    - All inventory data (from oms.inventory)           │
│    - All catalog data (selling_price, images, tags)    │
│    - Only products that have inventory! ✅              │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ **Summary**

1. ✅ **`merchant_id`**: Already in `oms.products` - no changes needed
2. ✅ **`inventory_id`**: In `oms.inventory` table - you link via `product_id`
3. ✅ **Catalog only shows products with inventory**: Because of INNER JOIN
4. ✅ **Migration script adds catalog columns**: To existing `oms.products` table
5. ✅ **No new tables needed**: Everything uses existing structure

The migration script is **correct** - it just adds catalog-specific columns to your existing tables!

