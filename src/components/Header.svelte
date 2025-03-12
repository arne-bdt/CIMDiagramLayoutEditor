<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from './ui/Button.svelte';
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Handle help button click
  function showHelp() {
    dispatch('showHelp');
  }
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