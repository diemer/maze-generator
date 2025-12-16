/**
 * Stroke Logic for Isometric Wall Rendering
 * Determines which edges should be stroked based on neighbor configuration
 *
 * This module contains pure functions with no DOM dependencies,
 * extracted from maze-iso.js for testability and maintainability.
 */

(function(root, factory) {
  // UMD pattern for browser/Node compatibility
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StrokeLogic = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  /**
   * Determine if the left corner vertical edge should be stroked
   * The left corner is exposed when there's no wall to the left
   *
   * @param {Object} neighbors - Neighbor pixel values
   * @param {number} neighbors.leftPixel - Wall to the left (0 or 1)
   * @returns {boolean}
   */
  function shouldStrokeLeftCorner(neighbors) {
    return !neighbors.leftPixel;
  }

  /**
   * Determine if the center corner (front) vertical edge should be stroked
   * Only draw when fully exposed at front - no wall below or to the right
   *
   * If there's a wall below (bottomPixel) or to the right (rightPixel),
   * that cube's face will be drawn on top of this stroke, causing thin
   * line artifacts.
   *
   * @param {Object} neighbors
   * @param {number} neighbors.bottomPixel - Wall below (0 or 1)
   * @param {number} neighbors.rightPixel - Wall to the right (0 or 1)
   * @returns {boolean}
   */
  function shouldStrokeCenterCorner(neighbors) {
    return !neighbors.bottomPixel && !neighbors.rightPixel;
  }

  /**
   * Determine if the right corner vertical edge should be stroked
   *
   * This is the most complex condition with 5 different cases:
   *
   * 1. rightExposed: Right face is exposed (no wall to right) AND no wall above
   *    This is a clean exposed edge at the top of a wall section.
   *
   * 2. innerCornerTop: No wall to right, wall above, AND wall diagonally top-right
   *    Creates an inner corner where a vertical wall meets a horizontal extension.
   *    Example: Bottom of a + or T junction
   *
   * 3. innerLCorner: Wall to right AND either:
   *    - Wall above with no diagonal top-right (top of L-corner)
   *    - Wall below with no diagonal bottom-right (bottom of L-corner)
   *
   * 4. tJunctionTop: Wall to right, no wall above, BUT wall diagonally top-right
   *    T-junction where horizontal wall meets vertical, opening above
   *
   * 5. tJunctionBottom: Wall to right, no wall below, BUT wall diagonally bottom-right
   *    T-junction where horizontal wall meets vertical, opening below
   *
   * @param {Object} neighbors
   * @param {number} neighbors.rightPixel - Wall to the right
   * @param {number} neighbors.topPixel - Wall above
   * @param {number} neighbors.bottomPixel - Wall below
   * @param {number} neighbors.topRightPixel - Wall diagonally top-right
   * @param {number} neighbors.bottomRightPixel - Wall diagonally bottom-right
   * @returns {{shouldStroke: boolean, reason: string}}
   */
  function shouldStrokeRightCorner(neighbors) {
    var rightPixel = neighbors.rightPixel;
    var topPixel = neighbors.topPixel;
    var bottomPixel = neighbors.bottomPixel;
    var topRightPixel = neighbors.topRightPixel;
    var bottomRightPixel = neighbors.bottomRightPixel;

    // Condition 1: Right face exposed and no wall above
    var rightExposed = !rightPixel && !topPixel;
    if (rightExposed) {
      return { shouldStroke: true, reason: 'rightExposed' };
    }

    // Condition 2: Inner corner at top of T/+ junction
    var innerCornerTop = !rightPixel && topPixel && topRightPixel;
    if (innerCornerTop) {
      return { shouldStroke: true, reason: 'innerCornerTop' };
    }

    // Condition 3: Inner L-corner (wall to right with diagonal notch)
    var innerLCornerTop = rightPixel && topPixel && !topRightPixel;
    var innerLCornerBottom = rightPixel && bottomPixel && !bottomRightPixel;
    if (innerLCornerTop || innerLCornerBottom) {
      return { shouldStroke: true, reason: 'innerLCorner' };
    }

    // Condition 4: T-junction from top
    var tJunctionTop = rightPixel && !topPixel && topRightPixel;
    if (tJunctionTop) {
      return { shouldStroke: true, reason: 'tJunctionTop' };
    }

    // Condition 5: T-junction from bottom
    var tJunctionBottom = rightPixel && !bottomPixel && bottomRightPixel;
    if (tJunctionBottom) {
      return { shouldStroke: true, reason: 'tJunctionBottom' };
    }

    return { shouldStroke: false, reason: 'none' };
  }

  /**
   * Determine if a top face edge should be stroked
   * Each edge is drawn only if there's no adjacent wall on that side
   *
   * @param {string} edge - Which edge: 'top', 'right', 'bottom', 'left'
   * @param {Object} neighbors - Neighbor pixel values
   * @returns {boolean}
   */
  function shouldStrokeTopEdge(edge, neighbors) {
    switch (edge) {
      case 'top':
        return !neighbors.topPixel;
      case 'right':
        return !neighbors.rightPixel;
      case 'bottom':
        return !neighbors.bottomPixel;
      case 'left':
        return !neighbors.leftPixel;
      default:
        return false;
    }
  }

  /**
   * Get all stroke decisions for wall corners mode
   * Returns a complete set of decisions for rendering a cube's strokes
   *
   * @param {Object} neighbors - All neighbor pixel values
   * @param {number} neighbors.leftPixel
   * @param {number} neighbors.rightPixel
   * @param {number} neighbors.topPixel
   * @param {number} neighbors.bottomPixel
   * @param {number} neighbors.topRightPixel
   * @param {number} neighbors.bottomRightPixel
   * @returns {Object} Stroke decisions for each edge type
   */
  function getWallCornerStrokes(neighbors) {
    var rightCornerResult = shouldStrokeRightCorner(neighbors);

    return {
      // Vertical corner edges
      leftCorner: shouldStrokeLeftCorner(neighbors),
      centerCorner: shouldStrokeCenterCorner(neighbors),
      rightCorner: rightCornerResult.shouldStroke,
      rightCornerReason: rightCornerResult.reason,

      // Top face edges
      topEdge: !neighbors.topPixel,
      rightEdge: !neighbors.rightPixel,
      bottomEdge: !neighbors.bottomPixel,
      leftEdge: !neighbors.leftPixel
    };
  }

  /**
   * Create a neighbors object from individual pixel values
   * Convenience function for cleaner API usage
   *
   * @param {number} left - leftPixel
   * @param {number} right - rightPixel
   * @param {number} top - topPixel
   * @param {number} bottom - bottomPixel
   * @param {number} topRight - topRightPixel (optional, default 0)
   * @param {number} bottomRight - bottomRightPixel (optional, default 0)
   * @returns {Object} neighbors object
   */
  function createNeighbors(left, right, top, bottom, topRight, bottomRight) {
    return {
      leftPixel: left || 0,
      rightPixel: right || 0,
      topPixel: top || 0,
      bottomPixel: bottom || 0,
      topRightPixel: topRight || 0,
      bottomRightPixel: bottomRight || 0
    };
  }

  // Public API
  return {
    shouldStrokeLeftCorner: shouldStrokeLeftCorner,
    shouldStrokeCenterCorner: shouldStrokeCenterCorner,
    shouldStrokeRightCorner: shouldStrokeRightCorner,
    shouldStrokeTopEdge: shouldStrokeTopEdge,
    getWallCornerStrokes: getWallCornerStrokes,
    createNeighbors: createNeighbors
  };

}));
