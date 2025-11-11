<script lang="ts">
  export let className: string = '';
  export let style: string = '';
  export let width: string | number = 24;
  export let height: string | number = 24;
  export let fill: string = 'currentColor';
  export let stroke: string = '';
</script>

<svg
  class={className}
  {style}
  {width}
  {height}
  {fill}
  {stroke}
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg"
  {...$$restProps}
>
  <circle cx="12" cy="12" r="10"/>
</svg>
