<template>
  <v-list>
    <v-list-item-subtitle class="subtitle mb-4">
      Finance Module
    </v-list-item-subtitle>
    <v-list-item
      v-for="(item, i) in items"
      :key="i"
      :value="item"
      color="primary"
      class="mb-2 px-1 py-0 list-item"
      :style="{
        'min-height': '40px',
        'background-color': item.navTo === currentPage ? '#FEDFE1' : 'inherit',
        color: item.navTo === currentPage ? '#901E75' : '#83858B',
      }"
      @click="handlePageChange(item.navTo)"
      :href="item.navTo"
    >
      <template v-slot:prepend>
        <span
          :key="item.text"
          v-if="item.icon"
          class="material-symbols-outlined me-2 pa-0"
          style="font-size: 22px"
        >
          {{ item.icon }}
        </span>
      </template>
      <v-list-item-title class="pa-0 list-label">{{
        item.text
      }}</v-list-item-title>
    </v-list-item>
  </v-list>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import {items} from '../contsants/nested-nav-contants'
export default defineComponent({
  name: 'nested-nav-component',
  data: () => ({
    currentPath: window.location.pathname,
    currentPage: '',
    items
  }),
  methods: {
    handlePageChange(newPage: string) {
      this.currentPage = newPage;
    },
  },
  mounted() {
    console.log(this.currentPath);
    this.currentPage = this.currentPath;
    console.log(this.currentPage);
  },
});
</script>

<style scoped>
.list-item {
  border-radius: 6px;
}

.list-label {
  font-size: 12px;
}
.subtitle{
  font-size: 14px;
}
</style>
