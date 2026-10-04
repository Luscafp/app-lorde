const { paleta } = require('./src/features/atletica/paleta')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primaria: 'rgb(var(--cor-primaria) / <alpha-value>)',
        secundaria: 'rgb(var(--cor-secundaria) / <alpha-value>)',
        ...paleta,
      },
    },
  },
}
