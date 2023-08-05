import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import About from '../views/About.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/finance/dashboard',
    name: 'Home',
    component: Dashboard,
  },
  {
    path: '/finance/about',
    name: 'About',
    component: About,
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
