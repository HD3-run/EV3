-- Product Catalog Tables in Public Schema
-- This is for testing purposes before moving to oms schema

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id INTEGER REFERENCES public.categories(category_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES public.categories(category_id) ON DELETE SET NULL,
    brand VARCHAR(100),
    base_price DECIMAL(12, 2) NOT NULL,
    selling_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2),
    tax_rate DECIMAL(5, 2) DEFAULT 18.00, -- GST rate in India
    hsn_code VARCHAR(20), -- HSN code for GST in India
    unit_of_measure VARCHAR(20) DEFAULT 'piece', -- piece, kg, liter, etc.
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    reorder_level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

-- Product Images table (stores S3 URLs)
CREATE TABLE IF NOT EXISTS public.product_images (
    image_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- S3 URL
    s3_key TEXT NOT NULL, -- S3 object key for deletion
    is_primary BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    alt_text VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INTEGER
);

-- Product Variants table (for size, color, etc.)
CREATE TABLE IF NOT EXISTS public.product_variants (
    variant_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL, -- e.g., "Red - Large", "500ml"
    sku VARCHAR(100) UNIQUE NOT NULL,
    variant_attributes JSONB, -- {"color": "red", "size": "L"}
    price_adjustment DECIMAL(12, 2) DEFAULT 0.00,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Stock table (for inventory tracking)
CREATE TABLE IF NOT EXISTS public.product_stock (
    stock_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES public.products(product_id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES public.product_variants(variant_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0, -- For pending orders
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    warehouse_location VARCHAR(100),
    last_stock_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    CONSTRAINT stock_product_or_variant CHECK (
        (product_id IS NOT NULL AND variant_id IS NULL) OR
        (product_id IS NULL AND variant_id IS NOT NULL)
    )
);

-- Product Tags table (for search and filtering)
CREATE TABLE IF NOT EXISTS public.product_tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product-Tag relationship table
CREATE TABLE IF NOT EXISTS public.product_tag_mapping (
    product_id INTEGER NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES public.product_tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_product ON public.product_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_variant ON public.product_stock(variant_id);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample categories
INSERT INTO public.categories (category_name, description) VALUES
    ('Electronics', 'Electronic devices and accessories'),
    ('Clothing', 'Apparel and fashion items'),
    ('Food & Beverages', 'Food items and drinks'),
    ('Home & Kitchen', 'Home appliances and kitchen items'),
    ('Books', 'Books and publications')
ON CONFLICT (category_name) DO NOTHING;

-- Insert some sample tags
INSERT INTO public.product_tags (tag_name) VALUES
    ('new-arrival'),
    ('bestseller'),
    ('sale'),
    ('budget-friendly'),
    ('limited-edition')
ON CONFLICT (tag_name) DO NOTHING;

COMMENT ON TABLE public.products IS 'Product catalog test table in public schema';
COMMENT ON TABLE public.product_images IS 'Product images stored in S3';
COMMENT ON COLUMN public.product_images.s3_key IS 'S3 object key for file operations';
COMMENT ON COLUMN public.products.hsn_code IS 'HSN code for GST compliance in India';

