<template>
  <div>
    <BreadCrumbs :items="items" />
    <!-- <ReceiptAddBillsDialogue/> -->
    <!-- <ReceiptBillsMenu/> -->
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import BreadCrumbs from '../components/BreadCrumbs.vue';
import { BreadcrumbItem } from '../interfaces/breadcrumbs';
import { financeRoutes } from '../contsants/routes-contants';
// import ReceiptAddBillsDialogue from '../components/Receipt-Add-Bills-dialogue.vue';
// import ReceiptBillsMenu from '../components/Receipt-Bills-Menu.vue';

export default defineComponent({
  name: financeRoutes.overview.name,
  components: {
    BreadCrumbs,
    // ReceiptAddBillsDialogue,
    // ReceiptBillsMenu,
  },
  data: () => ({
    items: [
      { title: 'Finance', href: financeRoutes.overview.path },
      { title: 'Overview' },
    ] as BreadcrumbItem[],
  }),
});
</script>
