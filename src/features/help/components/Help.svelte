<script lang="ts">
  import { onMount } from 'svelte';
  // Removed unused Button import

  // Default state is closed
  export let visible = false;
  
  // References to elements
  let helpModal: HTMLDivElement;
  let helpContentDiv: HTMLDivElement;
  
  // Content state
  let helpContent = '';
  let isLoading = false;
  let loadError = false;

  // Function to toggle help visibility
  export function toggle() {
    visible = !visible;
    
    // Load content when first opened
    if (visible && !helpContent && !loadError && !isLoading) {
      loadHelpContent();
    }
  }
  
  // Function to close help
  export function close() {
    visible = false;
  }
  
  // Load help content from user-guide.html instead of .adoc
  async function loadHelpContent() {
    isLoading = true;
    loadError = false;
    
    try {
      // Try to load pre-rendered HTML version of the guide
      const response = await fetch('/docs/user-guide.html');
      if (!response.ok) {
        throw new Error(`Failed to load help content: ${response.status} ${response.statusText}`);
      }
      
      // Get the HTML content
      helpContent = await response.text();
      
      // Set the HTML content directly
      if (helpContentDiv) {
        helpContentDiv.innerHTML = helpContent;
      }
    } catch (error) {
      console.error('Error loading help content:', error);
      loadError = true;
    } finally {
      isLoading = false;
    }
  }
  
  // Initialize component
  onMount(() => {
    // If visible on initial render, load content
    if (visible) {
      loadHelpContent();
    }
  });
  
  // Watch for visibility changes
  $: if (visible) {
    // If content is already loaded, ensure it's displayed
    if (helpContent && helpContentDiv) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if(helpContentDiv) {
          helpContentDiv.innerHTML = helpContent;
        }
      }, 0);
    } 
    // Otherwise load content if needed
    else if (!helpContent && !loadError && !isLoading) {
      loadHelpContent();
    }
  }
  
  // Close help when Escape key is pressed
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} ></svelte:window>

{#if visible}
  <!-- Use dialog element for proper accessibility -->
  <dialog 
    class="help-overlay" 
    open={visible}
    aria-labelledby="help-title"
  >
    <div 
      class="help-modal" 
      bind:this={helpModal}
    >
      <div class="help-header">
        <h2 id="help-title">Help</h2>
        <button 
          class="close-button" 
          on:click={close}
          aria-label="Close help dialog"
        >
          &times;
        </button>
      </div>
      <div class="help-content" bind:this={helpContentDiv}>
        {#if isLoading}
          <div class="loading">Loading help content...</div>
        {:else if loadError}
          <div class="error">
            <p>Error loading help content.</p>
            <button class="retry-button" on:click={loadHelpContent}>Retry</button>
          </div>
        {/if}
      </div>
    </div>
    <!-- Add a backdrop button that acts as the overlay click handler -->
    <button 
      class="backdrop-button" 
      on:click={close} 
      aria-label="Close help dialog">
    </button>
  </dialog>
{/if}

<style>
  dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: var(--z-modal);
    overflow: hidden;
  }
  
  dialog::backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }
  
  /* For browsers that don't support ::backdrop */
  .backdrop-button {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    z-index: -1;
    cursor: default;
  }
  
  .help-modal {
    position: relative;
    background-color: white;
    border-radius: var(--border-radius);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 1200px;
    height: 85%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1;
  }
  
  .help-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .help-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: var(--text-color);
    padding: 0;
    margin: 0;
    line-height: 1;
  }
  
  .help-content {
    flex: 1;
    padding: var(--spacing-lg);
    overflow-y: auto;
  }
  
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    font-style: italic;
    color: #666;
  }
  
  .error {
    color: var(--error-color);
    text-align: center;
    padding: var(--spacing-xl);
  }
  
  .retry-button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--border-radius);
    cursor: pointer;
    margin-top: var(--spacing-md);
  }
  
  /* Additional styles for help content */
  :global(.help-content h1, .help-content h2, .help-content h3) {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  
  :global(.help-content table) {
    border-collapse: collapse;
    margin: 1em 0;
    width: 100%;
  }
  
  :global(.help-content th, .help-content td) {
    border: 1px solid #ddd;
    padding: 0.5em;
  }
  
  :global(.help-content th) {
    background-color: #f5f5f5;
  }
  
  :global(.help-content #toc) {
    background-color: #f9f9f9;
    border: 1px solid #ddd;
    padding: 1em;
    margin-bottom: 1em;
    max-width: 300px;
    float: left;
    margin-right: 2em;
  }
  
  :global(.help-content code) {
    background-color: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
  }
</style>