const { join } = require('path');

module.exports = {
  plugins: {
    tailwindcss3: {
      config: join(__dirname, 'tailwind.config.js'),
    },
    autoprefixer: {},
  },
};
