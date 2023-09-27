const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

const generatedSafelist = [];

for (let i = 0; i < 10; i++) {
  generatedSafelist.push(`grid-cols-${i}`);
  generatedSafelist.push(`lg:grid-cols-${i}`);
  generatedSafelist.push(`grid-rows-${i}`);
  generatedSafelist.push(`lg:grid-rows-${i}`);
  generatedSafelist.push(`row-span-${i}`);
  generatedSafelist.push(`lg:row-span-${i}`);
  generatedSafelist.push(`col-span-${i}`);
  generatedSafelist.push(`lg:col-span-${i}`);
}

module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  safelist: generatedSafelist,
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
};
