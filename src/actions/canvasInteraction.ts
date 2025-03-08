import { 
  updateCoordinates,
  togglePointSelection,
  startSelecting,
  updateSelecting,
  completeSelecting,
  startDragging,
  updateDragging,
  endDragging,
  startPanning,
  updatePanning,
  endPanning,
  zoom,
  clearSelection,
  diagramData,
  viewTransform,
  interactionState
} from '../services/AppState';
import { AppConfig } from '../utils/config';
import { get } from 'svelte/store';
import { screenToWorld } from '../utils/geometry';

/**
 * Svelte action for canvas interactions
 * Handles mouse and wheel events for panning, zooming, selecting, and dragging
 * 
 * @param canvas - Canvas element
 */
export function canvasInteraction(canvas: HTMLCanvasElement) {
  // Event handlers
  function handleMouseDown(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    
    const currentState = get(interactionState);
    const diagram = get(diagramData);
    
    // Calculate selection radius based on zoom level
    const selectionRadius = AppConfig.canvas.selectionThreshold * 
      Math.pow(currentTransform.scale, -0.3);
    
    if (e.ctrlKey) {
      // Check if clicking on a point
      const clickedPoint = diagram?.findPointNear(worldPos, selectionRadius);
      
      if (clickedPoint) {
        // Toggle point selection
        togglePointSelection(clickedPoint.iri);
      } else {
        // Start rectangular selection
        startSelecting(worldPos);
      }
    } else if (currentState.selectedPoints.size > 0) {
      // Check if clicking on a selected point for dragging
      const clickedPoint = diagram?.findPointNear(worldPos, selectionRadius);
      
      if (clickedPoint && currentState.selectedPoints.has(clickedPoint.iri)) {
        // Start dragging selected points
        startDragging(worldPos);
      } else {
        // Not clicking on a selected point
        const anyPoint = diagram?.findPointNear(worldPos, selectionRadius);
        
        if (!anyPoint) {
          // Clicked on empty space, clear selection
          clearSelection();
        }
        
        // Start panning
        startPanning({ x: screenX, y: screenY });
      }
    } else {
      // No points selected, start panning
      startPanning({ x: screenX, y: screenY });
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    
    // Update coordinates display
    updateCoordinates(worldPos);
    
    const currentState = get(interactionState);
    
    if (currentState.mode === 'panning' && currentState.panStart) {
      // Handle panning
      updatePanning({ x: screenX, y: screenY });
    } else if (currentState.mode === 'selecting') {
      // Update selection rectangle
      updateSelecting(worldPos);
    } else if (currentState.mode === 'dragging') {
      // Update dragging positions
      updateDragging(worldPos);
    }
  }

  function handleMouseUp(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    
    const currentState = get(interactionState);
    
    if (currentState.mode === 'panning') {
      endPanning();
    } else if (currentState.mode === 'selecting') {
      completeSelecting();
    } else if (currentState.mode === 'dragging') {
      endDragging(worldPos);
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    zoom({ x: mouseX, y: mouseY }, e.deltaY);
  }

  // Attach event listeners
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel);
  
  return {
    destroy() {
      // Remove event listeners on cleanup
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    }
  };
}