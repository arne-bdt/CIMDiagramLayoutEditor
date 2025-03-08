import { writable, derived, get } from 'svelte/store';
import type { 
  ViewTransform, 
  InteractionState, 
  Point2D, 
  PointUpdateData,
  Bounds
} from '../models/types';
import { InteractionMode, CGMESVersion } from '../models/types';
import type { DiagramModel } from '../models/DiagramModel';
import { DiagramObjectModel } from '../models/DiagramModel';
import { PointModel } from '../models/PointModel';
import { AppConfig } from '../utils/config';
import { sparqlService } from './SparqlService';
import { diagramService } from './DiagramService';
import { v4 as uuidv4 } from 'uuid';

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

/**
 * Add a new point to a line in the diagram
 * 
 * @param object - Diagram object to add the point to
 * @param position - Position of the new point
 * @param insertIndex - Index where to insert the point
 */
export async function addNewPointToLine(
  object: DiagramObjectModel,
  position: Point2D,
  insertIndex: number
): Promise<void> {
  if (!object || !position || insertIndex === undefined) return;
  
  const currentDiagram = get(diagramData);
  if (!currentDiagram) return;
  
  // Generate a new unique IRI for the point
  // In a real application, this would be a proper URI following CGMES conventions
  const newPointIri = `http://tempuri.org/point/${uuidv4()}`;

  try {
    setLoading(true);
    updateStatus('Adding new point...');
    
    
    
    // Create new point
    const newPoint = new PointModel(
      newPointIri,
      position.x,
      position.y,
      insertIndex, // Initial sequence number at insert position
      object
    );
    
    // Insert the point into the object's points array
    object.points.splice(insertIndex, 0, newPoint);
    
    // Update sequence numbers for all points in the object
    object.points.forEach((point, index) => {
      point.sequenceNumber = index;
    });
    
    // Add point to the diagram's points collection
    currentDiagram.points.push(newPoint);
    
    // Update the diagram in the UI
    diagramData.set(currentDiagram);
    
    // Get the current namespace
    const namespace = get(cimNamespace);
    
    // Create data for SPARQL update
    const pointUpdateData = {
      iri: newPointIri,
      objectIri: object.iri,
      x: position.x,
      y: position.y,
      sequenceNumber: insertIndex
    };
    
    // Prepare sequence number updates for all points in the object
    const sequenceUpdates = object.points.map(point => ({
      iri: point.iri,
      sequenceNumber: point.sequenceNumber
    }));
    
    // Persist changes to the database
    await sparqlService.insertNewPoint(
      pointUpdateData,
      sequenceUpdates,
      namespace
    );
    
    updateStatus('New point added');
    
    // Select the newly added point
    clearSelection();
    togglePointSelection(newPointIri);
    
  } catch (error) {
    console.error('Error adding new point:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // If there was an error, revert the change in the UI
    if (currentDiagram && object) {
      // Remove the new point
      object.points = object.points.filter(p => p.iri !== newPointIri);
      
      // Reset sequence numbers
      object.points.forEach((point, index) => {
        point.sequenceNumber = index;
      });
      
      // Remove from diagram points collection
      currentDiagram.points = currentDiagram.points.filter(p => p.iri !== newPointIri);
      
      // Update the diagram
      diagramData.set(currentDiagram);
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Delete a point from a line in the diagram
 * 
 * @param point - Point to delete
 */
export async function deletePointFromLine(point: PointModel): Promise<void> {
  if (!point) return;
  
  const currentDiagram = get(diagramData);
  if (!currentDiagram) return;
  
  // Get the parent object
  const object = point.parentObject;
  if (!object) {
    updateStatus('Cannot delete point: parent object not found');
    return;
  }
  
  try {
    // Check if the point is first or last in its object
    const pointIndex = object.points.findIndex(p => p.iri === point.iri);
    
    // For non-polygon objects (lines), prevent deletion of first and last points
    if (!object.isPolygon && (pointIndex === 0 || pointIndex === object.points.length - 1)) {
      updateStatus('Cannot delete first or last point of a line');
      return;
    }
    
    // At this point we know we can delete the point
    setLoading(true);
    updateStatus('Deleting point...');
    
    // Save the initial polygon state
    const wasPolygon = object.isPolygon;
    
    // Check if we need to update the polygon property
    const needsPolygonUpdate = wasPolygon && object.points.length <= 3;
    
    // Remove the point from the object's points array
    object.points.splice(pointIndex, 1);
    
    // If we have fewer than 3 points and it was a polygon, remove the polygon property
    if (needsPolygonUpdate) {
      object.isPolygon = false;
    }
    
    // Update sequence numbers for all remaining points
    object.points.forEach((p, index) => {
      p.sequenceNumber = index;
    });
    
    // Remove from diagram points collection
    const diagramPointIndex = currentDiagram.points.findIndex(p => p.iri === point.iri);
    if (diagramPointIndex >= 0) {
      currentDiagram.points.splice(diagramPointIndex, 1);
    }
    
    // Update the diagram in the UI
    diagramData.set(currentDiagram);
    
    // Get the current namespace
    const namespace = get(cimNamespace);
    
    // Prepare sequence number updates for all points in the object
    const sequenceUpdates = object.points.map(p => ({
      iri: p.iri,
      sequenceNumber: p.sequenceNumber
    }));
    
    // Persist changes to the database
    if (needsPolygonUpdate) {
      // If we need to update the polygon property, do it in one transaction
      await sparqlService.deletePointAndUpdatePolygon(
        point.iri,
        object.iri,
        false, // Set isPolygon to false
        sequenceUpdates,
        namespace
      );
    } else {
      // Just delete the point
      await sparqlService.deletePoint(
        point.iri,
        sequenceUpdates,
        namespace
      );
    }
    
    updateStatus('Point deleted successfully');
    
    // Clear selection if the deleted point was selected
    interactionState.update(state => {
      if (state.selectedPoints.has(point.iri)) {
        const newSelectedPoints = new Set(state.selectedPoints);
        newSelectedPoints.delete(point.iri);
        return {
          ...state,
          selectedPoints: newSelectedPoints
        };
      }
      return state;
    });
    
  } catch (error) {
    console.error('Error deleting point:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // If there was an error, revert the change in the UI
    if (currentDiagram && object) {
      // Reload the diagram
      const diagramIri = get(selectedDiagram);
      if (diagramIri) {
        await diagramService.loadDiagramLayout(diagramIri);
      }
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Toggle the isPolygon property of a diagram object
 * 
 * @param object - The diagram object to update
 * @param isPolygon - New value for the isPolygon property
 */
export async function togglePolygonProperty(
  object: DiagramObjectModel,
  isPolygon: boolean
): Promise<void> {
  if (!object) return;
  
  const currentDiagram = get(diagramData);
  if (!currentDiagram) return;
  
  // Check if we have enough points to form a polygon (minimum 3)
  if (isPolygon && object.points.length < 3) {
    updateStatus('Cannot create polygon: at least 3 points are required');
    return;
  }
  
  try {
    setLoading(true);
    updateStatus(`${isPolygon ? 'Creating' : 'Removing'} polygon...`);
    
    // Update object property locally
    object.isPolygon = isPolygon;
    
    // Update the diagram in the UI
    diagramData.set(currentDiagram);
    
    // Get the current namespace
    const namespace = get(cimNamespace);
    
    // Persist changes to the database
    await sparqlService.updatePolygonProperty(
      object.iri,
      isPolygon,
      namespace
    );
    
    updateStatus(`Polygon ${isPolygon ? 'created' : 'removed'} successfully`);
    
  } catch (error) {
    console.error('Error updating polygon property:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // If there was an error, revert the change in the UI
    if (object) {
      object.isPolygon = !isPolygon; // Revert to previous state
      
      // Update the diagram
      if (currentDiagram) {
        diagramData.set(currentDiagram);
      }
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Copy selected points' parent DiagramObjects to clipboard
 * This ensures we always copy complete DiagramObjects, not partial selections
 */
export function copySelectedDiagramObjects(): void {
  const currentState = get(interactionState);
  const currentDiagram = get(diagramData);
  
  if (!currentDiagram || currentState.selectedPoints.size === 0) {
    updateStatus('Nothing selected to copy');
    return;
  }
  
  // Find all parent DiagramObjects of selected points
  const objectIris = new Set<string>();
  
  currentState.selectedPoints.forEach(pointIri => {
    const point = currentDiagram.points.find(p => p.iri === pointIri);
    if (point && point.parentObject) {
      objectIris.add(point.parentObject.iri);
    }
  });
  
  if (objectIris.size === 0) {
    updateStatus('No objects to copy');
    return;
  }
  
  // Write object IRIs to clipboard
  const clipboardText = Array.from(objectIris).join('\n');
  navigator.clipboard.writeText(clipboardText)
    .then(() => {
      // Select all points of the copied objects
      selectAllPointsOfObjects(objectIris);
      updateStatus(`Copied ${objectIris.size} diagram object(s)`);
    })
    .catch(err => {
      console.error('Error writing to clipboard:', err);
      updateStatus('Error copying to clipboard');
    });
}

/**
 * Select all points that belong to the given DiagramObjects
 * 
 * @param objectIris - Set of DiagramObject IRIs
 */
function selectAllPointsOfObjects(objectIris: Set<string>): void {
  const currentDiagram = get(diagramData);
  if (!currentDiagram) return;
  
  // Create a new set of selected points
  const newSelectedPoints = new Set<string>();
  
  // Find all points that belong to the objects
  currentDiagram.points.forEach(point => {
    if (point.parentObject && objectIris.has(point.parentObject.iri)) {
      newSelectedPoints.add(point.iri);
    }
  });
  
  // Update selection state
  interactionState.update(state => ({
    ...state,
    selectedPoints: newSelectedPoints
  }));
}

/**
 * Calculate bounds of selected DiagramObjects
 * 
 * @param objectIris - Set of DiagramObject IRIs
 * @returns Bounds of selected objects
 */
function getObjectsBounds(objectIris: Set<string>): Bounds {
  const currentDiagram = get(diagramData);
  if (!currentDiagram || objectIris.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  currentDiagram.points.forEach(point => {
    if (point.parentObject && objectIris.has(point.parentObject.iri)) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  });
  
  return { minX, minY, maxX, maxY };
}

/**
 * Calculate center point of bounds
 * 
 * @param bounds - Bounds to find center of
 * @returns Center point
 */
function getBoundsCenter(bounds: Bounds): Point2D {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
}

/**
 * Paste copied DiagramObjects at the specified position
 * 
 * @param pastePosition - Position to paste at (will be the center of pasted objects)
 */
export async function pasteDiagramObjects(pastePosition: Point2D): Promise<void> {
  // Read object IRIs from clipboard
  let clipboardText: string;
  try {
    clipboardText = await navigator.clipboard.readText();
  } catch (err) {
    console.error('Error reading from clipboard:', err);
    updateStatus('Error reading from clipboard');
    return;
  }
  
  // Parse object IRIs
  const objectIris = new Set<string>(
    clipboardText.split('\n').filter(iri => iri.trim() !== '')
  );
  
  if (objectIris.size === 0) {
    updateStatus('No valid diagram objects in clipboard');
    return;
  }
  
  const currentDiagram = get(diagramData);
  if (!currentDiagram) {
    updateStatus('No diagram loaded');
    return;
  }
  
  // Start loading
  setLoading(true);
  console.log(`Pasting ${objectIris.size} diagram objects...`);
  updateStatus(`Pasting ${objectIris.size} diagram objects...`);
  
  try {
    // Find all objects with their points
    const originalObjects = currentDiagram.objects.filter(obj => 
      objectIris.has(obj.iri)
    );
    
    if (originalObjects.length === 0) {
      updateStatus('No matching objects found in diagram');
      setLoading(false);
      return;
    }
    
    // Calculate bounds of selected objects
    const bounds = getObjectsBounds(objectIris);
    
    // Calculate center of bounds
    const boundsCenter = getBoundsCenter(bounds);
    
    // Calculate offset from bounds center to paste position
    const offsetX = pastePosition.x - boundsCenter.x;
    const offsetY = pastePosition.y - boundsCenter.y;
    
    // Create copies of objects and points
    const newObjects: DiagramObjectModel[] = [];
    const newPoints: PointModel[] = [];
    const newSelectedPoints = new Set<string>();
    
    // Map from original IRI to new IRI for object references
    const iriMap = new Map<string, string>();
    
    // First create new objects
    for (const origObject of originalObjects) {
      // Generate new IRI
      const newObjectIri = `http://tempuri.org/diagramObject/${uuidv4()}`;
      iriMap.set(origObject.iri, newObjectIri);
      
      // Create copy of the object
      const newObject = new DiagramObjectModel(
        newObjectIri,
        origObject.drawingOrder,
        origObject.isPolygon,
        origObject.isText,
        origObject.textContent
      );
      
      newObjects.push(newObject);
    }
    
    // Then create new points for each object
    for (const origObject of originalObjects) {
      const newObjectIri = iriMap.get(origObject.iri);
      if (!newObjectIri) continue;
      
      const newObject = newObjects.find(obj => obj.iri === newObjectIri);
      if (!newObject) continue;
      
      // Create new points with adjusted positions
      for (const origPoint of origObject.points) {
        const newPointIri = `http://tempuri.org/point/${uuidv4()}`;
        
        // Apply offset to position
        const newX = origPoint.x + offsetX;
        const newY = origPoint.y + offsetY;
        
        const newPoint = new PointModel(
          newPointIri,
          newX,
          newY,
          origPoint.sequenceNumber,
          newObject
        );
        
        newObject.addPoint(newPoint);
        newPoints.push(newPoint);
        newSelectedPoints.add(newPointIri);
      }
    }
    
    // Add new objects and points to the diagram
    for (const obj of newObjects) {
      currentDiagram.addObject(obj);
    }
    
    for (const point of newPoints) {
      currentDiagram.addPoint(point);
    }
    
    // Update diagram
    diagramData.set(currentDiagram);
    
    // Clear original selection and select only the new points
    interactionState.update(state => ({
      ...state,
      selectedPoints: newSelectedPoints
    }));
    
    // Save to SPARQL
    await savePastedObjectsToSparql(newObjects, newPoints);
    
    updateStatus(`Pasted ${newObjects.length} diagram objects`);
  } catch (error) {
    console.error('Error pasting diagram objects:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setLoading(false);
  }
}

/**
 * Save pasted objects and points to the SPARQL endpoint
 * 
 * @param objects - New diagram objects
 * @param points - New diagram points
 */
async function savePastedObjectsToSparql(
  objects: DiagramObjectModel[],
  points: PointModel[]
): Promise<void> {
  const namespace = get(cimNamespace);
  const diagramIri = get(selectedDiagram);
  
  if (!diagramIri) {
    throw new Error('No diagram selected');
  }
  
  try {
    // Build and execute queries to save objects and points
    await sparqlService.insertClonedObjects(
      diagramIri,
      objects,
      points,
      namespace
    );
  } catch (error) {
    throw error;
  }
}