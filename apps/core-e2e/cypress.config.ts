import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),
    setupNodeEvents(on) {
      // Electron's default window is 1280px wide, so a 1440px viewport was cropped in screenshots.
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron') {
          launchOptions.preferences.width = 1600;
          launchOptions.preferences.height = 1100;
        }
        return launchOptions;
      });
    },
  },
});
