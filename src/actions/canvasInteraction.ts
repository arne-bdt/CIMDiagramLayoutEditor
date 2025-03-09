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
  rotateSelectedObjects
} from '../services/AppState';
import { AppConfig } from '../utils/config';
import { get } from 'svelte/store';
import { screenToWorld } from '../utils/geometry';
import { findClosestLineSegment } from '../utils/geometry';
import { InteractionMode, type Point2D } from '@/models/types';
import { setHoveredPoint } from '../services/AppState';
import type { PointModel } from '@/models/PointModel';


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
  let hoverTimer: number | null = null;
  let currentHoveredPoint: PointModel | null = null;
  
  // Handle keyboard events for copy/paste
  function handleKeyDown(e: KeyboardEvent) {
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
    currentMouseWorldPos = worldPos;
    
    // Update coordinates display
    updateCoordinates(worldPos);
    
    const currentState = get(interactionState);
    
    // Reset hover timer if in an active interaction mode
    if (currentState.mode !== InteractionMode.NONE) {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      setHoveredPoint(null);
      currentHoveredPoint = null;
    }
    
    if (currentState.mode === InteractionMode.PANNING && currentState.panStart) {
      // Handle panning
      updatePanning({ x: screenX, y: screenY });
    } else if (currentState.mode === InteractionMode.SELECTING) {
      // Update selection rectangle
      updateSelecting(worldPos);
    } else if (currentState.mode === InteractionMode.DRAGGING) {
      // Update dragging positions
      updateDragging(worldPos);
    } else {
      // Only check for point hover when not in an active interaction mode
      // Clear any existing hover timer
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      
      // Set a small delay before showing tooltip to prevent flickering
      hoverTimer = setTimeout(() => {
        const diagram = get(diagramData);
        if (!diagram) return;
        
        // Calculate hover radius based on zoom level
        const hoverRadius = AppConfig.canvas.selectionThreshold * 
          Math.pow(currentTransform.scale, -0.3);
        
        // Find if we're hovering over a point
        const pointUnderMouse = diagram.findPointNear(worldPos, hoverRadius);
        
        // Only update if the hovered point changed
        if (pointUnderMouse !== currentHoveredPoint) {
          currentHoveredPoint = pointUnderMouse;
          setHoveredPoint(pointUnderMouse);
        }
      }, 200) as unknown as number;
    }
  }

  function handleMouseLeave() {
    // Clear hover state when mouse leaves canvas
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    setHoveredPoint(null);
    currentHoveredPoint = null;
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
  canvas.addEventListener('mouseleave', handleMouseLeave);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel);
  canvas.addEventListener('dblclick', handleDoubleClick);
  window.addEventListener('keydown', handleKeyDown);
  
  return {
    destroy() {
      // Remove event listeners on cleanup
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('keydown', handleKeyDown);
      // Clear any pending timer
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
      }
    }
  };
}