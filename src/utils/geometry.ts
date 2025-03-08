import { 
  Point2D, 
  ViewTransform, 
  Bounds, 
  DrawingPointConfig 
} from '../models/types';

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