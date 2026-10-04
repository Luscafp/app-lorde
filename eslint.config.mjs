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
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'error' },
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
    files: ['**/*.{spec,test,e2e-spec}.{ts,tsx}', '**/__tests__/**'],
    languageOptions: { globals: globals.jest },
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  prettier,
)
