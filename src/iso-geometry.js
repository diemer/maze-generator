/**
 * Isometric Geometry Calculations
 * Pure functions for isometric projection - no DOM dependencies
 */

(function(root, factory) {
  // UMD pattern for browser/Node compatibility
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IsoGeometry = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  /**
   * Calculate isometric projection coordinates from grid position
   * @param {number} gridX - Grid column index (j in matrix)
   * @param {number} gridY - Grid row index (i in matrix)
   * @param {number} tileWidth - Width of tile in pixels
   * @param {number} tileHeight - Height of tile in pixels
   * @param {number} offsetX - X offset for centering
   * @param {number} offsetY - Y offset for centering
   * @returns {{isoX: number, isoY: number}}
   */
  function projectToIso(gridX, gridY, tileWidth, tileHeight, offsetX, offsetY) {
    return {
      isoX: (gridX - gridY) * tileWidth * 0.5 + offsetX,
      isoY: (gridX + gridY) * tileHeight * 0.5 + offsetY
    };
  }

  /**
   * Calculate isometric projection with configurable ratio
   * Common ratios:
   *   - 0.5: 2:1 pixel art style (~26.57°)
   *   - 0.577: True isometric (~30°, tan(30°))
   *   - 0.25: Flat 4:1 view
   *   - 0.75: Steep 4:3 view
   *
   * @param {number} gridX - Grid column index
   * @param {number} gridY - Grid row index
   * @param {number} tileWidth - Width of tile in pixels
   * @param {number} isoRatio - Ratio of height to width (0.5 = 2:1)
   * @param {number} offsetX - X offset
   * @param {number} offsetY - Y offset
   * @returns {{isoX: number, isoY: number}}
   */
  function projectToIsoWithRatio(gridX, gridY, tileWidth, isoRatio, offsetX, offsetY) {
    var tileHeight = tileWidth * isoRatio;
    return projectToIso(gridX, gridY, tileWidth, tileHeight, offsetX, offsetY);
  }

  /**
   * Calculate all 7 vertices of an isometric cube
   * @param {number} isoX - Center X in isometric space
   * @param {number} isoY - Top Y in isometric space
   * @param {number} tileWidth - Tile width
   * @param {number} tileHeight - Tile height
   * @param {number} cubeHeight - Height of the cube sides
   * @returns {Object} Vertex coordinates for cube rendering
   */
  function getCubeVertices(isoX, isoY, tileWidth, tileHeight, cubeHeight) {
    var halfWidth = tileWidth * 0.5;
    var halfHeight = tileHeight * 0.5;

    return {
      // Top face vertices
      topCenter: { x: isoX, y: isoY },
      topRight: { x: isoX + halfWidth, y: isoY + halfHeight },
      bottomCenter: { x: isoX, y: isoY + tileHeight },
      topLeft: { x: isoX - halfWidth, y: isoY + halfHeight },
      // Bottom face vertices (extended down by cubeHeight)
      bottomLeft: { x: isoX - halfWidth, y: isoY + halfHeight + cubeHeight },
      bottomRight: { x: isoX + halfWidth, y: isoY + halfHeight + cubeHeight },
      bottomCenterLow: { x: isoX, y: isoY + tileHeight + cubeHeight }
    };
  }

  /**
   * Calculate canvas dimensions needed for an isometric grid
   * @param {number} cols - Number of grid columns
   * @param {number} rows - Number of grid rows
   * @param {number} tileWidth - Tile width
   * @param {number} tileHeight - Tile height
   * @param {number} cubeHeight - Cube wall height
   * @param {number} scale - Display scale multiplier
   * @param {number} strokeMargin - Extra margin for strokes
   * @returns {{width: number, height: number, isoWidth: number, isoHeight: number}}
   */
  function getCanvasDimensions(cols, rows, tileWidth, tileHeight, cubeHeight, scale, strokeMargin) {
    var isoWidth = cols * tileWidth * 0.5;
    var isoHeight = rows * tileHeight * 0.5;

    return {
      isoWidth: isoWidth,
      isoHeight: isoHeight,
      width: (isoWidth * 2 + strokeMargin) * scale,
      height: (isoHeight * 2 + tileHeight * 2 + cubeHeight + strokeMargin) * scale
    };
  }

  /**
   * Convert isometric ratio to approximate angle in degrees
   * @param {number} isoRatio - Height/width ratio
   * @returns {number} Angle in degrees
   */
  function ratioToAngle(isoRatio) {
    return Math.atan(isoRatio) * (180 / Math.PI);
  }

  /**
   * Convert angle in degrees to isometric ratio
   * @param {number} angleDegrees - Angle in degrees (0-90)
   * @returns {number} Height/width ratio
   */
  function angleToRatio(angleDegrees) {
    return Math.tan(angleDegrees * (Math.PI / 180));
  }

  /**
   * Convert screen/canvas coordinates to grid position (inverse projection)
   * This is the inverse of projectToIso()
   *
   * @param {number} screenX - X position on canvas
   * @param {number} screenY - Y position on canvas
   * @param {number} tileWidth - Width of tile in pixels
   * @param {number} tileHeight - Height of tile in pixels
   * @param {number} offsetX - X offset used in projection
   * @param {number} offsetY - Y offset used in projection
   * @param {number} scale - Display scale factor (default 1)
   * @returns {{gridX: number, gridY: number}}
   */
  function screenToGrid(screenX, screenY, tileWidth, tileHeight, offsetX, offsetY, scale) {
    scale = scale || 1;

    // Account for display scale
    var x = screenX / scale;
    var y = screenY / scale;

    // Reverse the isometric projection formulas:
    // isoX = (gridX - gridY) * tileWidth * 0.5 + offsetX
    // isoY = (gridX + gridY) * tileHeight * 0.5 + offsetY
    //
    // Let A = (x - offsetX) / (tileWidth * 0.5) = gridX - gridY
    // Let B = (y - offsetY) / (tileHeight * 0.5) = gridX + gridY
    //
    // gridX = (A + B) / 2
    // gridY = (B - A) / 2

    var A = (x - offsetX) / (tileWidth * 0.5);
    var B = (y - offsetY) / (tileHeight * 0.5);

    return {
      gridX: Math.round((A + B) / 2),
      gridY: Math.round((B - A) / 2)
    };
  }

  // Public API
  return {
    projectToIso: projectToIso,
    projectToIsoWithRatio: projectToIsoWithRatio,
    getCubeVertices: getCubeVertices,
    getCanvasDimensions: getCanvasDimensions,
    ratioToAngle: ratioToAngle,
    angleToRatio: angleToRatio,
    screenToGrid: screenToGrid
  };

}));
