# Product Catalog Schema Analysis & Migration Guide

## 🔍 **CURRENT ISSUES IDENTIFIED**

### **1. Table Name Mismatch**
- **Backend Code** (`backend/product-catalog.ts`) uses: `public.catalog_products`, `public.catalog_categories`, `public.catalog_product_images`
- **Schema File** (`backend/utils/product-catalog-schema.sql`) creates: `public.products`, `public.categories`, `public.product_images`
- **Problem**: Tables don't match! Backend will fail when trying to query.

### **2. Migration Script Approach**
- **Migration Script** (`CATALOG_MIGRATION_SCRIPT.sql.md`) proposes:
  - Using existing `oms.products` and `oms.inventory` tables
  - Storing images/tags in JSONB columns instead of separate tables
  - This is **CORRECT** but requires significant backend code changes

---

## ✅ **CORRECT APPROACH FOR OMS SCHEMA**

The migration script in `CATALOG_MIGRATION_SCRIPT.sql.md` is **CORRECT** for using existing OMS tables. Here's why:

### **Advantages:**
1. ✅ **No new tables needed** - Uses existing `oms.products` and `oms.inventory`
2. ✅ **Single source of truth** - All product data in one place
3. ✅ **Simpler queries** - No complex joins needed
4. ✅ **S3 storage handled correctly** - `primary_image_s3_key` and `additional_images` JSONB store S3 keys

### **Required Columns for OMS Schema:**

#### **For `oms.products` table:**
```sql
-- Essential catalog columns
selling_price DECIMAL(12,2)
unit_of_measure VARCHAR(20) DEFAULT 'piece'
min_stock_level INTEGER DEFAULT 0
max_stock_level INTEGER
is_featured BOOLEAN DEFAULT false
is_active BOOLEAN DEFAULT true
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_by INTEGER

-- S3 Image Storage (CRITICAL for S3 functionality)
primary_image_url TEXT                    -- Full S3 URL
primary_image_s3_key TEXT                  -- S3 key for deletion
additional_images JSONB DEFAULT '[]'       -- Array of {url, s3_key, alt_text, display_order}

-- Tags and metadata (JSONB)
tags JSONB DEFAULT '[]'                    -- Array of tag strings
catalog_metadata JSONB DEFAULT '{}'        -- Any additional metadata
```

#### **For `oms.inventory` table:**
```sql
reserved_quantity INTEGER DEFAULT 0
warehouse_location VARCHAR(100)
updated_by INTEGER
```

### **S3 Image Storage Structure:**

**Primary Image:**
- `primary_image_url` - Full URL: `https://bucket-name.s3.region.amazonaws.com/products/123/image.jpg`
- `primary_image_s3_key` - Key for deletion: `products/123/uuid-image.jpg`

**Additional Images (JSONB array):**
```json
[
  {
    "url": "https://bucket-name.s3.region.amazonaws.com/products/123/image2.jpg",
    "s3_key": "products/123/uuid-image2.jpg",
    "alt_text": "Product side view",
    "display_order": 1,
    "uploaded_at": "2024-01-15T10:30:00Z"
  },
  {
    "url": "https://bucket-name.s3.region.amazonaws.com/products/123/image3.jpg",
    "s3_key": "products/123/uuid-image3.jpg",
    "alt_text": "Product detail",
    "display_order": 2,
    "uploaded_at": "2024-01-15T10:31:00Z"
  }
]
```

---

## 🔧 **REQUIRED BACKEND CODE CHANGES**

The migration script approach is correct, but you need to update `backend/product-catalog.ts`:

### **Current Issues in Backend Code:**

1. **Wrong table names** - Uses `public.catalog_*` instead of `oms.*`
2. **Separate image table** - Uses `catalog_product_images` instead of JSONB
3. **Separate tags table** - Uses `catalog_product_tags` instead of JSONB array
4. **Complex joins** - Multiple table joins that can be simplified

### **Key Changes Needed:**

#### **1. Image Upload Endpoint** (`POST /api/catalog/products/:id/images`)
**Current (WRONG):**
```typescript
// Inserts into separate table
INSERT INTO public.catalog_product_images (product_id, image_url, s3_key, ...)
```

