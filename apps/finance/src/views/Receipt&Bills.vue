<template>
  <div class="d-flex flex-column content-wrapper">
    <BreadCrumbs :items="items" />
    <ReceiptsBillsTable />
  </div>
</template>

<script lang="ts">
import BreadCrumbs from '../components/BreadCrumbs.vue';
import { BreadcrumbItem } from '../interfaces/breadcrumbs';
import ReceiptsBillsTable from '../components/Receipts&BillsTable.vue';
import { financeRoutes } from '../contsants/routes-contants';
export default {
  name: financeRoutes.receiptsBills.name,
  components: {
    BreadCrumbs,
    ReceiptsBillsTable,
  },
  data: () => ({
    items: [
      { title: 'Finance', href: financeRoutes.receiptsBills.path },
      { title: 'Receipts & Bills' },
    ] as BreadcrumbItem[],
  }),
};
</script>

<style>
.content-wrapper {
  gap: 32px;
}
</style>
