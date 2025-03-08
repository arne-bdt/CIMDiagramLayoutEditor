import { writable, derived, get } from 'svelte/store';
import type { 
  ViewTransform, 
  InteractionState, 
  Point2D, 
  PointUpdateData
} from '../models/types';
import { InteractionMode, CGMESVersion } from '../models/types';
import type { DiagramModel } from '../models/DiagramModel';
import type { PointModel } from '../models/PointModel';
import { AppConfig } from '../utils/config';

// CGMES state
export const cgmesVersion = writable<CGMESVersion>(CGMESVersion.V3_0);
export const cimNamespace = derived(
  cgmesVersion,
  $version => AppConfig.namespaces[$version]
);

// View transformation state
export const viewTransform = writable<ViewTransform>({
  scale: AppConfig.view.initialScale,
  offsetX: AppConfig.view.initialOffsetX,
  offsetY: AppConfig.view.initialOffsetY
});

// Diagram data
export const diagramData = writable<DiagramModel | null>(null);

// UI state
export const isLoading = writable<boolean>(false);
export const statusText = writable<string>('Ready');
export const coordinates = writable<Point2D>({ x: 0, y: 0 });
export const diagramList = writable<{iri: string, name: string}[]>([]);
export const selectedDiagram = writable<string>('');
export const errorMessage = writable<string | null>(null);

// Define initial interaction state
const initialInteractionState: InteractionState = {
  mode: InteractionMode.NONE,
  dragStart: null,
  dragEnd: null,
  panStart: null,
  selectedPoints: new Set<string>(),
  originalPositions: new Map<string, Point2D>()
};

// Interaction state
export const interactionState = writable<InteractionState>(initialInteractionState);

// Selected Points
export const selectedPoints = derived(
  interactionState,
  $state => $state.selectedPoints
);

// Event bus
export const positionUpdateEvent = writable<PointUpdateData | null>(null);

// Helper functions
export function resetViewTransform(): void {
  viewTransform.set({
    scale: AppConfig.view.initialScale,
    offsetX: AppConfig.view.initialOffsetX,
    offsetY: AppConfig.view.initialOffsetY
  });
}

export function clearSelection(): void {
  interactionState.update(state => ({
    ...state,
    selectedPoints: new Set<string>()
  }));
}

export function setLoading(loading: boolean): void {
  isLoading.set(loading);
}

export function updateStatus(text: string): void {
  statusText.set(text);
}

export function updateCoordinates(point: Point2D): void {
  coordinates.set({
    x: Math.round(point.x),
    y: Math.round(point.y)
  });
}

export function setCGMESVersion(version: CGMESVersion): void {
  cgmesVersion.set(version);
  clearSelection();
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

export function startDragging(position: Point2D): void {
  const currentDiagram = get(diagramData);
  if (!currentDiagram) return;
  
  const currentState = get(interactionState);
  
  // Store original positions
  const originalPositions = new Map<string, Point2D>();
  
  if (currentDiagram.points && Array.isArray(currentDiagram.points)) {
    currentDiagram.points.forEach((point: PointModel) => {
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
    originalPositions
  }));
}

export function updateDragging(position: Point2D): void {
  const currentState = get(interactionState);
  const currentDiagram = get(diagramData);
  
  if (!currentState || !currentDiagram || 
      currentState.mode !== InteractionMode.DRAGGING || 
      !currentState.dragStart) {
    return;
  }
  
  // Calculate delta
  const dx = position.x - currentState.dragStart.x;
  const dy = position.y - currentState.dragStart.y;
  
  // Update positions for preview
  if (currentDiagram.points && Array.isArray(currentDiagram.points)) {
    currentDiagram.points.forEach((point: PointModel) => {
      if (currentState.selectedPoints.has(point.iri)) {
        const original = currentState.originalPositions.get(point.iri);
        if (original) {
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

export function endDragging(position: Point2D): PointUpdateData | null {
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
  
  const result: PointUpdateData = {
    points: Array.from(currentState.selectedPoints),
    dx,
    dy
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
    currentDiagram.points.forEach((point: PointModel) => {
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
    currentDiagram.points.forEach((point: PointModel) => {
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

export function zoom(center: Point2D, delta: number): void {
  const currentTransform = get(viewTransform);
  
  // Calculate zoom factor
  const zoomFactor = delta < 0 ? AppConfig.canvas.zoomFactor : 1 / AppConfig.canvas.zoomFactor;
  const newScale = currentTransform.scale * zoomFactor;
  
  // Calculate new offsets to zoom at mouse position
  const newOffsetX = center.x - (center.x - currentTransform.offsetX) * zoomFactor;
  const newOffsetY = center.y - (center.y - currentTransform.offsetY) * zoomFactor;
  
  // Update view transform
  viewTransform.set({
    scale: newScale,
    offsetX: newOffsetX,
    offsetY: newOffsetY
  });
}