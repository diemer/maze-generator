const StrokeLogic = require('../src/stroke-logic.js');

describe('StrokeLogic', () => {

  describe('shouldStrokeLeftCorner', () => {
    it('should stroke when no wall to the left', () => {
      expect(StrokeLogic.shouldStrokeLeftCorner({ leftPixel: 0 })).toBe(true);
    });

    it('should not stroke when wall exists to the left', () => {
      expect(StrokeLogic.shouldStrokeLeftCorner({ leftPixel: 1 })).toBe(false);
    });
  });

  describe('shouldStrokeCenterCorner', () => {
    it('should stroke when no wall below and no wall to right', () => {
      expect(StrokeLogic.shouldStrokeCenterCorner({
        bottomPixel: 0,
        rightPixel: 0
      })).toBe(true);
    });

    it('should not stroke when wall exists below', () => {
      expect(StrokeLogic.shouldStrokeCenterCorner({
        bottomPixel: 1,
        rightPixel: 0
      })).toBe(false);
    });

    it('should not stroke when wall exists to right', () => {
      expect(StrokeLogic.shouldStrokeCenterCorner({
        bottomPixel: 0,
        rightPixel: 1
      })).toBe(false);
    });

    it('should not stroke when walls exist in both directions', () => {
      expect(StrokeLogic.shouldStrokeCenterCorner({
        bottomPixel: 1,
        rightPixel: 1
      })).toBe(false);
    });
  });

  describe('shouldStrokeRightCorner', () => {

    describe('rightExposed condition', () => {
      it('should stroke when no wall to right AND no wall above', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 0,
          topPixel: 0,
          bottomPixel: 0,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('rightExposed');
      });

      it('should not trigger rightExposed when wall above exists', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 0,
          topPixel: 1,
          bottomPixel: 0,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        // Should not stroke at all - this is interior of vertical wall
        expect(result.shouldStroke).toBe(false);
        expect(result.reason).toBe('none');
      });
    });

    describe('innerCornerTop condition', () => {
      it('should stroke for inner corner: no right wall, wall above, wall diagonally top-right', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 0,
          topPixel: 1,
          bottomPixel: 0,
          topRightPixel: 1,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('innerCornerTop');
      });

      it('should not trigger innerCornerTop without diagonal wall', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 0,
          topPixel: 1,
          bottomPixel: 0,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(false);
        expect(result.reason).toBe('none');
      });

      // This is the key test for cube 53 in the + junction
      it('should stroke for cube 53 scenario (bottom of + shape)', () => {
        // Cube 53: no wall right, wall above (39), wall diagonally top-right (40)
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 0,
          topPixel: 1,
          bottomPixel: 0,
          topRightPixel: 1,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('innerCornerTop');
      });
    });

    describe('innerLCorner condition', () => {
      it('should stroke for L-corner: wall right, wall above, no diagonal top-right', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 1,
          bottomPixel: 0,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('innerLCorner');
      });

      it('should stroke for L-corner: wall right, wall below, no diagonal bottom-right', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 0,
          bottomPixel: 1,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('innerLCorner');
      });

      it('should not stroke for L-corner if diagonal exists (makes it a T)', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 1,
          bottomPixel: 0,
          topRightPixel: 1,  // Diagonal makes this not an L-corner
          bottomRightPixel: 0
        });
        expect(result.reason).not.toBe('innerLCorner');
      });

      // Test for cube 39 (center of + shape)
      it('should stroke for cube 39 scenario (center of + shape)', () => {
        // Cube 39: wall right (40), wall above (34), no diagonal top-right
        // Wall below (53), no diagonal bottom-right
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 1,
          bottomPixel: 1,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('innerLCorner');
      });
    });

    describe('tJunctionTop condition', () => {
      it('should stroke for T-junction: wall right, no wall above, wall diagonal top-right', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 0,
          bottomPixel: 0,
          topRightPixel: 1,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('tJunctionTop');
      });

      // Test for cube 38 (left arm of + shape)
      it('should stroke for cube 38 scenario (left arm of + shape)', () => {
        // Cube 38: wall right (39), no wall above, wall diagonally top-right (34)
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 0,
          bottomPixel: 0,
          topRightPixel: 1,
          bottomRightPixel: 1  // Also has bottom diagonal (53), but tJunctionTop fires first
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('tJunctionTop');
      });
    });

    describe('tJunctionBottom condition', () => {
      it('should stroke for T-junction: wall right, no wall below, wall diagonal bottom-right', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 0,
          bottomPixel: 0,
          topRightPixel: 0,
          bottomRightPixel: 1
        });
        expect(result.shouldStroke).toBe(true);
        expect(result.reason).toBe('tJunctionBottom');
      });
    });

    describe('no stroke conditions', () => {
      it('should not stroke for straight vertical wall segment', () => {
        // Wall above and below, but no horizontal extensions
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 0,
          topPixel: 1,
          bottomPixel: 1,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(false);
        expect(result.reason).toBe('none');
      });

      it('should not stroke for interior of filled block', () => {
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 1,
          bottomPixel: 1,
          topRightPixel: 1,
          bottomRightPixel: 1
        });
        expect(result.shouldStroke).toBe(false);
        expect(result.reason).toBe('none');
      });

      it('should not stroke for middle of horizontal wall segment', () => {
        // Wall left and right, nothing above or below
        // But this would actually trigger rightExposed because topPixel=0
        // Let me reconsider... if rightPixel=1, we skip rightExposed
        // and no other conditions match
        const result = StrokeLogic.shouldStrokeRightCorner({
          rightPixel: 1,
          topPixel: 0,
          bottomPixel: 0,
          topRightPixel: 0,
          bottomRightPixel: 0
        });
        expect(result.shouldStroke).toBe(false);
        expect(result.reason).toBe('none');
      });
    });
  });

  describe('shouldStrokeTopEdge', () => {
    const neighbors = {
      topPixel: 1,
      rightPixel: 0,
      bottomPixel: 1,
      leftPixel: 0
    };

    it('should not stroke top edge when wall above', () => {
      expect(StrokeLogic.shouldStrokeTopEdge('top', neighbors)).toBe(false);
    });

    it('should stroke right edge when no wall to right', () => {
      expect(StrokeLogic.shouldStrokeTopEdge('right', neighbors)).toBe(true);
    });

    it('should not stroke bottom edge when wall below', () => {
      expect(StrokeLogic.shouldStrokeTopEdge('bottom', neighbors)).toBe(false);
    });

    it('should stroke left edge when no wall to left', () => {
      expect(StrokeLogic.shouldStrokeTopEdge('left', neighbors)).toBe(true);
    });

    it('should return false for invalid edge', () => {
      expect(StrokeLogic.shouldStrokeTopEdge('invalid', neighbors)).toBe(false);
    });
  });

  describe('getWallCornerStrokes - integration', () => {
    it('should return all strokes true for isolated cube', () => {
      const strokes = StrokeLogic.getWallCornerStrokes({
        leftPixel: 0,
        rightPixel: 0,
        topPixel: 0,
        bottomPixel: 0,
        topRightPixel: 0,
        bottomRightPixel: 0
      });

      expect(strokes.leftCorner).toBe(true);
      expect(strokes.centerCorner).toBe(true);
      expect(strokes.rightCorner).toBe(true);
      expect(strokes.rightCornerReason).toBe('rightExposed');
      expect(strokes.topEdge).toBe(true);
      expect(strokes.rightEdge).toBe(true);
      expect(strokes.bottomEdge).toBe(true);
      expect(strokes.leftEdge).toBe(true);
    });

    it('should return correct strokes for horizontal wall middle segment', () => {
      // Wall to left and right, open above and below
      const strokes = StrokeLogic.getWallCornerStrokes({
        leftPixel: 1,
        rightPixel: 1,
        topPixel: 0,
        bottomPixel: 0,
        topRightPixel: 0,
        bottomRightPixel: 0
      });

      expect(strokes.leftCorner).toBe(false);  // Wall to left
      expect(strokes.centerCorner).toBe(false); // Wall to right
      expect(strokes.rightCorner).toBe(false);  // Wall to right, no diagonals
      expect(strokes.topEdge).toBe(true);       // No wall above
      expect(strokes.bottomEdge).toBe(true);    // No wall below
    });

    it('should return correct strokes for + junction center', () => {
      // Center of + has walls in all 4 cardinal directions, no diagonals
      const strokes = StrokeLogic.getWallCornerStrokes({
        leftPixel: 1,
        rightPixel: 1,
        topPixel: 1,
        bottomPixel: 1,
        topRightPixel: 0,
        bottomRightPixel: 0
      });

      expect(strokes.leftCorner).toBe(false);
      expect(strokes.centerCorner).toBe(false);
      expect(strokes.rightCorner).toBe(true);  // innerLCorner condition
      expect(strokes.rightCornerReason).toBe('innerLCorner');
      expect(strokes.topEdge).toBe(false);
      expect(strokes.bottomEdge).toBe(false);
    });
  });

  describe('createNeighbors', () => {
    it('should create neighbors object with all values', () => {
      const neighbors = StrokeLogic.createNeighbors(1, 1, 0, 0, 1, 0);

      expect(neighbors.leftPixel).toBe(1);
      expect(neighbors.rightPixel).toBe(1);
      expect(neighbors.topPixel).toBe(0);
      expect(neighbors.bottomPixel).toBe(0);
      expect(neighbors.topRightPixel).toBe(1);
      expect(neighbors.bottomRightPixel).toBe(0);
    });

    it('should default diagonal values to 0', () => {
      const neighbors = StrokeLogic.createNeighbors(1, 0, 1, 0);

      expect(neighbors.topRightPixel).toBe(0);
      expect(neighbors.bottomRightPixel).toBe(0);
    });

    it('should work with shouldStrokeRightCorner', () => {
      const neighbors = StrokeLogic.createNeighbors(0, 0, 0, 0, 0, 0);
      const result = StrokeLogic.shouldStrokeRightCorner(neighbors);

      expect(result.shouldStroke).toBe(true);
      expect(result.reason).toBe('rightExposed');
    });
  });

  describe('Debug test pattern scenarios', () => {
    // These tests verify the specific cubes mentioned in the debug pattern

    it('cube 1 - isolated single cube', () => {
      const neighbors = StrokeLogic.createNeighbors(0, 0, 0, 0, 0, 0);
      const strokes = StrokeLogic.getWallCornerStrokes(neighbors);

      expect(strokes.leftCorner).toBe(true);
      expect(strokes.centerCorner).toBe(true);
      expect(strokes.rightCorner).toBe(true);
    });

    it('cube 2 (left of horizontal pair) - wall to right', () => {
      const neighbors = StrokeLogic.createNeighbors(0, 1, 0, 0, 0, 0);
      const strokes = StrokeLogic.getWallCornerStrokes(neighbors);

      expect(strokes.leftCorner).toBe(true);   // No wall left
      expect(strokes.centerCorner).toBe(false); // Wall to right
      expect(strokes.rightCorner).toBe(false);  // Wall to right, no junction
    });

    it('cube 3 (right of horizontal pair) - wall to left', () => {
      const neighbors = StrokeLogic.createNeighbors(1, 0, 0, 0, 0, 0);
      const strokes = StrokeLogic.getWallCornerStrokes(neighbors);

      expect(strokes.leftCorner).toBe(false);  // Wall to left
      expect(strokes.centerCorner).toBe(true); // No wall right or below
      expect(strokes.rightCorner).toBe(true);  // rightExposed
    });

    it('cube at vertical wall interior should not stroke right corner', () => {
      // Like cubes 59 & 61 scenario - interior of vertical wall
      const neighbors = StrokeLogic.createNeighbors(0, 0, 1, 1, 0, 0);
      const strokes = StrokeLogic.getWallCornerStrokes(neighbors);

      expect(strokes.rightCorner).toBe(false); // Interior edge
      expect(strokes.rightCornerReason).toBe('none');
    });
  });
});
