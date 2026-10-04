// Env dos testes: o `.env` é ignorado quando NODE_ENV=test (config.module.ts).
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://atletica:atletica@localhost:5433/atletica_test'
process.env.LOG_LEVEL ??= 'silent'
process.env.EMAIL_PROVIDER ??= 'fake'
process.env.EMAIL_REMETENTE ??= 'Atlética Teste <nao-responda@teste.local>'
process.env.CODIGO_PEPPER ??= 'pepper-de-teste-com-pelo-menos-32-caracteres'
