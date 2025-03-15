import type { 
  Point2D, 
  ViewTransform, 
  Bounds, 
  DrawingPointConfig 
} from '../core/models/types';
import type { DiagramModel, DiagramObjectModel } from '../core/models/DiagramModel';

/**
 * Calculate the squared distance between two points
 * 
 * @param x1 - First point X
 * @param y1 - First point Y
 * @param x2 - Second point X
 * @param y2 - Second point Y
 * @returns Distance between the points squared
 */
export function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Convert screen coordinates to world coordinates
 * 
 * @param screenX - Screen X coordinate
 * @param screenY - Screen Y coordinate
 * @param viewTransform - Current view transformation
 * @returns World coordinates
 */
export function screenToWorld(screenX: number, screenY: number, viewTransform: ViewTransform): Point2D {
  return {
    x: (screenX - viewTransform.offsetX) / viewTransform.scale,
    y: (screenY - viewTransform.offsetY) / viewTransform.scale
  };
}

/**
 * Convert world coordinates to screen coordinates
 * 
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param viewTransform - Current view transformation
 * @returns Screen coordinates
 */
export function worldToScreen(worldX: number, worldY: number, viewTransform: ViewTransform): Point2D {
  return {
    x: worldX * viewTransform.scale + viewTransform.offsetX,
    y: worldY * viewTransform.scale + viewTransform.offsetY
  };
}

/**
 * Calculate dynamic size based on zoom level
 * 
 * @param sizeConfig - Size configuration 
 * @param scale - Current zoom scale
 * @returns Adjusted size
 */
export function getDynamicSize(sizeConfig: DrawingPointConfig, scale: number): number {
  return Math.max(
    sizeConfig.min, 
    Math.min(
      sizeConfig.max, 
      sizeConfig.base * Math.pow(scale, -0.3)
    )
  );
}

/**
 * Add padding to diagram bounds
 * 
 * @param bounds - Original bounds
 * @param padding - Padding factor (0.05 = 5%)
 * @returns Bounds with padding
 */
export function addPaddingToBounds(bounds: Bounds, padding: number): Bounds {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  
  return {
    minX: bounds.minX - width * padding,
    minY: bounds.minY - height * padding,
    maxX: bounds.maxX + width * padding,
    maxY: bounds.maxY + height * padding
  };
}

/**
 * Calculate scale to fit bounds in canvas
 * 
 * @param bounds - Bounds to fit
 * @param canvasWidth - Canvas width
 * @param canvasHeight - Canvas height
 * @param maxScale - Maximum scale (default 1.0)
 * @returns Scale factor
 */
export function calculateFitScale(
  bounds: Bounds, 
  canvasWidth: number, 
  canvasHeight: number, 
  maxScale: number = 1.0
): number {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  
  if (width === 0 || height === 0) {
    return maxScale;
  }
  
  const scaleX = canvasWidth / width;
  const scaleY = canvasHeight / height;
  
  return Math.min(scaleX, scaleY, maxScale);
}

/**
 * Calculate the squared distance from a point to a line segment
 * 
 * @param point - Point coordinates
 * @param lineStart - Line segment start coordinates
 * @param lineEnd - Line segment end coordinates
 * @returns Distance squared and projected point on the line
 */
export function pointToLineDistanceSquared(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): { distanceSquared: number; projectedPoint: Point2D } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  // Line segment is a point
  if (dx === 0 && dy === 0) {
    return {
      distanceSquared: distanceSquared(point.x, point.y, lineStart.x, lineStart.y),
      projectedPoint: { x: lineStart.x, y: lineStart.y }
    };
  }
  
  // Calculate projection of point onto line
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared));
  
  const projectedPoint = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };
  
  return {
    distanceSquared: distanceSquared(point.x, point.y, projectedPoint.x, projectedPoint.y),
    projectedPoint
  };
}

/**
 * Find the closest line segment to a point in the diagram
 * 
 * @param point - Point coordinates to check against
 * @param diagram - Diagram model
 * @param maxDistance - Maximum distance to consider
 * @returns Object with line segment information or null if none found
 */
export function findClosestLineSegment(
  point: Point2D,
  diagram: DiagramModel,
  maxDistance: number
): { 
  object: DiagramObjectModel; 
  index: number;
  position: Point2D;
  distance: number; 
} | null {
  let closestDistance = maxDistance * maxDistance;
  let result = null;
  
  // Check all objects with at least 2 points
  for (const object of diagram.objects) {
    if (object.points.length < 2) continue;
    
    // Check each line segment
    for (let i = 0; i < object.points.length - 1; i++) {
      const p1 = { x: object.points[i].x, y: object.points[i].y };
      const p2 = { x: object.points[i+1].x, y: object.points[i+1].y };
      
      const { distanceSquared: dist, projectedPoint } = pointToLineDistanceSquared(point, p1, p2);
      
      if (dist < closestDistance) {
        closestDistance = dist;
        result = {
          object,
          index: i + 1, // Insert position (after p1)
          position: projectedPoint,
          distance: Math.sqrt(dist)
        };
      }
    }
    
    // Check last-to-first segment if polygon
    if (object.isPolygon && object.points.length > 2) {
      const p1 = { 
        x: object.points[object.points.length - 1].x, 
        y: object.points[object.points.length - 1].y 
      };
      const p2 = { x: object.points[0].x, y: object.points[0].y };
      
      const { distanceSquared: dist, projectedPoint } = pointToLineDistanceSquared(point, p1, p2);
      
      if (dist < closestDistance) {
        closestDistance = dist;
        result = {
          object,
          index: 0, // Insert at beginning (for visual continuity in polygon)
          position: projectedPoint,
          distance: Math.sqrt(dist)
        };
      }
    }
  }
  
  return result;
}