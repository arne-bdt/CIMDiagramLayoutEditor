<script lang="ts">
  import Header from './components/Header.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import DiagramCanvas from './components/DiagramCanvas.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import LoadingIndicator from './components/LoadingIndicator.svelte';
  import { isLoading, statusText, coordinates } from './services/AppState';
  import { onMount } from 'svelte';
  import { diagramService } from './services/DiagramService';

  // Canvas reference
  let canvasContainer: HTMLDivElement;
  
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
</script>

<main>
  <Header />
  
  <ConfigPanel 
    on:loadDiagrams={handleLoadDiagrams}
    on:renderDiagram={handleRenderDiagram} 
  />
  
  <div class="canvas-container" bind:this={canvasContainer}>
    <DiagramCanvas />
    {#if $isLoading}
      <LoadingIndicator visible={true} />
    {/if}
  </div>
  
  <StatusBar status={$statusText} coordinates={$coordinates} />
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
    padding: 20px;
    box-sizing: border-box;
  }

  .canvas-container {
    flex: 1;
    position: relative;
    border: 1px solid #ccc;
    overflow: hidden;
    margin-top: 10px;
    min-height: 300px;
  }
</style>