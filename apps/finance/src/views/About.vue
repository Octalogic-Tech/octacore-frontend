<template>
  <!-- Only one top-level template block is allowed -->
  <div>
    <!-- Your template content goes here -->
    <h1>{{ message }}</h1>
  </div>
</template>

<script lang="ts">
export default {
  name: "about-page",
  data() {
    return {
      message: "Hello, Vue!"
    };
  }
};
</script>

<style>
/* Your component's styles go here */
h1 {
  color: blue;
}
</style>

