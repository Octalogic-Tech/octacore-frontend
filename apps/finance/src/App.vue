<template>
  <v-card>
    <v-layout>
      <v-app-bar color="primary" class="d-sm-none ma-0">
        <div @click.stop="drawer = !drawer">
          <v-icon v-if="drawer" class="ms-4" style="font-size: 22px">{{
            'mdi-close'
          }}</v-icon>
          <v-icon v-else class="ms-4" style="font-size: 22px">{{
            'mdi-menu'
          }}</v-icon>
        </div>
      </v-app-bar>
      <v-navigation-drawer v-model="drawer" location="left" class="w-100">
        <v-container class="d-flex main-container-drawer w-100" fluid>
          <v-col class="navbar-container-drawer d-sm-none">
            <Navbar />
          </v-col>
          <v-col class="nested-nav-container-drawer d-sm-none">
            <NestedNavbar />
          </v-col>
        </v-container>
      </v-navigation-drawer>
      <v-container class="d-flex ma-0 pa-0 main-container" fluid>
        <v-col class="navbar-container d-none d-sm-block">
          <Navbar />
        </v-col>
        <v-col class="nested-nav-container d-none d-sm-block">
          <NestedNavbar />
        </v-col>
        <v-col
          class="content-container bg-background mt-15 mt-sm-0 py-2 px-1 py-sm-6 px-sm-9"
        >
          <router-view />
        </v-col>
      </v-container>
    </v-layout>
  </v-card>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Navbar from '../src/components/Navbar.vue';
import NestedNavbar from './components/NestedNavBar.vue';

export default defineComponent({
  name: 'main-app',
  components: {
    Navbar,
    NestedNavbar,
  },
  data: () => ({
    drawer: false,
    group: null,
  }),
  watch: {
    group() {
      this.drawer = false;
    },
  },
});
</script>

<style scoped>
.main-container {
  min-height: 100vh;
}
.main-container-drawer {
  padding: 0;
}

.navbar-container {
  height: 100%;
  flex: 1;
  border-right: 1px solid lightgray;
  padding: 0.5rem 0.85rem;
}
.navbar-container-drawer {
  flex: 1;
  border: 1px solid rgb(189, 186, 186);
}
.nested-nav-container {
  height: 100%;
  flex: 4;
  max-width: 244px;
  padding: 24px 8px;
}
.nested-nav-container-drawer {
  flex: 15;
}
.content-container {
  height: 100%;
  flex: 18;
}
</style>
