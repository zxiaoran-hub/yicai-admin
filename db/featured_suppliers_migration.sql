-- 异采 - 精选供应商功能数据库迁移

-- 1. 添加精选相关字段
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;

-- 2. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_suppliers_featured ON suppliers(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_suppliers_featured_order ON suppliers(featured_order) WHERE is_featured = true;

COMMENT ON COLUMN suppliers.is_featured IS '是否平台精选供应商';
COMMENT ON COLUMN suppliers.featured_at IS '设为精选的时间';
COMMENT ON COLUMN suppliers.featured_order IS '精选排序权重，数字越小越靠前';
