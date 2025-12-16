const IsoGeometry = require('../src/iso-geometry.js');

describe('IsoGeometry', () => {

  describe('projectToIso', () => {
    it('should return origin for grid position (0,0) with no offset', () => {
      const result = IsoGeometry.projectToIso(0, 0, 10, 5, 0, 0);
      expect(result.isoX).toBe(0);
      expect(result.isoY).toBe(0);
    });

    it('should calculate correct coordinates for positive X position', () => {
      // Grid (1, 0): isoX = (1-0) * 10 * 0.5 = 5, isoY = (1+0) * 5 * 0.5 = 2.5
      const result = IsoGeometry.projectToIso(1, 0, 10, 5, 0, 0);
      expect(result.isoX).toBe(5);
      expect(result.isoY).toBe(2.5);
    });

    it('should calculate correct coordinates for positive Y position', () => {
      // Grid (0, 1): isoX = (0-1) * 10 * 0.5 = -5, isoY = (0+1) * 5 * 0.5 = 2.5
      const result = IsoGeometry.projectToIso(0, 1, 10, 5, 0, 0);
      expect(result.isoX).toBe(-5);
      expect(result.isoY).toBe(2.5);
    });

    it('should apply offset correctly', () => {
      const result = IsoGeometry.projectToIso(0, 0, 10, 5, 100, 50);
      expect(result.isoX).toBe(100);
      expect(result.isoY).toBe(50);
    });

    it('should produce same X for diagonal positions (n,n)', () => {
      // Position (2, 2): isoX = (2-2) * 10 * 0.5 = 0
      const result = IsoGeometry.projectToIso(2, 2, 10, 5, 0, 0);
      expect(result.isoX).toBe(0);
      expect(result.isoY).toBe(10); // (2+2) * 5 * 0.5
    });

    it('should handle large grid positions', () => {
      const result = IsoGeometry.projectToIso(100, 50, 10, 5, 0, 0);
      expect(result.isoX).toBe(250); // (100-50) * 10 * 0.5
      expect(result.isoY).toBe(375); // (100+50) * 5 * 0.5
    });
  });

  describe('projectToIsoWithRatio', () => {
    it('should produce same results as projectToIso with 0.5 ratio', () => {
      const direct = IsoGeometry.projectToIso(1, 0, 10, 5, 0, 0);
      const withRatio = IsoGeometry.projectToIsoWithRatio(1, 0, 10, 0.5, 0, 0);
      expect(withRatio.isoX).toBe(direct.isoX);
      expect(withRatio.isoY).toBe(direct.isoY);
    });

    it('should support true isometric ratio (~0.577)', () => {
      const trueIsoRatio = Math.tan(30 * Math.PI / 180); // ~0.577
      const result = IsoGeometry.projectToIsoWithRatio(1, 0, 10, trueIsoRatio, 0, 0);
      expect(result.isoX).toBe(5);
      // tileHeight = 10 * 0.577 = 5.77, isoY = (1+0) * 5.77 * 0.5 = 2.885
      expect(result.isoY).toBeCloseTo(2.887, 2);
    });

    it('should support flat ratio (0.25)', () => {
      const result = IsoGeometry.projectToIsoWithRatio(1, 0, 10, 0.25, 0, 0);
      expect(result.isoX).toBe(5);
      // tileHeight = 10 * 0.25 = 2.5, isoY = (1+0) * 2.5 * 0.5 = 1.25
      expect(result.isoY).toBe(1.25);
    });

    it('should support steep ratio (0.75)', () => {
      const result = IsoGeometry.projectToIsoWithRatio(1, 0, 10, 0.75, 0, 0);
      expect(result.isoX).toBe(5);
      // tileHeight = 10 * 0.75 = 7.5, isoY = (1+0) * 7.5 * 0.5 = 3.75
      expect(result.isoY).toBe(3.75);
    });
  });

  describe('getCubeVertices', () => {
    it('should calculate all vertices correctly', () => {
      const vertices = IsoGeometry.getCubeVertices(0, 0, 10, 5, 5);

      expect(vertices.topCenter).toEqual({ x: 0, y: 0 });
      expect(vertices.topRight).toEqual({ x: 5, y: 2.5 });
      expect(vertices.bottomCenter).toEqual({ x: 0, y: 5 });
      expect(vertices.topLeft).toEqual({ x: -5, y: 2.5 });
      expect(vertices.bottomLeft).toEqual({ x: -5, y: 7.5 }); // 2.5 + 5
      expect(vertices.bottomRight).toEqual({ x: 5, y: 7.5 });
      expect(vertices.bottomCenterLow).toEqual({ x: 0, y: 10 }); // 5 + 5
    });

    it('should handle offset position', () => {
      const vertices = IsoGeometry.getCubeVertices(100, 50, 10, 5, 5);

      expect(vertices.topCenter).toEqual({ x: 100, y: 50 });
      expect(vertices.topRight).toEqual({ x: 105, y: 52.5 });
    });

    it('should handle different cube heights', () => {
      const shortCube = IsoGeometry.getCubeVertices(0, 0, 10, 5, 2);
      const tallCube = IsoGeometry.getCubeVertices(0, 0, 10, 5, 10);

      expect(shortCube.bottomCenterLow.y).toBe(7); // 5 + 2
      expect(tallCube.bottomCenterLow.y).toBe(15); // 5 + 10
    });

    it('should handle zero cube height (flat tile)', () => {
      const flat = IsoGeometry.getCubeVertices(0, 0, 10, 5, 0);

      expect(flat.bottomLeft.y).toBe(2.5); // Same as topLeft
      expect(flat.bottomRight.y).toBe(2.5); // Same as topRight
      expect(flat.bottomCenterLow.y).toBe(5); // Same as bottomCenter
    });
  });

  describe('getCanvasDimensions', () => {
    it('should calculate canvas dimensions correctly', () => {
      const dims = IsoGeometry.getCanvasDimensions(10, 10, 10, 5, 5, 1, 0);

      expect(dims.isoWidth).toBe(50); // 10 * 10 * 0.5
      expect(dims.isoHeight).toBe(25); // 10 * 5 * 0.5
      expect(dims.width).toBe(100); // 50 * 2
      expect(dims.height).toBe(65); // (25*2 + 5*2 + 5) = 65
    });

    it('should apply scale correctly', () => {
      const dims = IsoGeometry.getCanvasDimensions(10, 10, 10, 5, 5, 2, 0);

      expect(dims.width).toBe(200); // 100 * 2
      expect(dims.height).toBe(130); // 65 * 2
    });

    it('should include stroke margin', () => {
      const dims = IsoGeometry.getCanvasDimensions(10, 10, 10, 5, 5, 1, 4);

      expect(dims.width).toBe(104); // 100 + 4
      expect(dims.height).toBe(69); // 65 + 4
    });
  });

  describe('ratioToAngle and angleToRatio', () => {
    it('should convert 0.5 ratio to ~26.57 degrees', () => {
      const angle = IsoGeometry.ratioToAngle(0.5);
      expect(angle).toBeCloseTo(26.57, 1);
    });

    it('should convert true isometric ratio to ~30 degrees', () => {
      const trueIsoRatio = Math.tan(30 * Math.PI / 180);
      const angle = IsoGeometry.ratioToAngle(trueIsoRatio);
      expect(angle).toBeCloseTo(30, 5);
    });

    it('should convert 30 degrees to true isometric ratio', () => {
      const ratio = IsoGeometry.angleToRatio(30);
      expect(ratio).toBeCloseTo(0.577, 2);
    });

    it('should be reversible', () => {
      const originalRatio = 0.5;
      const angle = IsoGeometry.ratioToAngle(originalRatio);
      const backToRatio = IsoGeometry.angleToRatio(angle);
      expect(backToRatio).toBeCloseTo(originalRatio, 10);
    });

    it('should handle extreme angles', () => {
      expect(IsoGeometry.angleToRatio(45)).toBeCloseTo(1, 5);
      expect(IsoGeometry.ratioToAngle(1)).toBeCloseTo(45, 5);
    });
  });

  describe('screenToGrid', () => {
    it('should return origin for screen coordinates at offset', () => {
      const result = IsoGeometry.screenToGrid(100, 50, 10, 5, 100, 50, 1);
      expect(result.gridX).toBe(0);
      expect(result.gridY).toBe(0);
    });

    it('should be inverse of projectToIso', () => {
      // Project grid (3, 2) to screen
      const projected = IsoGeometry.projectToIso(3, 2, 10, 5, 100, 50);
      // Convert back to grid
      const gridCoords = IsoGeometry.screenToGrid(
        projected.isoX, projected.isoY, 10, 5, 100, 50, 1
      );
      expect(gridCoords.gridX).toBe(3);
      expect(gridCoords.gridY).toBe(2);
    });

    it('should handle scale factor', () => {
      // At scale 2, screen coordinates are doubled
      const projected = IsoGeometry.projectToIso(3, 2, 10, 5, 100, 50);
      const scaledX = projected.isoX * 2;
      const scaledY = projected.isoY * 2;
      const gridCoords = IsoGeometry.screenToGrid(scaledX, scaledY, 10, 5, 100, 50, 2);
      expect(gridCoords.gridX).toBe(3);
      expect(gridCoords.gridY).toBe(2);
    });

    it('should round to nearest grid position', () => {
      // Slightly off-center should round to nearest
      const result = IsoGeometry.screenToGrid(102, 51, 10, 5, 100, 50, 1);
      expect(result.gridX).toBe(0);
      expect(result.gridY).toBe(0);
    });

    it('should work with different tile dimensions', () => {
      // Use 20x10 tiles
      const projected = IsoGeometry.projectToIso(5, 3, 20, 10, 200, 100);
      const gridCoords = IsoGeometry.screenToGrid(
        projected.isoX, projected.isoY, 20, 10, 200, 100, 1
      );
      expect(gridCoords.gridX).toBe(5);
      expect(gridCoords.gridY).toBe(3);
    });
  });
});
