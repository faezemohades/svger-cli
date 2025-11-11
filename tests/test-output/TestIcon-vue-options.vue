<template>
  <svg
    :class="className"
    :style="style"
    :width="width"
    :height="height"
    :fill="fill"
    :stroke="stroke"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    v-bind="$attrs"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TestIcon',
  props: {
    className: { type: String, default: '' },
    style: { type: [String, Object], default: '' },
    width: { type: [String, Number], default: 24 },
    height: { type: [String, Number], default: 24 },
    fill: { type: String, default: 'currentColor' },
    stroke: { type: String, default: '' }
  }
});
</script>
