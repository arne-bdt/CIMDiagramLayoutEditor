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
  interactionState,
  addNewPointToLine,
  deletePointFromLine,
  copySelectedDiagramObjects,
  pasteDiagramObjects,
  deleteSelectedDiagramObjects,
  rotateSelectedObjects,
  showTooltipForPoint,
  hideTooltipIfNotPinned,
  showPointTooltip,
  isTooltipPinned,
  isTooltipHovered
} from '../services/AppState';
import { AppConfig } from '../utils/config';
import { get } from 'svelte/store';
import { screenToWorld } from '../utils/geometry';
import { findClosestLineSegment } from '../utils/geometry';
import type { Point2D } from '@/models/types';
import { InteractionMode } from '../models/types';
import type { PointModel } from '../models/PointModel';

/**
 * Svelte action for canvas interactions
 * Handles mouse and wheel events for panning, zooming, selecting, and dragging
 * 
 * @param canvas - Canvas element
 */
export function canvasInteraction(canvas: HTMLCanvasElement) {
  // Track mouse position for paste operations
  let currentMouseWorldPos: Point2D = { x: 0, y: 0 };
  
  // For tracking hover state
  let lastHoveredPoint: PointModel | null = null;
  let hoverCheckScheduled = false;
  
  // Handle keyboard events for copy/paste
  function handleKeyDown(e: KeyboardEvent) {
    if (get(showPointTooltip) && e.key === 'Escape') {
      // Let the tooltip component handle this
      return;
    }
    
    if (e.ctrlKey) {
      if (e.key === 'c') {
        // Copy operation
        copySelectedDiagramObjects();
      } else if (e.key === 'v') {
        // Paste operation
        pasteDiagramObjects(currentMouseWorldPos);
      } else if (e.key === 'ArrowRight') {
        // Rotate 90 degrees clockwise
        e.preventDefault(); // Prevent scrolling
        rotateSelectedObjects(90);
      } else if (e.key === 'ArrowLeft') {
        // Rotate 90 degrees counter-clockwise
        e.preventDefault(); // Prevent scrolling
        rotateSelectedObjects(-90);
      }
    } else if (e.key === 'Delete') {
      // Delete operation
      deleteSelectedDiagramObjects();
    }
  }
  
  // Add double-click handler for inserting or deleting points
  function handleDoubleClick(e: MouseEvent) {
    // Don't act if the tooltip is active
    if (get(showPointTooltip)) {
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    
    const diagram = get(diagramData);
    if (!diagram) return;
    
    // First check if we clicked on an existing point
    const selectionRadius = AppConfig.canvas.selectionThreshold * 
      Math.pow(currentTransform.scale, -0.3);
    
    const clickedPoint = diagram.findPointNear(worldPos, selectionRadius);
    
    if (clickedPoint) {
      // Attempt to delete the point
      deletePointFromLine(clickedPoint);
    } else {
      // Find closest line segment to add a new point
      const result = findClosestLineSegment(worldPos, diagram, AppConfig.canvas.selectionThreshold * 2);
      
      if (result) {
        addNewPointToLine(result.object, result.position, result.index);
      }
    }
  }

  // Handle mouse movement for hover effects
  function handleMouseMove(e: MouseEvent) {
    // If we've scheduled a hover check already, no need for another one
    if (hoverCheckScheduled) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    currentMouseWorldPos = worldPos;
    
    // Update coordinates display
    updateCoordinates(worldPos);
    
    const currentState = get(interactionState);
    
    // While in an active interaction mode, don't change the tooltip
    if (currentState.mode !== InteractionMode.NONE) {
      // Process the regular interaction handlers
      if (currentState.mode === InteractionMode.PANNING && currentState.panStart) {
        updatePanning({ x: screenX, y: screenY });
      } else if (currentState.mode === InteractionMode.SELECTING) {
        updateSelecting(worldPos);
      } else if (currentState.mode === InteractionMode.DRAGGING) {
        updateDragging(worldPos);
      }
      return;
    }
    
    // Schedule a hover check after a short delay
    hoverCheckScheduled = true;
    requestAnimationFrame(() => {
      checkForPointHover(worldPos);
      hoverCheckScheduled = false;
    });
  }
  
  // Check if the cursor is hovering over a point
  function checkForPointHover(worldPos: Point2D) {
    // Don't check if tooltip is pinned or being hovered
    if (get(isTooltipPinned) || get(isTooltipHovered)) return;
    
    const diagram = get(diagramData);
    if (!diagram) return;
    
    // Calculate hover radius based on zoom level
    const currentTransform = get(viewTransform);
    const hoverRadius = AppConfig.canvas.selectionThreshold * 
      Math.pow(currentTransform.scale, -0.3);
    
    // Find point under cursor
    const pointUnderCursor = diagram.findPointNear(worldPos, hoverRadius);
    
    // If we found a point and it's different from the last one, show its tooltip
    if (pointUnderCursor && pointUnderCursor !== lastHoveredPoint) {
      lastHoveredPoint = pointUnderCursor;
      showTooltipForPoint(pointUnderCursor);
    } 
    // If we didn't find a point but had one before, hide the tooltip
    else if (!pointUnderCursor && lastHoveredPoint) {
      lastHoveredPoint = null;
      hideTooltipIfNotPinned();
    }
  }

  // Handle mouse down for interactions
  function handleMouseDown(e: MouseEvent) {
    // If tooltip is pinned, don't start other interactions
    if (get(isTooltipPinned) || get(isTooltipHovered)) {
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    
    const currentState = get(interactionState);
    const diagram = get(diagramData);
    
    if (!diagram) return;
    
    // Calculate selection radius based on zoom level
    const selectionRadius = AppConfig.canvas.selectionThreshold * 
      Math.pow(currentTransform.scale, -0.3);
    
    if (e.ctrlKey) {
      // Check if clicking on a point
      const clickedPoint = diagram.findPointNear(worldPos, selectionRadius);
      
      if (clickedPoint) {
        // Toggle point selection
        togglePointSelection(clickedPoint.iri);
      } else {
        // Start rectangular selection
        startSelecting(worldPos);
      }
    } else if (currentState.selectedPoints.size > 0) {
      // Check if clicking on a selected point for dragging
      const clickedPoint = diagram.findPointNear(worldPos, selectionRadius);
      
      if (clickedPoint && currentState.selectedPoints.has(clickedPoint.iri)) {
        // Start dragging selected points
        startDragging(worldPos);
      } else {
        // Not clicking on a selected point
        const anyPoint = diagram.findPointNear(worldPos, selectionRadius);
        
        if (!anyPoint) {
          // Clicked on empty space, clear selection
          clearSelection();
        }
        
        // Start panning
        startPanning({ x: screenX, y: screenY });
      }
    } else {
      // Hide tooltip if it's showing
      if (get(showPointTooltip)) {
        hideTooltipIfNotPinned();
      }
      
      // No points selected, start panning
      startPanning({ x: screenX, y: screenY });
    }
  }

  // Handle mouse up events
  function handleMouseUp(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const currentTransform = get(viewTransform);
    const worldPos = screenToWorld(screenX, screenY, currentTransform);
    
    const currentState = get(interactionState);
    
    if (currentState.mode === InteractionMode.PANNING) {
      endPanning();
    } else if (currentState.mode === InteractionMode.SELECTING) {
      completeSelecting();
    } else if (currentState.mode === InteractionMode.DRAGGING) {
      endDragging(worldPos);
    }
    
    // After any interaction completes, check if we're hovering over a point
    requestAnimationFrame(() => {
      checkForPointHover(worldPos);
    });
  }

  // Handle mouse wheel events for zooming
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    zoom({ x: mouseX, y: mouseY }, e.deltaY);
    
    // When zooming, recheck point hover
    const worldPos = screenToWorld(mouseX, mouseY, get(viewTransform));
    requestAnimationFrame(() => {
      checkForPointHover(worldPos);
    });
  }
  
  // Handle mouse leave events
  function handleMouseLeave() {
    // Don't hide the tooltip if it's pinned or being hovered
    if (!get(isTooltipPinned) && !get(isTooltipHovered)) {
      hideTooltipIfNotPinned();
      lastHoveredPoint = null;
    }
  }
  
  // Attach event listeners
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel);
  canvas.addEventListener('dblclick', handleDoubleClick);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  window.addEventListener('keydown', handleKeyDown);
  
  return {
    destroy() {
      // Remove event listeners on cleanup
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Reset hover state
      lastHoveredPoint = null;
    }
  };
}