// @ts-check
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const importsPrisma = {
  paths: [{ name: '@prisma/client', message: 'O app e o shared não importam o cliente Prisma.' }],
  patterns: [
    {
      group: ['**/generated/prisma', '**/generated/prisma/**'],
      message: 'Use os enums do shared.',
    },
  ],
}

// `prisma.semEscopo` ignora o filtro por atlética (RNF20): só é permitido nestes caminhos
// (convenções §3; épico #3 §7). Qualquer outro uso exige justificativa no PR.
const SEM_ESCOPO_PERMITIDO = [
  'apps/api/src/modules/auth/**',
  'apps/api/src/modules/usuarios/conta*.ts',
  'apps/api/src/modules/health/**',
  'apps/api/src/infra/**',
  'apps/api/prisma/seed*.ts',
  'tests/carga/seed-carga.ts',
  'tests/carga/limpar-carga.ts',
]
const mensagemSemEscopo =
  'prisma.semEscopo ignora o filtro por atlética: use prisma.db. Permitido só em modules/auth, ' +
  'modules/usuarios/conta*, modules/health, infra, prisma/seed* e scripts de carga (convenções §3).'
const usoSemEscopo = [
  "MemberExpression[property.name='semEscopo']",
  "MemberExpression[property.value='semEscopo']",
  "ObjectPattern > Property[key.name='semEscopo']",
].map((selector) => ({ selector, message: mensagemSemEscopo }))

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      '**/expo-env.d.ts',
      'apps/api/src/generated/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['tests/carga/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
  {
    files: ['apps/api/**/*.ts', 'tests/carga/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'error' },
  },
  {
    files: ['apps/api/**/*.ts', 'tests/carga/**/*.ts'],
    ignores: SEM_ESCOPO_PERMITIDO,
    rules: { 'no-restricted-syntax': ['error', ...usoSemEscopo] },
  },
  {
    files: ['apps/api/src/**/*.module.ts'],
    // Módulos Nest são classes vazias decoradas.
    rules: { '@typescript-eslint/no-extraneous-class': 'off' },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}', 'packages/shared/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', importsPrisma] },
  },
  {
    // Toda mutação de tela usa useAcaoOnline (convenções §10.5); o logout da #60 é a exceção.
    files: ['apps/mobile/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...importsPrisma,
          paths: [
            ...importsPrisma.paths,
            {
              name: '@tanstack/react-query',
              importNames: ['useMutation'],
              message: 'Use useAcaoOnline (@/infra/query/use-acao-online).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{spec,test,e2e-spec}.{ts,tsx}', '**/__tests__/**'],
    languageOptions: { globals: globals.jest },
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  prettier,
)
