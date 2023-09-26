<template>
    <div>
        <BreadCrumbs :items="items"/>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { BreadcrumbItem } from '../interfaces/breadcrumbs';
import BreadCrumbs from '../components/BreadCrumbs.vue';
import { financeRoutes } from '../contsants/routes-contants';

export default defineComponent({
    name:financeRoutes.reports.name,
    data: () => ({
    items: [
      { title: 'Finance', href: financeRoutes.reports.path },
      { title: 'Reports' },
    ] as BreadcrumbItem[],
  }),
  components: {
    BreadCrumbs
  }
})
</script>

<style scoped>

</style>