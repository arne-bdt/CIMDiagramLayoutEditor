<script lang="ts">
  import Button from '../base-components/Button.svelte';
  let { 
    showHelp } 
    : { 
    showHelp: () => void }
   = $props();  
</script>
  
<header>
  <h1>CGMES DiagramLayout Editor</h1>
  <div class="header-controls">
    <Button 
      label="Help" 
      on:click={showHelp} 
      primary={false} >
    </Button>
  </div>
</header>
  
<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
  
  h1 {
    font-size: 1.5rem;
    margin: 0;
  }
  
  .header-controls {
    display: flex;
    gap: var(--spacing-md);
  }
</style>