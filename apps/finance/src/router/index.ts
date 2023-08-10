import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Overview from '../views/Overview.vue';
import ReceiptsBills from '../views/Receipt&Bills.vue';
import AccountsPayable from '../views/AccountsPayable.vue';
import AccountsRecievable from '../views/AccountsRecievable.vue';
import Budgets from '../views/Budgets.vue';
import AssetsTracking from '../views/Assets-tracking.vue'
import Reports from '../views/Reports.vue'
import { financeRoutes } from '../contsants/routes-contants';

const routes: Array<RouteRecordRaw> = [
  {
    path: financeRoutes.overview.path,
    name: financeRoutes.overview.name,
    component: Overview,
  },
  {
    path: financeRoutes.receiptsBills.path,
    name: financeRoutes.receiptsBills.name,
    component: ReceiptsBills,
  },
  {
    path: financeRoutes.accountPayable.path,
    name: financeRoutes.accountPayable.name,
    component: AccountsPayable,
  },
  {
    path: financeRoutes.accountReceivable.path,
    name: financeRoutes.accountReceivable.name,
    component: AccountsRecievable,
  },
  {
    path: financeRoutes.budgets.path,
    name:  financeRoutes.budgets.name,
    component: Budgets,
  },
  {
    path: financeRoutes.assetsTrackings.path,
    name: financeRoutes.assetsTrackings.name,
    component: AssetsTracking,
  },
  {
    path: financeRoutes.reports.path,
    name: financeRoutes.reports.name,
    component: Reports,
  },

];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
