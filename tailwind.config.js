/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/app/**/*.{js,jsx}', './src/components/**/*.{js,jsx}'],
  theme: { extend: { backdropBlur: { glass: '14px' }, boxShadow: { glass: '0 24px 80px rgba(0,0,0,.35)' } } },
  plugins: []
};
