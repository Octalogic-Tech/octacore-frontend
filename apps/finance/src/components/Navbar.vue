<template>
    <div class="list-wrapper">
      <!-- main list items start here -->
      <v-list density="compact" class="ma-0 pe-0 d-flex flex-column justify-center align-center">
        <v-list-item class="d-flex justify-center pa-1 mb-7 rounded-2">
          <img src="../assets/Logo.png" width="48" alt="Image" />
        </v-list-item>
        <v-list-item
          v-for="(item, i) in items"
          :key="i"
          :value="item"
          :class="{
            'list-item': true,
            'current-page': item.text === currentProject,
          }"
          :href="item.navTo"
          :style="{
            'background-color':
              item.text === currentProject ? '#FEDFE1' : 'inherit',
            color: item.text === currentProject ? '#901E75' : '#83858B',
          }"
        >
          <v-item-group class="list-icon ma-0">
            <span
              :key="item.text"
              v-if="item.icon"
              class="material-symbols-outlined"
              style="font-size: 22px;
              margin-bottom: 0;"
            >
              {{ item.icon }}
            </span>
            <p class="icon-label">{{ item.text }}</p>
          </v-item-group>
          
        </v-list-item>
      </v-list>
      <!-- main list items end here -->
      <!-- logout list strart -->
      <v-list>
        <v-list-item class="list-item text-textSecondary">
          <v-item-group class="list-icon">
            <span class="material-symbols-outlined">
              {{ 'logout' }}
            </span>
          </v-item-group>
          <v-item-group class="icon-label">Logout</v-item-group>
        </v-list-item>
      </v-list>
      <!-- logout list end -->
    </div>
</template>
<script lang="ts">
export default {
  name: 'navbar-component',
  data() {

    return {
      drawer: false,
      currentProject: 'Finance',
      items: [
        { text: 'Core', icon: 'browse', navTo: 'http://localhost:4200/' },
        {
          text: 'Projects',
          icon: 'code',
          navTo: 'http://localhost:4201/project/overview',
        },
        { text: 'People', icon: 'group', navTo: '/' },
        { text: 'Documents', icon: 'library_books', navTo: '/' },
        { text: 'Supports', icon: 'support_agent', navTo: '/' },
        { text: 'Finance', icon: 'money', navTo: '/' },
        { text: 'Settings', icon: 'settings', navTo: '/finance/dashboard' },
      ],
    };
  },
};
</script>

<style scoped>
.list-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  align-items: center;
}
.list-icon {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: auto;
  margin: 0;
}
.list-item {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  width: 60px;
  border-radius: 4px;
  overflow: hidden;
  margin: 0.35rem 0;
}
.icon-label {
  font-size: 12px;
  display: inline;
  font-weight: 600;
  margin: 0;
}
</style>