**Should be (CORRECT):**
```typescript
// Updates JSONB column in oms.products
if (is_primary === 'true') {
  UPDATE oms.products 
  SET primary_image_url = $1, primary_image_s3_key = $2
  WHERE product_id = $3
} else {
  UPDATE oms.products 
  SET additional_images = additional_images || $1::jsonb
  WHERE product_id = $2
}
```

#### **2. Image Delete Endpoint** (`DELETE /api/catalog/products/:productId/images/:imageId`)
**Current (WRONG):**
```typescript
// Deletes from separate table
DELETE FROM public.catalog_product_images WHERE image_id = $1
```

**Should be (CORRECT):**
```typescript
// Updates JSONB array to remove image
UPDATE oms.products 
SET additional_images = additional_images - index
WHERE product_id = $1
```

#### **3. Get Products Endpoint** (`GET /api/catalog/products`)
**Current (WRONG):**
```typescript
// Complex join with separate image table
SELECT ...,
  (SELECT json_agg(...) FROM public.catalog_product_images ...) as images
FROM public.catalog_products
```

**Should be (CORRECT):**
```typescript
// Simple query with JSONB columns
SELECT 
  p.*,
  p.primary_image_url,
  p.additional_images,
  p.tags,
  i.quantity_available,
  i.cost_price
FROM oms.products p
INNER JOIN oms.inventory i ON p.product_id = i.product_id
WHERE p.merchant_id = $1 AND p.is_active = true
```

---

## 📋 **MIGRATION CHECKLIST**

### **Step 1: Run Database Migration**
```bash
# Execute the migration script
psql -U postgres -d ecomittra -f CATALOG_MIGRATION_SCRIPT.sql.md
```

This will:
- ✅ Add required columns to `oms.products`
- ✅ Add required columns to `oms.inventory`
- ✅ Create `oms.catalog_products` view
- ✅ Create indexes for performance

### **Step 2: Update Backend Code**

**Files to update:**
1. `backend/product-catalog.ts` - All endpoints need changes
2. Update all SQL queries to use `oms.products` instead of `public.catalog_*`
3. Update image handling to use JSONB instead of separate table
4. Update tags handling to use JSONB array instead of separate table

### **Step 3: Verify S3 Integration**

The S3 integration (`backend/utils/s3-config.ts`) is **CORRECT** and doesn't need changes:
- ✅ `uploadImageToS3()` - Returns `imageUrl` and `s3Key` ✅
- ✅ `deleteImageFromS3()` - Uses `s3Key` for deletion ✅

**What changes:**
- Where you **store** the S3 URL and key (JSONB vs separate table)
- How you **retrieve** images (JSONB query vs JOIN)

---

## 🎯 **FINAL VERDICT**

### **Is the Migration Script Correct?**
✅ **YES** - The approach in `CATALOG_MIGRATION_SCRIPT.sql.md` is correct:
- Uses existing `oms.products` and `oms.inventory` ✅
- Stores S3 keys properly in JSONB ✅
- Simpler schema ✅
- No redundant tables ✅

### **What's Wrong?**
❌ **Backend code** (`backend/product-catalog.ts`) doesn't match:
- Uses wrong table names (`public.catalog_*` instead of `oms.*`)
- Uses separate image table instead of JSONB
- Uses separate tags table instead of JSONB array

### **What Needs to be Done?**
1. ✅ Run the migration script (adds columns to `oms.products`)
2. ❌ Update `backend/product-catalog.ts` to use new schema
3. ❌ Test image upload/delete with JSONB
4. ❌ Update frontend if needed (see `CATALOG_MIGRATION_GUIDE.md`)

---

## 📝 **SUMMARY**

**For S3/Product Catalog in OMS Schema, you need:**

### **Tables:**
- ✅ `oms.products` (existing) - with added catalog columns
- ✅ `oms.inventory` (existing) - with added reserved_quantity column
- ✅ **NO separate image table** - images stored in JSONB
- ✅ **NO separate tags table** - tags stored in JSONB array

### **Critical S3 Columns:**
- ✅ `oms.products.primary_image_url` - S3 URL
- ✅ `oms.products.primary_image_s3_key` - S3 key for deletion
- ✅ `oms.products.additional_images` - JSONB array with `url` and `s3_key` for each image

### **The migration script is correct!** 
You just need to update the backend code to use the new schema structure.

