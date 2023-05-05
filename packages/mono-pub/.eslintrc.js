const baseConfigPath = require.resolve('@mono-pub/configs/eslint')
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
    root: true,
    extends: [baseConfigPath],
}
