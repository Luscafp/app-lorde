-- RegistroAuditoria é imutável (#8). TRUNCATE não dispara triggers de linha: a limpeza dos testes continua funcionando.
CREATE FUNCTION auditoria_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegistroAuditoria é imutável';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER registro_auditoria_imutavel
  BEFORE UPDATE OR DELETE ON "RegistroAuditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();
