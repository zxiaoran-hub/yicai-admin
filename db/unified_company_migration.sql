-- ============================================================
-- 异采 YiCai - 统一公司管理迁移脚本
-- suppliers 表增加 company_id 关联到 companies 表
-- ============================================================

BEGIN;

-- 1. 给 suppliers 表添加 company_id 外键
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS company_id BIGINT;

-- 2. 添加外键约束（延迟添加，先填数据）
-- 注意：如果有历史数据需要迁移，这里先不加 NOT NULL
ALTER TABLE suppliers
ADD CONSTRAINT fk_suppliers_company
FOREIGN KEY (company_id) REFERENCES companies(id);

-- 3. 添加索引
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);

COMMIT;

SELECT '✅ 统一公司管理迁移完成' AS result;
