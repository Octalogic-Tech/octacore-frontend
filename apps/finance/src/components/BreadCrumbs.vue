<template>
  <div>
    <div class="breadcrumbs mb-2">
      <ul>
        <li v-for="(item, i) in items" :key="i">
          <a
            v-if="i !== items.length - 1"
            class="text-decoration-none text-textSecondary"
            :href="item.href"
            >{{ item.title }}</a
          >
          <span v-else class="text-secondary">{{ item.title }}</span>
          <span v-if="i !== items.length - 1"> /</span>
        </li>
      </ul>
    </div>
    <div>
      <h5 class="header-label text-textSecondary">{{ handleHeader }}</h5>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { BreadcrumbItem } from '../interfaces/breadcrumbs';

export default defineComponent({
  props: {
    items: {
      required: true,
      type: Array as PropType<BreadcrumbItem[]>,
    },
  },
  data: () => ({
    headerLabel: '',
  }),
  computed: {
    handleHeader() {
      return this.items[this.items.length - 1].title;
    },
  },
});
</script>

<style scoped>
.breadcrumbs > ul {
  list-style: none;
  display: flex;
  gap: 4px;
  font-size: 12px;
}
.header-label {
  font-size: 28px;
  font-weight: 500;
}
</style>

<style scoped>
.breadcrumbs > ul {
  list-style: none;
  display: flex;
  gap: 4px;
  font-size: 12px;
}
.header-label {
  font-size: 28px;
  font-weight: 500;
}
</style>
