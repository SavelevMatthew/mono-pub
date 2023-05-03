require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
    root: true,
    extends: ['@mono-pub/eslint-config'],
    rules: {
        'jest/no-conditional-expect': 'off',
    },
}
