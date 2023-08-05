module.exports = {
  displayName: 'finance',
  preset: '../../jest.preset.js',
  transform: {
    '^.+.vue$': '@vue/vue3-jest',
    '.+.(css|styl|less|sass|scss|svg|png|jpg|ttf|woff|woff2)$':
      'jest-transform-stub',
    '^.+.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'vue', 'js', 'json'],
  coverageDirectory: '../../coverage/apps/finance',
  snapshotSerializers: ['jest-serializer-vue'],
  globals: {
    'ts-jest': {
      tsconfig: 'apps/finance/tsconfig.spec.json',
      babelConfig: 'apps/finance/babel.config.js',
    },
    'vue-jest': {
      tsConfig: 'apps/finance/tsconfig.spec.json',
      babelConfig: 'apps/finance/babel.config.js',
    },
  },
};
