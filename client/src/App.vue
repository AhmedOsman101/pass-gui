<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <header class="bg-background w-full flex justify-center my-5">
    <img
      alt="Vue logo"
      class="logo"
      src="@/assets/logo.svg"
      width="125"
      height="125"
    >
  </header>

  <RouterView />
</template>
