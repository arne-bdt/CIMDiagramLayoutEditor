<script lang="ts">
  import Header from './components/Header.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import DiagramCanvas from './components/DiagramCanvas.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import LoadingIndicator from './components/LoadingIndicator.svelte';
  import Help from './components/Help.svelte';
  import { isLoading, statusText, coordinates } from './services/AppState';
  import { onMount } from 'svelte';
  import { diagramService } from './services/DiagramService';

  // Canvas reference
  let canvasContainer: HTMLDivElement;
  
  // Help component reference
  let helpComponent: Help;
  
  // Navigation map visibility
  let showNavigationMap = true;
  
  onMount(() => {
    console.log('CGMES DiagramLayout Editor mounted');
  });

  // Handle load diagram profiles
  const handleLoadDiagrams = async (event: CustomEvent) => {
    const endpoint = event.detail.endpoint;
    try {
      await diagramService.loadDiagramProfiles(endpoint);
    } catch (error) {
      console.error('Error loading diagrams:', error);
    }
  };

  // Handle render diagram
  const handleRenderDiagram = async (event: CustomEvent) => {
    const diagramIri = event.detail.diagramIri;
    try {
      await diagramService.loadDiagramLayout(diagramIri);
    } catch (error) {
      console.error('Error rendering diagram:', error);
    }
  };
  
  // Show help
  function toggleHelp() {
    if (helpComponent) {
      helpComponent.toggle();
    }
  }
  
  // Handle navigation map toggle
  function handleToggleMap(event: CustomEvent) {
    // Invert the current state when the checkbox is clicked
    showNavigationMap = !showNavigationMap;
  }
</script>

<main>
  <Header on:showHelp={toggleHelp} />
  
  <ConfigPanel 
    on:loadDiagrams={handleLoadDiagrams}
    on:renderDiagram={handleRenderDiagram}
    on:toggleMap={handleToggleMap}
  />
  
  <div class="canvas-container" bind:this={canvasContainer}>
    <DiagramCanvas showNavigationMap={showNavigationMap} />
    {#if $isLoading}
      <LoadingIndicator visible={true} />
    {/if}
  </div>
  
  <StatusBar status={$statusText} coordinates={$coordinates} />
  
  <!-- Help component -->
  <Help bind:this={helpComponent} />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 7px 15px 0 15px;
    box-sizing: border-box;
  }

  .canvas-container {
    flex: 1;
    position: relative;
    border: 1px solid #ccc;
    overflow: hidden;
    margin-top: 5px;
    min-height: 300px;
  }
</style>