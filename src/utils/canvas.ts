import type { PointModel } from '../models/PointModel';
import type { DiagramObjectModel } from '../models/DiagramModel';
import type { ViewTransform, Point2D, DrawingPointConfig } from '../models/types';
import { AppConfig } from './config';
import { getDynamicSize } from './geometry';

/**
 * Resize canvas to fit its container
 * 
 * @param canvas - Canvas element
 * @param container - Container element
 */
export function resizeCanvas(canvas: HTMLCanvasElement, container: HTMLElement): void {
  if (!canvas || !container) return;
  
  // Set canvas dimensions to match container size
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  // Also set the CSS dimensions to match
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

/**
 * Render a single point on the canvas
 * 
 * @param ctx - Canvas context
 * @param point - Point model to render
 * @param radius - Point radius
 * @param isSelected - Whether point is selected
 * @param isSinglePoint - Whether this is a standalone point
 */
export function renderPoint(
  ctx: CanvasRenderingContext2D,
  point: PointModel,
  radius: number,
  isSelected: boolean,
  isSinglePoint: boolean = false
): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  
  if (isSelected) {
    ctx.fillStyle = AppConfig.canvas.colors.selectedPoint;
  } else if (isSinglePoint) {
    ctx.fillStyle = AppConfig.canvas.colors.singlePoint;
  } else {
    ctx.fillStyle = AppConfig.canvas.colors.regularPoint;
  }
  
  ctx.fill();
}

/**
 * Render a line or polygon
 * 
 * @param ctx - Canvas context
 * @param object - Diagram object to render
 * @param selectedPoints - Set of selected point IRIs
 * @param viewTransform - Current view transformation
 */
export function renderLineOrPolygon(
  ctx: CanvasRenderingContext2D,
  object: DiagramObjectModel,
  selectedPoints: Set<string>,
  viewTransform: ViewTransform
): void {
  if (object.points.length < 2) return;

  // Calculate point radius based on zoom level
  const pointRadius = getDynamicSize(
    AppConfig.canvas.pointSize,
    viewTransform.scale
  );
  
  // Draw the line/polygon
  ctx.beginPath();
  ctx.moveTo(object.points[0].x, object.points[0].y);
  
  for (let i = 1; i < object.points.length; i++) {
    ctx.lineTo(object.points[i].x, object.points[i].y);
  }
  
  // Close the path if it's a polygon
  if (object.isPolygon) {
    ctx.closePath();
  }
  
  ctx.strokeStyle = AppConfig.canvas.colors.line;
  ctx.lineWidth = 1 / viewTransform.scale;
  ctx.stroke();
  
  // Draw points
  for (const point of object.points) {
    renderPoint(
      ctx, 
      point, 
      pointRadius, 
      selectedPoints.has(point.iri),
      false
    );
  }
}

/**
 * Render text object
 * 
 * @param ctx - Canvas context
 * @param object - Text object to render
 * @param viewTransform - Current view transformation
 */
export function renderTextObject(
  ctx: CanvasRenderingContext2D,
  object: DiagramObjectModel,
  viewTransform: ViewTransform
): void {
  if (!object.isText || !object.textContent || object.points.length === 0) {
    return;
  }
  
  const textPoint = object.points[0]; // Use first point for text position
  
  // Scale font based on zoom level
  const fontSize = getDynamicSize(
    AppConfig.canvas.fontSize,
    viewTransform.scale
  );
  
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(object.textContent, textPoint.x, textPoint.y);
}

/**
 * Render selection rectangle
 * 
 * @param ctx - Canvas context
 * @param start - Start point in world coordinates
 * @param end - End point in world coordinates
 * @param viewTransform - Current view transformation
 */
export function renderSelectionRectangle(
  ctx: CanvasRenderingContext2D,
  start: Point2D,
  end: Point2D,
  viewTransform: ViewTransform
): void {
  const startX = Math.min(start.x, end.x);
  const startY = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  
  ctx.strokeStyle = AppConfig.canvas.colors.selectionRectangle;
  ctx.lineWidth = 2 / viewTransform.scale;
  ctx.setLineDash([]);
  ctx.strokeRect(startX, startY, width, height);
}