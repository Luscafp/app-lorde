// Env dos testes: o `.env` é ignorado quando NODE_ENV=test (config.module.ts).
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://atletica:atletica@localhost:5433/atletica_test'
process.env.LOG_LEVEL ??= 'silent'
