import { writable, derived, get } from 'svelte/store';
import type { InteractionState, Point2D, MovePointsByDeltaData } from '../../core/models/types';
import { InteractionMode } from '../../core/models/types';
import { viewTransform, gridSize } from '../canvas/CanvasState';
import { diagramData } from '../diagram/DiagramState';
import { AppConfig } from '../../core/config/AppConfig';

// Define initial interaction state
const initialInteractionState: InteractionState = {
  mode: InteractionMode.NONE,
  dragStart: null,
  dragEnd: null,
  dragAnchorPoint: null,
  panStart: null,
  selectedPoints: new Set<string>(),
  originalPositions: new Map<string, Point2D>(),
  altKeyPressed: false
};

// Interaction state
export const interactionState = writable<InteractionState>(initialInteractionState);

// Selected Points (derived)
export const selectedPoints = derived(
  interactionState,
  $state => $state.selectedPoints
);

// Event bus
export const positionUpdateEvent = writable<MovePointsByDeltaData | null>(null);

// Selection functions
export function clearSelection(): void {
  interactionState.update(state => ({
    ...state,
    selectedPoints: new Set<string>()
  }));
}

export function togglePointSelection(pointIri: string): void {
  interactionState.update(state => {
    const newSelectedPoints = new Set(state.selectedPoints);
    if (newSelectedPoints.has(pointIri)) {
      newSelectedPoints.delete(pointIri);
    } else {
      newSelectedPoints.add(pointIri);
    }
    return {
      ...state,
      selectedPoints: newSelectedPoints
    };
  });
}

// Dragging functions
export function startDragging(position: Point2D, altKeyPressed: boolean = false): void {
  const currentDiagram = get(diagramData);
  if (!currentDiagram) return;
  
  const currentState = get(interactionState);
  
  // Store original positions
  const originalPositions = new Map<string, Point2D>();
  let dragAnchorPoint: string | null = null;
  
  // Find the initial point that's being dragged (closest to the start position)
  const currentTransform = get(viewTransform);
  const selectionRadius = AppConfig.canvas.selectionThreshold * 
    Math.pow(currentTransform.scale, -0.3);
  
  const clickedPoint = currentDiagram.findPointNear(position, selectionRadius);
  
  if (clickedPoint && currentState.selectedPoints.has(clickedPoint.iri)) {
    dragAnchorPoint = clickedPoint.iri;
  } else if (currentState.selectedPoints.size > 0) {
    // If no specific point was clicked, use the first selected point as anchor
    dragAnchorPoint = Array.from(currentState.selectedPoints)[0];
  }
  
  if (currentDiagram.points && Array.isArray(currentDiagram.points)) {
    currentDiagram.points.forEach((point) => {
      if (currentState.selectedPoints.has(point.iri)) {
        originalPositions.set(point.iri, { x: point.x, y: point.y });
      }
    });
  }
  
  interactionState.update(state => ({
    ...state,
    mode: InteractionMode.DRAGGING,
    dragStart: position,
    dragEnd: position,
    dragAnchorPoint,
    originalPositions,
    altKeyPressed // Store the ALT key state for snap-to-grid control
  }));
}

/**
 * Snap a coordinate value to the nearest grid line
 */
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function updateDragging(position: Point2D, altKeyPressed: boolean = false): void {
  const currentState = get(interactionState);
  const currentDiagram = get(diagramData);
  
  if (!currentState || !currentDiagram || 
      currentState.mode !== InteractionMode.DRAGGING || 
      !currentState.dragStart) {
    return;
  }
  
  // Calculate base delta
  let dx = position.x - currentState.dragStart.x;
  let dy = position.y - currentState.dragStart.y;
  
  // Update the ALT key state in the interaction state
  interactionState.update(state => ({
    ...state,
    altKeyPressed
  }));
    
  // By default, snap to grid. Only disable snapping when ALT is pressed
  const isSnapEnabled = !altKeyPressed;
  
  // If we have an anchor point and snapping is enabled (ALT key is NOT pressed),
  // adjust the deltas to ensure the anchor point snaps to the grid
  if (isSnapEnabled && currentState.dragAnchorPoint) {
    const originalAnchor = currentState.originalPositions.get(currentState.dragAnchorPoint);
    
    if (originalAnchor) {
      // Calculate where the anchor point would be without snapping
      const unsnappedX = originalAnchor.x + dx;
      const unsnappedY = originalAnchor.y + dy;
      
      // Calculate where the anchor point should be with snapping
      const snappedX = snapToGrid(unsnappedX, get(gridSize));
      const snappedY = snapToGrid(unsnappedY, get(gridSize));
      
      // Adjust the deltas to account for the snap
      dx += (snappedX - unsnappedX);
      dy += (snappedY - unsnappedY);
    }
  }
  
  // Update positions for preview using the adjusted deltas
  if (currentDiagram.points && Array.isArray(currentDiagram.points)) {
    currentDiagram.points.forEach((point) => {
      if (currentState.selectedPoints.has(point.iri)) {
        const original = currentState.originalPositions.get(point.iri);
        if (original) {
          // Apply the adjusted deltas to maintain relative positions
          point.x = original.x + dx;
          point.y = original.y + dy;
        }
      }
    });
  }
  
  interactionState.update(state => ({
    ...state,
    dragEnd: position
  }));
  
  // Force diagram update
  diagramData.set(currentDiagram);
}

