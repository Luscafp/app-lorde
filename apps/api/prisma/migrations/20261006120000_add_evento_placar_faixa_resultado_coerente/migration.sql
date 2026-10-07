-- #73 (épico #21 §8): placar de 0 a 999 e resultado coerente com o placar (RN17).
-- Os CHECKs da #43 (evento_placar_completo, evento_resultado_finalizado,
-- evento_placar_nao_negativo, evento_tipo_coerente) continuam valendo.
ALTER TABLE "Evento" ADD CONSTRAINT evento_placar_faixa
  CHECK (("placarTime" IS NULL OR "placarTime" BETWEEN 0 AND 999)
     AND ("placarAdversario" IS NULL OR "placarAdversario" BETWEEN 0 AND 999));
ALTER TABLE "Evento" ADD CONSTRAINT evento_resultado_coerente
  CHECK (resultado IS NULL
      OR (resultado = 'VITORIA' AND "placarTime" >  "placarAdversario")
      OR (resultado = 'EMPATE'  AND "placarTime" =  "placarAdversario")
      OR (resultado = 'DERROTA' AND "placarTime" <  "placarAdversario"));
