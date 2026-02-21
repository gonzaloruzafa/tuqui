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
                adhoc: {
                    violet: '#7C6CD8',
                    lavender: '#BCAFEF',
                    coral: '#FF7348',
                    mustard: '#FEA912',
                    white: '#FFFFFF',
                    beige: '#E9E5DF',
                }
            },
            fontFamily: {
                sans: ['var(--font-apercu)', 'system-ui', 'sans-serif'],
                display: ['var(--font-new-kansas)', 'Georgia', 'serif'],
            },
        },
    },
    plugins: [],
}
