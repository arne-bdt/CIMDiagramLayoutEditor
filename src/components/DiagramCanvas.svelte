<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    diagramData, 
    viewTransform, 
    interactionState,
    positionUpdateEvent
  } from '../services/AppState';
  import { canvasService } from '../services/CanvasService';
  import { diagramService } from '../services/DiagramService';
  import { canvasInteraction } from '../actions/canvasInteraction';
  import { resizable } from '../actions/resizable';
  import { resizeCanvas } from '../utils/canvas';
  import PolygonCheckbox from '../components/PolygonCheckbox.svelte';
  import type { Point2D } from '../models/types';
  import type { PointModel } from '../models/PointModel';
  
  // Canvas element reference
  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  
  // For polygon checkbox
  let selectedPoint: PointModel | null = null;
  let showPolygonCheckbox = false;
  let checkboxPosition: Point2D = { x: 0, y: 0 };
  
  // Watch for selected points changes
  $: {
    if ($diagramData && $interactionState.selectedPoints.size === 1) {
      const pointIri = Array.from($interactionState.selectedPoints)[0];
      selectedPoint = $diagramData.points.find(p => p.iri === pointIri) || null;
      showPolygonCheckbox = selectedPoint !== null;
      if (selectedPoint) {
        checkboxPosition = { x: selectedPoint.x, y: selectedPoint.y };
      }
    } else {
      selectedPoint = null;
      showPolygonCheckbox = false;
    }
  }
  
  // Watch for positionUpdateEvent to update points in SPARQL
  $: if ($positionUpdateEvent) {
    handlePositionUpdate($positionUpdateEvent);
    // Reset event after handling
    positionUpdateEvent.set(null);
  }
  
  // Update canvas when diagram data, view transform or interaction state changes
  $: {
    if (canvas && $diagramData) {
      canvasService.render($diagramData, $viewTransform, $interactionState);
    }
  }
  
  // Handle canvas resize
  function handleResize() {
    if (canvas && container) {
      resizeCanvas(canvas, container);
      
      // If diagram is loaded, auto-fit it
      if ($diagramData) {
        diagramService.autoFitDiagram({
          width: canvas.width,
          height: canvas.height
        });
      }
    }
  }
  
  // Handle position update event
  async function handlePositionUpdate(updateData: any) {
    if (updateData) {
      try {
        await diagramService.updatePointPositions(updateData);
      } catch (error) {
        console.error('Failed to update point positions:', error);
      }
    }
  }
  
  onMount(() => {
    if (canvas) {
      // Initialize canvas service
      canvasService.setCanvas(canvas);
      
      // Initial resize
      handleResize();
    }
  });
</script>

<div class="canvas-container" bind:this={container} use:resizable={handleResize}>
  <canvas 
    id="diagram-canvas" 
    bind:this={canvas} 
    use:canvasInteraction
  ></canvas>
  
  <!-- Polygon checkbox that follows the selected point -->
  {#if showPolygonCheckbox && selectedPoint && selectedPoint.parentObject}
    <PolygonCheckbox 
      object={selectedPoint.parentObject}
      point={checkboxPosition}
      viewTransform={$viewTransform}
      visible={true}
    />
  {/if}
</div>

<style>
  .canvas-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>