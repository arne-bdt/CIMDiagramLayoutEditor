<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { PointModel } from '../models/PointModel';
  import type { ViewTransform, Point2D } from '../models/types';
  import { worldToScreen } from '../utils/geometry';
  import { sparqlService } from '../services/SparqlService';
  import { cimNamespace } from '../services/AppState';
  import { get } from 'svelte/store';
  
  // Props
  export let point: PointModel | null = null;
  export let viewTransform: ViewTransform;
  export let visible: boolean = false;
  
  // Local state
  let tooltipElement: HTMLDivElement;
  let pointData: any = null;
  let screenPosition: Point2D = { x: 0, y: 0 };
  let isDataLoading: boolean = false;
  let loadError: string | null = null;
  let isPinned: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  // Update tooltip position when point changes
  $: if (point && viewTransform) {
    updatePosition();
    if (visible && !pointData && !isDataLoading) {
      loadPointData();
    }
  }
  
  // Watch for changes in visibility
  $: if (visible && point && !pointData && !isDataLoading) {
    loadPointData();
  }
  
  // Watch for changes in the view transform
  $: if (viewTransform && point) {
    updatePosition();
  }
  
  // Update position based on current point and view transform
  function updatePosition() {
    if (!point) return;
    screenPosition = worldToScreen(point.x, point.y, viewTransform);
  }
  
  // Load point data on demand
  async function loadPointData() {
    if (!point) return;
    
    isDataLoading = true;
    loadError = null;
    
    try {
      const namespace = get(cimNamespace);
      
      // Build a query to fetch detailed information for this specific point
      const query = buildPointDetailsQuery(point.iri, namespace);
      
      // Execute the query
      const result = await sparqlService.executeQuery(query);
      
      // Process the result
      if (result.results.bindings.length > 0) {
        const binding = result.results.bindings[0];
        
        pointData = {
          diagramObject: {
            iri: binding.diagramObject?.value || '',
            name: binding.objectName?.value || 'Unknown',
            rotation: binding.rotation?.value !== undefined ? parseFloat(binding.rotation.value) : null,
            offsetX: binding.offsetX?.value !== undefined ? parseFloat(binding.offsetX.value) : null,
            offsetY: binding.offsetY?.value !== undefined ? parseFloat(binding.offsetY.value) : null,
            style: binding.style ? {
              iri: binding.style.value || '',
              name: binding.styleName?.value || 'Unknown'
            } : null
          },
          point: {
            iri: point.iri,
            name: binding.pointName?.value || 'Unknown',
            sequenceNumber: point.sequenceNumber,
            x: point.x,
            y: point.y,
            z: binding.zPosition?.value !== undefined ? parseFloat(binding.zPosition.value) : null
          }
        };
      } else {
        // Fallback with basic information if detailed query fails
        pointData = {
          diagramObject: {
            iri: point.parentObject?.iri || '',
            name: 'Unknown',
            rotation: null,
            offsetX: null,
            offsetY: null,
            style: null
          },
          point: {
            iri: point.iri,
            name: 'Unknown',
            sequenceNumber: point.sequenceNumber,
            x: point.x,
            y: point.y,
            z: null
          }
        };
      }
    } catch (error) {
      console.error('Error loading point details:', error);
      loadError = error instanceof Error ? error.message : 'Failed to load point details';
      
      // Set basic fallback data
      pointData = {
        diagramObject: {
          iri: point.parentObject?.iri || '',
          name: 'Unknown',
          rotation: null,
          offsetX: null,
          offsetY: null,
          style: null
        },
        point: {
          iri: point.iri,
          name: 'Unknown',
          sequenceNumber: point.sequenceNumber,
          x: point.x,
          y: point.y,
          z: null
        }
      };
    } finally {
      isDataLoading = false;
    }
  }
  
  // Build a query to fetch detailed point information
  function buildPointDetailsQuery(pointIri: string, cimNamespace: string): string {
    return `
      PREFIX cim: <${cimNamespace}>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      SELECT ?diagramObject ?objectName ?pointName ?zPosition ?offsetX ?offsetY ?rotation ?style ?styleName
      WHERE {
        <${pointIri}> cim:DiagramObjectPoint.DiagramObject ?diagramObject .
        
        # Optional DiagramObject name
        OPTIONAL {
          ?diagramObject cim:IdentifiedObject.name ?objectName .
        }
        
        # Optional DiagramObjectPoint name
        OPTIONAL {
          <${pointIri}> cim:IdentifiedObject.name ?pointName .
        }
        
        # Optional z position
        OPTIONAL {
          <${pointIri}> cim:DiagramObjectPoint.zPosition ?zPosition .
        }
        
        # Optional offset properties
        OPTIONAL {
          ?diagramObject cim:DiagramObject.offsetX ?offsetX .
        }
        
        OPTIONAL {
          ?diagramObject cim:DiagramObject.offsetY ?offsetY .
        }
        
        # Optional rotation property
        OPTIONAL {
          ?diagramObject cim:DiagramObject.rotation ?rotation .
        }
        
        # Optional style reference
        OPTIONAL {
          ?diagramObject cim:DiagramObject.DiagramObjectStyle ?style .
          OPTIONAL {
            ?style cim:IdentifiedObject.name ?styleName .
          }
        }
      }
      LIMIT 1
    `;
  }
  
  // Handle keydown events to close tooltip on ESC
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      closeTooltip();
    }
  }
  
  function closeTooltip() {
    isPinned = false;
    visible = false;
    dispatch('close');
  }
  
  function togglePin() {
    isPinned = !isPinned;
    dispatch('pin', isPinned);
  }
  
  // Clean up function when component unmounts or visibility changes
  function resetTooltip() {
    pointData = null;
    loadError = null;
  }
  
  // When visibility changes to false, reset the tooltip data
  $: if (!visible && pointData) {
    resetTooltip();
  }
  
  onMount(() => {
    // Add event listener for ESC key
    window.addEventListener('keydown', handleKeyDown);
  });
  
  onDestroy(() => {
    // Clean up event listener
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if visible && point}
  <div 
    class="point-tooltip" 
    bind:this={tooltipElement}
    style="left: {screenPosition.x + 20}px; top: {screenPosition.y - 20}px;"
    on:mouseenter={() => dispatch('enter')}
    on:mouseleave={() => dispatch('leave')}
  >
    <div class="tooltip-header">
      <h3>DiagramObject Details</h3>
      <div class="tooltip-controls">
        <button 
          class="pin-button" 
          title={isPinned ? "Unpin tooltip" : "Pin tooltip"} 
          on:click={togglePin}
        >
          <span class={isPinned ? "pinned" : "unpinned"}>📌</span>
        </button>
        <button class="close-button" title="Close tooltip" on:click={closeTooltip}>×</button>
      </div>
    </div>
    
    <div class="tooltip-content">
      {#if isDataLoading}
        <div class="loading-indicator">
          <div class="spinner"></div>
          <div>Loading details...</div>
        </div>
      {:else if loadError}
        <div class="error-message">
          Error: {loadError}
        </div>
      {:else if pointData}
        <div class="tooltip-section">
          <h4>DiagramObject</h4>
          <div class="tooltip-row">
            <span class="label">mRID:</span>
            <span class="value copyable">{pointData.diagramObject.iri}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Name:</span>
            <span class="value copyable">{pointData.diagramObject.name}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Offset:</span>
            <span class="value">
              ({pointData.diagramObject.offsetX !== null ? pointData.diagramObject.offsetX.toFixed(2) : 'N/A'}, 
              {pointData.diagramObject.offsetY !== null ? pointData.diagramObject.offsetY.toFixed(2) : 'N/A'})
            </span>
          </div>
          <div class="tooltip-row">
            <span class="label">Rotation:</span>
            <span class="value">{pointData.diagramObject.rotation !== null ? pointData.diagramObject.rotation.toFixed(2) : 'N/A'}</span>
          </div>
          
          {#if pointData.diagramObject.style}
            <div class="tooltip-subsection">
              <h5>Style</h5>
              <div class="tooltip-row">
                <span class="label">mRID:</span>
                <span class="value copyable">{pointData.diagramObject.style.iri}</span>
              </div>
              <div class="tooltip-row">
                <span class="label">Name:</span>
                <span class="value copyable">{pointData.diagramObject.style.name}</span>
              </div>
            </div>
          {/if}
        </div>
        
        <div class="tooltip-section">
          <h4>DiagramObjectPoint</h4>
          <div class="tooltip-row">
            <span class="label">mRID:</span>
            <span class="value copyable">{pointData.point.iri}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Name:</span>
            <span class="value copyable">{pointData.point.name}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">#:</span>
            <span class="value">{pointData.point.sequenceNumber}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">x:</span>
            <span class="value">{pointData.point.x.toFixed(2)}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">y:</span>
            <span class="value">{pointData.point.y.toFixed(2)}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">z:</span>
            <span class="value">{pointData.point.z !== null ? pointData.point.z.toFixed(2) : 'N/A'}</span>
          </div>
        </div>
      {/if}
    </div>
    
    <div class="tooltip-footer">
      <span class="key-hint">ESC to close</span>
    </div>
  </div>
{/if}

<style>
  .point-tooltip {
    position: absolute;
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid #aaa;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    min-width: 280px;
    max-width: 400px;
    font-size: 12px;
    pointer-events: auto;
    user-select: text;
  }
  
  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ddd;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  
  .tooltip-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: bold;
  }
  
  .tooltip-controls {
    display: flex;
    gap: 4px;
  }
  
  .close-button, .pin-button {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    color: #666;
  }
  
  .close-button:hover, .pin-button:hover {
    color: #000;
  }
  
  .pin-button {
    font-size: 14px;
  }
  
  .pinned {
    color: #4CAF50;
  }
  
  .unpinned {
    opacity: 0.7;
  }
  
  .tooltip-content {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .tooltip-section {
    margin-bottom: 12px;
  }
  
  .tooltip-section h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: bold;
    color: #333;
  }
  
  .tooltip-subsection {
    margin-top: 8px;
    padding-left: 12px;
    border-left: 2px solid #eee;
  }
  
  .tooltip-subsection h5 {
    margin: 0 0 4px 0;
    font-size: 12px;
    font-weight: bold;
    color: #555;
  }
  
  .tooltip-row {
    display: flex;
    margin-bottom: 4px;
  }
  
  .label {
    font-weight: bold;
    min-width: 80px;
    color: #555;
  }
  
  .value {
    flex: 1;
    word-break: break-word;
  }
  
  .copyable {
    cursor: text;
    background-color: #f5f5f5;
    padding: 1px 3px;
    border-radius: 2px;
  }
  
  .tooltip-footer {
    border-top: 1px solid #ddd;
    padding-top: 4px;
    margin-top: 8px;
    font-style: italic;
    font-size: 11px;
    color: #666;
    text-align: right;
  }
  
  .key-hint {
    padding: 2px 4px;
    background-color: #f0f0f0;
    border-radius: 3px;
    border: 1px solid #ddd;
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    color: #666;
  }
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--primary-color, #4CAF50);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 5px;
  }
  
  .error-message {
    color: #f44336;
    padding: 10px;
    text-align: center;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>