-- fix_delete_rls.sql
-- 修复: companies/teams/suppliers 表缺少 DELETE RLS 策略
-- 导致前端显示删除成功但实际未删除

-- 1. companies 表 DELETE 策略
DROP POLICY IF EXISTS "companies_delete" ON companies;
CREATE POLICY "companies_delete" ON companies FOR DELETE
USING (auth.uid() IS NOT NULL);

-- 2. teams 表 DELETE 策略
DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams FOR DELETE
USING (auth.uid() IS NOT NULL);

-- 3. suppliers 表 DELETE 策略
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
USING (auth.uid() IS NOT NULL);