export function endDragging(position: Point2D): MovePointsByDeltaData | null {
  const currentState = get(interactionState);
  
  if (!currentState || 
      currentState.mode !== InteractionMode.DRAGGING || 
      !currentState.dragStart) {
    return null;
  }
  
  const dx = position.x - currentState.dragStart.x;
  const dy = position.y - currentState.dragStart.y;
  
  // Reset interaction state
  interactionState.update(state => ({
    ...state,
    mode: InteractionMode.NONE,
    dragStart: null,
    dragEnd: null
  }));
  
  // Check if drag was significant
  const isSignificant = Math.abs(dx) > AppConfig.dragThreshold || Math.abs(dy) > AppConfig.dragThreshold;
  
  if (!isSignificant) {
    revertDraggedPositions();
    return null;
  }
  
  const result: MovePointsByDeltaData = {
    pointIris: Array.from(currentState.selectedPoints),
    deltaVector: { dx,  dy } 
  };
  
  // Trigger position update event
  positionUpdateEvent.set(result);
  
  return result;
}

export function revertDraggedPositions(): void {
  const currentState = get(interactionState);
  const currentDiagram = get(diagramData);
  
  if (!currentState || !currentDiagram) {
    return;
  }
  
  // Revert positions
  if (currentDiagram.points && Array.isArray(currentDiagram.points)) {
    currentDiagram.points.forEach((point) => {
      if (currentState.selectedPoints.has(point.iri)) {
        const original = currentState.originalPositions.get(point.iri);
        if (original) {
          point.x = original.x;
          point.y = original.y;
        }
      }
    });
  }
  
  // Force diagram update
  diagramData.set(currentDiagram);
}

// Selection rectangle functions
export function startSelecting(position: Point2D): void {
  interactionState.update(state => ({
    ...state,
    mode: InteractionMode.SELECTING,
    dragStart: position,
    dragEnd: position
  }));
}

export function updateSelecting(position: Point2D): void {
  interactionState.update(state => ({
    ...state,
    dragEnd: position
  }));
}

export function completeSelecting(): void {
  const currentState = get(interactionState);
  const currentDiagram = get(diagramData);
  
  if (!currentState || !currentDiagram || 
      currentState.mode !== InteractionMode.SELECTING || 
      !currentState.dragStart || !currentState.dragEnd) {
    return;
  }
  
  // Create selection bounds
  const startX = Math.min(currentState.dragStart.x, currentState.dragEnd.x);
  const startY = Math.min(currentState.dragStart.y, currentState.dragEnd.y);
  const endX = Math.max(currentState.dragStart.x, currentState.dragEnd.x);
  const endY = Math.max(currentState.dragStart.y, currentState.dragEnd.y);
  
  // If selection is too small, cancel
  if (Math.abs(endX - startX) <= 3 || Math.abs(endY - startY) <= 3) {
    interactionState.update(state => ({
      ...state,
      mode: InteractionMode.NONE,
      dragStart: null,
      dragEnd: null
    }));
    return;
  }
  
  // Find points in selection rectangle
  const newSelectedPoints = new Set<string>(currentState.selectedPoints);
  
  if (currentDiagram.points && Array.isArray(currentDiagram.points)) {
    currentDiagram.points.forEach((point) => {
      if (point.x >= startX && point.x <= endX && point.y >= startY && point.y <= endY) {
        newSelectedPoints.add(point.iri);
      }
    });
  }
  
  // Update state
  interactionState.update(state => ({
    ...state,
    mode: InteractionMode.NONE,
    dragStart: null,
    dragEnd: null,
    selectedPoints: newSelectedPoints
  }));
}

// Pan functions
export function startPanning(position: Point2D): void {
  interactionState.update(state => ({
    ...state,
    mode: InteractionMode.PANNING,
    panStart: position
  }));
}

export function updatePanning(position: Point2D): void {
  const currentState = get(interactionState);
  
  if (!currentState || 
      currentState.mode !== InteractionMode.PANNING || 
      !currentState.panStart) {
    return;
  }
  
  // Calculate pan delta
  const dx = position.x - currentState.panStart.x;
  const dy = position.y - currentState.panStart.y;
  
  // Update view transform
  viewTransform.update(transform => ({
    ...transform,
    offsetX: transform.offsetX + dx,
    offsetY: transform.offsetY + dy
  }));
  
  // Update pan start position
  interactionState.update(state => ({
    ...state,
    panStart: position
  }));
}

export function endPanning(): void {
  interactionState.update(state => ({
    ...state,
    mode: InteractionMode.NONE,
    panStart: null
  }));
}