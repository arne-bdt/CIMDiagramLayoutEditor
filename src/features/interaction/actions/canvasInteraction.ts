import { get } from 'svelte/store';
import type { InteractionState, Point2D } from '../../../core/models/types';
import { InteractionMode } from '../../../core/models/types';
import type { PointModel } from '../../../core/models/PointModel';
import { AppConfig } from '../../../core/config/AppConfig';
import { screenToWorld } from '../../../utils/geometry';
import { findClosestLineSegment } from '../../../utils/geometry';
import { serviceRegistry } from '../../../services/ServiceRegistry';

// Import from UI state
import { updateCoordinates } from '../../ui/UIState';

// Import from canvas state
import { viewTransform, zoom as zoomViewport } from '../../canvas/CanvasState';

// Import from interaction state
import { 
  interactionState,
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
  clearSelection
} from '../InteractionState';

// Import from diagram state
import { diagramData } from '../../diagram/DiagramState';

// Import from tooltip state
import {
  showTooltipForPoint,
  hideTooltipIfNotPinned,
  showPointTooltip,
  isTooltipPinned,
  isTooltipHovered,
  hideTooltip,
} from '../../tooltips/TooltipState';
import type { DiagramObjectModel } from '@/core/models/DiagramModel';

// Services
const pointService = serviceRegistry.pointService;
const objectService = serviceRegistry.objectService;

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
    if (hoverCheckScheduled) return;
  
    const { screenPos, worldPos } = getCoordinatesFromEvent(e);
    currentMouseWorldPos = worldPos;
    updateCoordinates(worldPos);
    
    const currentState = get(interactionState);
    
    if (handleActiveInteractionIfNeeded(currentState, screenPos, worldPos, e)) {
      return;
    }
    
    // Only schedule hover check when not in active interaction
    hoverCheckScheduled = true;
    requestAnimationFrame(() => {
      checkForPointHover(worldPos);
      hoverCheckScheduled = false;
    });
  }

  function getCoordinatesFromEvent(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const screenPos : Point2D = { 
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    const worldPos = screenToWorld(screenPos.x, screenPos.y, get(viewTransform));
    return { screenPos, worldPos };
  }
  
  function handleActiveInteractionIfNeeded(
    state : InteractionState, 
    screenPos: Point2D, 
    worldPos: Point2D, 
    e: MouseEvent) {
    if (state.mode === InteractionMode.NONE) {
      return false;
    }
    
    if (state.mode === InteractionMode.PANNING && state.panStart) {
      updatePanning(screenPos);
    } else if (state.mode === InteractionMode.SELECTING) {
      updateSelecting(worldPos);
    } else if (state.mode === InteractionMode.DRAGGING) {
      updateDragging(worldPos, e.altKey);
    }
    
    return true;
  }
  
  // Check if the cursor is hovering over a point
  function checkForPointHover(worldPos: Point2D) {
    // Don't check if tooltip is pinned or being hovered
    if (get(isTooltipPinned) || get(isTooltipHovered)) return;
    
    // Don't show tooltips when in active interaction modes
    const currentState = get(interactionState);
    if (currentState.mode !== InteractionMode.NONE) return;
    
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
    // Check if tooltip is pinned first
    if (get(isTooltipPinned)) {
      // If we click outside the tooltip area, close it
      if (!get(isTooltipHovered)) {
        hideTooltip();
      }
      return; // Skip other interactions when tooltip is pinned
    }
    
    // If tooltip is showing but not pinned, hide it
    if (get(showPointTooltip) && !get(isTooltipPinned)) {
      hideTooltip();
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
    
    // Check if clicking on a point
    const clickedPoint = diagram.findPointNear(worldPos, selectionRadius);
      
    if (e.ctrlKey) {      
      if (clickedPoint) {
        // Toggle point selection
        togglePointSelection(clickedPoint.iri);
      } else {
        // Start rectangular selection
        startSelecting(worldPos);
      }
    } else if (currentState.selectedPoints.size > 0) {
      
      // Check if clicking on a selected point for dragging
      if (clickedPoint && currentState.selectedPoints.has(clickedPoint.iri)) {
        // Start dragging selected points, track ALT key state
        startDragging(worldPos, e.altKey);
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
    
    zoomViewport({ x: mouseX, y: mouseY }, e.deltaY);
    
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

  // Feature functions that were previously in AppState.ts
  // Now delegate to appropriate services

  /**
   * Add a new point to a line in the diagram
   */
  async function addNewPointToLine( 
      object: DiagramObjectModel,
      position: Point2D,
      insertIndex: number) {
    pointService.addNewPointToLine(object, position, insertIndex);
  }

  /**
   * Delete a point from a line in the diagram
   */
  async function deletePointFromLine(point: PointModel) {
    pointService.deletePointFromLine(point);
  }

  /**
   * Copy selected diagram objects to clipboard
   */
  function copySelectedDiagramObjects() {
    // This would be implemented in ObjectService in the new architecture
    objectService.copySelectedDiagramObjects();
  }

  /**
   * Paste copied diagram objects at a specific position
   */
  function pasteDiagramObjects(position: Point2D) {
    objectService.pasteDiagramObjects(position);
  }

  /**
   * Delete selected diagram objects
   */
  function deleteSelectedDiagramObjects() {
    objectService.deleteSelectedDiagramObjects();
  }

  /**
   * Rotate selected objects around the center of selection
   */
  function rotateSelectedObjects(degrees: number) {
    objectService.rotateSelectedObjects(degrees);
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