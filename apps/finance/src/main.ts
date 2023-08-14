import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify, ThemeDefinition } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import DayJsAdapter from '@date-io/dayjs'

export const tokens = {
  grey: {
    200: '#E5E7EB',
    300: '#D1D5DB',
    900:"#212529"
  },
  primary: {
    // light green
    300: '#B2EECF',
    900: '#043028',
  },
  secondary: {
    100: '#FEDFE1',
    200: '#FEC0CA',
    800: '#901E75',
  },
  background: {
    light: '#ffff',
    main: '#1f2026',
  },
  text: {
    primary: '#212529',
    secondary: '#83858B',
    tertiary: '#999999',
  },
  system: {
      primary: '#21005D'
  }
};

const myCustomLightTheme:ThemeDefinition = {
  dark: false,
  colors: {
    background: '#f0f2f5',
    surface: '#FFFFFF',
    primary: tokens.primary[900],
    'primary-darken-1': tokens.primary[300],
    secondary: tokens.secondary[800],
    'secondary-darken-1': tokens.secondary[100],
    'secondary-darken-2': tokens.secondary[200],
    error: '#B00020',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',
    'textPrimary':'#212529',
    'textSecondary': '#83858B',
    'textTertiary': '#999999',
    'system-primary-1':tokens.system.primary
  },
}

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi'
  },
  theme: {
    defaultTheme: 'myCustomLightTheme',
    themes: {
      myCustomLightTheme,
    },
  },
  date:{
    adapter: DayJsAdapter,
  }
});

const app = createApp(App);
app.use(router);
app.use(vuetify);
app.mount('#app');
