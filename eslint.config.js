import js from '@eslint/js';

export default [
    {
        ignores: ['node_modules/**'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                document: 'readonly',
                window: 'readonly',
                alert: 'readonly',
                Blob: 'readonly',
                URL: 'readonly',
                console: 'readonly',
            },
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': 'off',
        },
    },
];
