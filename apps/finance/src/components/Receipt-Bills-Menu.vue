<template>
  <div class="d-flex justify-space-around">
    <v-btn flat color="transparent" elevation="0">
      <v-icon>mdi-dots-vertical</v-icon>
      <v-menu activator="parent" location="start">
        <v-list>
          <v-list-item
            v-for="(item, index) in items"
            :key="index"
            :value="index"
          >
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-btn>
  </div>
</template>

<script lang="ts">
export default {
  data: () => ({
    items: [
      { title: 'Menu Item-1' },
      { title: 'Menu Item-2' },
      { title: 'Menu Item-3' },
      { title: 'Menu Item-4' },
    ],
  }),
};
</script>
