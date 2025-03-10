<script lang="ts">
  import { createEventDispatcher} from 'svelte';
  import { 
    diagramList,
    selectedDiagram,
    cgmesVersion,
    setCGMESVersion,
    isLoading,
    gridEnabled,
    gridSnapEnabled,
    gridSize
  } from '../services/AppState';
  import { CGMESVersion } from '../models/types';
  import { AppConfig } from '../utils/config';
  import Button from './ui/Button.svelte';
  import Select from './ui/Select.svelte';
  import RadioGroup from './ui/RadioGroup.svelte';
  import Input from './ui/Input.svelte';
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Local state
  let endpoint = AppConfig.defaultEndpoint;
  let showNavigationMap = true;
  
  // Listen for loading state to disable controls
  $: disabled = $isLoading;
  
  // Options for CGMES version radio buttons
  const versionOptions = [
    { value: CGMESVersion.V2_4_15, label: '2.4.15' },
    { value: CGMESVersion.V3_0, label: '3.0' }
  ];
  
  // Handle CGMES version change
  function handleVersionChange(event: CustomEvent) {
    setCGMESVersion(event.detail.value as CGMESVersion);
  }
  
  // Handle load diagrams button click
  function handleLoadDiagrams() {
    dispatch('loadDiagrams', { endpoint });
  }
  
  // Handle render diagram button click
  function handleRenderDiagram() {
    dispatch('renderDiagram', { diagramIri: $selectedDiagram });
  }
  
  // Handle diagram selection change
  function handleDiagramChange(event: CustomEvent) {
    selectedDiagram.set(event.detail.value);
  }
  
  // Handle navigation map toggle
  function toggleNavigationMap() {
    // Just dispatch the current state - don't invert here
    // Let the parent component handle the state
    dispatch('toggleMap', showNavigationMap);
  }
</script>

<div class="config-panel">
  <div class="input-group">
    <Input 
      id="endpoint" 
      label="SPARQL Endpoint URL:" 
      bind:value={endpoint} 
      disabled={disabled}
    />
  </div>
  
  <div class="input-group">
    <RadioGroup 
      legend="CGMES Version:" 
      name="cgmes_version" 
      options={versionOptions} 
      value={$cgmesVersion} 
      on:change={handleVersionChange} 
      disabled={disabled}
    />
  </div>
  
  <div class="input-group">
    <Select 
      id="diagram-select" 
      label="Select diagram:" 
      options={$diagramList.map(d => ({ value: d.iri, label: d.name }))}
      value={$selectedDiagram}
      on:change={handleDiagramChange}
      disabled={disabled || $diagramList.length === 0}
      placeholder="-- Select a diagram --"
    />
  </div>
  
  <div class="button-group">
    <Button 
      id="load-diagrams" 
      label="Load diagram profiles" 
      on:click={handleLoadDiagrams} 
      disabled={disabled} 
    />
    <Button 
      id="render-diagram" 
      label="Render diagram" 
      on:click={handleRenderDiagram} 
      disabled={disabled || !$selectedDiagram}
    />
  </div>
</div>

<div class="grid-controls">
  <div class="checkbox-group">
    <label>
      <input type="checkbox" bind:checked={$gridEnabled} />
      Show Grid
    </label>
    <label>
      <input type="checkbox" bind:checked={$gridSnapEnabled} />
      Snap to Grid
    </label>
  </div>
  <div class="grid-size">
    <label>
      Grid Size:
      <input 
        type="number" 
        bind:value={$gridSize} 
        min="5" 
        max="100" 
        step="5"
      />
    </label>
    <label class="show-map-label">
      <input type="checkbox" bind:checked={showNavigationMap} on:change={toggleNavigationMap} />
      Show Map
    </label>
  </div>
</div>

<style>
  .config-panel {
    display: flex;
    flex-wrap: wrap;      
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }
  
  .input-group {
    flex: 1;
    min-width: 200px;
  }
  
  .button-group {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-end;
  }

  .grid-controls {
    display: flex;
    flex-wrap: wrap;
    text-wrap: nowrap;
    gap: var(--spacing-md);
    align-items: center;
    border: 1px solid #ddd;
    padding: var(--spacing-sm);
    border-radius: var(--border-radius);
    background-color: #f9f9f9;
  }
  
  .checkbox-group {
    display: flex;
    gap: var(--spacing-lg);
  }
  
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    cursor: pointer;
  }
  
  .grid-size {
    display: flex;
    align-items: center;
    margin-left: var(--spacing-xl);
    gap: var(--spacing-lg);
  }

  .grid-size input[type="number"] {
    width: 50px;
    text-align: right;      
    padding: 3px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
  }
  
  .show-map-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    cursor: pointer;
  }
</style>