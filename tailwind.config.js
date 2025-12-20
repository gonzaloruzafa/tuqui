/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'adhoc-violet': '#667eea',
                'adhoc-coral': '#f093fb',
                'adhoc-lavender': '#e9e4f0',
            },
        },
    },
    plugins: [],
}
