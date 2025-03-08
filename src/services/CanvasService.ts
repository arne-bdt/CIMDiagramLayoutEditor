import type { DiagramModel } from '../models/DiagramModel';
import type { 
  InteractionState, 
  ViewTransform,
  InteractionMode
} from '../models/types';
import { AppConfig } from '../utils/config';
import { getDynamicSize } from '../utils/geometry';
import { 
  renderSelectionRectangle, 
  renderLineOrPolygon,
  renderPoint,
  renderTextObject
} from '../utils/canvas';

/**
 * Service for canvas rendering
 */
export class CanvasService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  
  /**
   * Set canvas element
   * 
   * @param canvas - Canvas HTML element
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }
  
  /**
   * Render the diagram to the canvas
   * 
   * @param diagram - Diagram model
   * @param viewTransform - View transformation
   * @param interactionState - Current interaction state
   */
  render(
    diagram: DiagramModel | null,
    viewTransform: ViewTransform,
    interactionState: InteractionState
  ): void {
    if (!this.canvas || !this.ctx) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!diagram || diagram.objects.length === 0) {
      return;
    }
    
    // Apply view transform
    this.ctx.save();
    this.ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    this.ctx.scale(viewTransform.scale, viewTransform.scale);
    
    // Sort objects by drawing order
    const sortedObjects = [...diagram.objects].sort((a, b) => a.drawingOrder - b.drawingOrder);
    
    // Calculate point radius based on zoom level
    const pointRadius = getDynamicSize(
      AppConfig.canvas.pointSize,
      viewTransform.scale
    );
    
    // Render each object
    for (const object of sortedObjects) {
      if (object.points.length === 0) {
        continue;
      }
      
      if (object.points.length === 1) {
        // Render single point as a dot
        renderPoint(
          this.ctx,
          object.points[0],
          pointRadius,
          interactionState.selectedPoints.has(object.points[0].iri),
          true
        );
      } else {
        // Render connected points
        renderLineOrPolygon(
          this.ctx,
          object,
          interactionState.selectedPoints,
          viewTransform
        );
      }
      
      // Render text for TextDiagramObject elements
      if (object.isText && object.textContent && object.points.length > 0) {
        renderTextObject(this.ctx, object, viewTransform);
      }
    }
    
    // Render selection rectangle if selecting
    if (
      interactionState.mode === 'selecting' &&
      interactionState.dragStart &&
      interactionState.dragEnd
    ) {
      renderSelectionRectangle(
        this.ctx,
        interactionState.dragStart,
        interactionState.dragEnd,
        viewTransform
      );
    }
    
    this.ctx.restore();
  }
}

// Create singleton instance for use throughout the application
export const canvasService = new CanvasService();