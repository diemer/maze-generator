function Maze(args) {
  const defaults = {
    width: 20,
    height: 20,
    wallSize: 10,
    displayScale: 1.0,
    pathWidth: 1,
    pathHeight: 1,
    entryType: "",
    bias: "",
    color: "#000000",
    backgroundColor: "#FFFFFF",
    solveColor: "#cc3737",
    removeWalls: 0,

    // Tileset configuration:
    // { wallLeft, wallRight, pathway, start, end } - basic tiles
    // { startN, startS, startE, startW, endN, endS, endE, endW } - directional gate tiles
    tileset: null,
    showStroke: true,
    strokeTop: true, // Stroke the top face edges
    strokeBottom: true, // Stroke the bottom edges
    strokeCorners: true, // Stroke the vertical corner edges
    strokeWallCorners: false, // Only stroke corners at wall section edges (overrides strokeCorners)
    wallHeight: 1.0, // Multiplier for wall height (1.0 = same as tileHeight)
    strokeWidth: 2, // Border thickness in pixels
    wallBgColor: "", // Optional background color for wall faces (behind transparent textures)
    debugStrokeColors: false, // Show different colors for each stroke type (for debugging)
    debugTestPattern: false, // Use a static test pattern instead of random maze
    showBlockNumbers: false, // Show grid coordinates on walls and pathways (for debugging)
    isoRatio: 0.5, // Isometric ratio (height/width): 0.5=2:1 pixel art, 0.577=true iso (~30°)
    tightSpacing: false, // Remove stroke-based spacing for seamless tileset rendering
    endMarkerOffset: -3.5, // Vertical offset for end marker tile (positive = down)
    endMarkerOffsetX: -1, // Horizontal offset for end marker tile (positive = right, inverted for left-side exits)

    // Maximum 300 walls can be removed
    maxWallsRemove: 300,

    // No restrictions
    maxMaze: 0,
    maxCanvas: 0,
    maxCanvasDimension: 0,
    maxSolve: 0,
  };

  const settings = Object.assign({}, defaults, args);

  this.matrix = [];
  this.wallsRemoved = 0;
  this.width = parseInt(settings["width"], 10);
  this.height = parseInt(settings["height"], 10);
  this.wallSize = parseInt(settings["wallSize"], 10);
  this.displayScale = parseFloat(settings["displayScale"]) || 1.0;
  this.pathWidth = parseInt(settings["pathWidth"], 10) || 1;
  this.pathHeight = parseInt(settings["pathHeight"], 10) || 1;
  this.removeWalls = parseInt(settings["removeWalls"], 10);
  this.flipStart = !!settings["flipStart"];
  this.flipExit = !!settings["flipExit"];
  this.entryNodes = this.getEntryNodes(settings["entryType"], this.flipStart, this.flipExit);
  this.bias = settings["bias"];
  this.color = settings["color"];
  this.backgroundColor = settings["backgroundColor"];
  this.solveColor = settings["solveColor"];
  this.tileset = settings["tileset"];
  this.tileImages = {}; // Will hold loaded Image objects
  this.floorTileMap = {}; // Maps grid positions to tile indices for deterministic random selection
  this.blankFloorTiles = {}; // Grid positions that should be blank (no floor texture)
  this.decorations = settings["decorations"] || {}; // Grid position -> {tileUrl, category}
  this.decorationImages = {}; // URL -> loaded Image object
  this.showStroke = settings["showStroke"] !== false;
  this.strokeTop = settings["strokeTop"] !== false;
  this.strokeBottom = settings["strokeBottom"] !== false;
  this.strokeCorners = settings["strokeCorners"] !== false;
  this.strokeWallCorners = settings["strokeWallCorners"] === true;
  this.wallHeight = parseFloat(settings["wallHeight"]) || 1.0;
  this.strokeWidth = parseFloat(settings["strokeWidth"]) || 2;
  this.wallBgColor = settings["wallBgColor"] || "";
  this.debugStrokeColors = settings["debugStrokeColors"] === true;
  this.debugTestPattern = settings["debugTestPattern"] === true;
  this.showBlockNumbers = settings["showBlockNumbers"] === true;
  this.isoRatio = parseFloat(settings["isoRatio"]) || 0.5;
  this.tightSpacing = settings["tightSpacing"] === true;
  this.endMarkerOffset = parseFloat(settings["endMarkerOffset"]) || 0;
  this.endMarkerOffsetX = parseFloat(settings["endMarkerOffsetX"]) || 0;
  this.showEntryIndicators = settings["showEntryIndicators"] !== false;
  this.entryIndicatorFontSize = parseFloat(settings["entryIndicatorFontSize"]) || 0;
  this.maxMaze = parseInt(settings["maxMaze"], 10);
  this.maxCanvas = parseInt(settings["maxCanvas"], 10);
  this.maxCanvasDimension = parseInt(settings["maxCanvasDimension"], 10);
  this.maxSolve = parseInt(settings["maxSolve"], 10);
  this.maxWallsRemove = parseInt(settings["maxWallsRemove"], 10);
}

Maze.prototype.loadTileset = function () {
  return new Promise((resolve, reject) => {
    if (!this.tileset) {
      resolve();
      return;
    }

    // Initialize tileWeights to store weight arrays
    this.tileWeights = {};

    // Include directional gate tiles
    const tileTypes = [
      'wallLeft', 'wallRight', 'pathway', 'start', 'end',
      'startN', 'startS', 'startE', 'startW',
      'endN', 'endS', 'endE', 'endW'
    ];
    const promises = [];

    tileTypes.forEach((type) => {
      const tileValue = this.tileset[type];
      if (!tileValue) return;

      // Handle array of weighted tile objects: [{url, weight}, ...]
      if (Array.isArray(tileValue)) {
        const arrayPromises = tileValue.map((item, idx) => {
          return new Promise((res) => {
            // Handle both new format {url, weight} and legacy format (string)
            const url = typeof item === 'object' ? item.url : item;
            const weight = typeof item === 'object' ? (item.weight || 1) : 1;

            // null, empty string, or "blank" = solid color (no image)
            if (!url || url === 'blank' || url === '') {
              res({ index: idx, image: null, weight: weight });
              return;
            }
            const img = new Image();
            img.onload = () => res({ index: idx, image: img, weight: weight });
            img.onerror = () => {
              console.warn(`Failed to load tile: ${type}[${idx}]`);
              res({ index: idx, image: null, weight: weight });
            };
            img.src = url;
          });
        });

        const arrayPromise = Promise.all(arrayPromises).then((results) => {
          // Sort by index to maintain order
          results.sort((a, b) => a.index - b.index);
          this.tileImages[type] = results.map(r => r.image);
          this.tileWeights[type] = results.map(r => r.weight);
        });
        promises.push(arrayPromise);
      } else {
        // Single URL (backward compatible)
        const promise = new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            this.tileImages[type] = img;
            res();
          };
          img.onerror = () => {
            console.warn(`Failed to load tile: ${type}`);
            res(); // Don't reject, just skip this tile
          };
          img.src = tileValue;
        });
        promises.push(promise);
      }
    });

    Promise.all(promises).then(resolve).catch(reject);
  });
};

// Weighted random selection helper
Maze.prototype.selectWeightedRandom = function (tiles, weights) {
  if (!tiles || tiles.length === 0) return null;
  if (!weights || tiles.length === 1) return tiles[0];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return tiles[0];

  let random = Math.random() * totalWeight;
  for (let i = 0; i < tiles.length; i++) {
    random -= weights[i];
    if (random <= 0) return tiles[i];
  }
  return tiles[tiles.length - 1];
};

// Get weighted random index for a tile array (deterministic per position)
Maze.prototype.getWeightedTileIndex = function (type, gridX, gridY) {
  const tiles = this.tileImages[type];
  const weights = this.tileWeights[type];
  if (!tiles || !Array.isArray(tiles) || tiles.length === 0) return -1;
  if (tiles.length === 1) return 0;

  // Use position-based seed for deterministic randomness
  const key = `${type}_${gridX},${gridY}`;
  if (this.floorTileMap[key] !== undefined) {
    return this.floorTileMap[key];
  }

  // Calculate weighted random index
  const totalWeight = weights ? weights.reduce((sum, w) => sum + w, 0) : tiles.length;
  let random = Math.random() * totalWeight;
  let selectedIdx = 0;

  if (weights) {
    for (let i = 0; i < tiles.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedIdx = i;
        break;
      }
    }
  } else {
    selectedIdx = Math.floor(Math.random() * tiles.length);
  }

  this.floorTileMap[key] = selectedIdx;
  return selectedIdx;
};

// Load decoration images (called when decorations are placed)
Maze.prototype.loadDecorations = function () {
  return new Promise((resolve) => {
    // Get unique URLs from all decorations
    const uniqueUrls = [...new Set(
      Object.values(this.decorations)
        .map(d => d.tileUrl)
        .filter(url => url && !this.decorationImages[url])
    )];

    if (uniqueUrls.length === 0) {
      resolve();
      return;
    }

    const promises = uniqueUrls.map(url => {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          this.decorationImages[url] = img;
          res();
        };
        img.onerror = () => {
          console.warn(`Failed to load decoration: ${url}`);
          res();
        };
        img.src = url;
      });
    });

    Promise.all(promises).then(resolve);
  });
};

// Set a decoration at a grid position
// layer: "floor" (above floor, below walls) or "overlay" (above everything)
Maze.prototype.setDecoration = function (gridX, gridY, tileUrl, category, layer) {
  const key = `${gridX},${gridY}`;

  // Validate it's a floor cell (not a wall)
  if (this.matrix[gridY]) {
    const pixel = parseInt(this.matrix[gridY].charAt(gridX), 10);
    if (pixel === 1) {
      console.warn(`Cannot place decoration on wall at (${gridX}, ${gridY})`);
      return false;
    }
  }

  if (tileUrl) {
    this.decorations[key] = {
      tileUrl,
      category: category || 'misc',
      layer: layer || 'floor'  // Default to floor layer
    };
  } else {
    delete this.decorations[key];
  }
  return true;
};

// Get decoration at a grid position
Maze.prototype.getDecoration = function (gridX, gridY) {
  return this.decorations[`${gridX},${gridY}`] || null;
};

// Clear all decorations
Maze.prototype.clearDecorations = function () {
  this.decorations = {};
  this.decorationImages = {};
};

// Check if a floor tile is blank
Maze.prototype.isFloorBlank = function (gridX, gridY) {
  const key = `${gridX},${gridY}`;
  return !!this.blankFloorTiles[key];
};

// Set a floor tile to blank or restore it
Maze.prototype.setFloorBlank = function (gridX, gridY, isBlank) {
  const key = `${gridX},${gridY}`;
  if (isBlank) {
    this.blankFloorTiles[key] = true;
  } else {
    delete this.blankFloorTiles[key];
  }
};

// Clear all blank floor tiles
Maze.prototype.clearBlankFloors = function () {
  this.blankFloorTiles = {};
};

// Export full maze state as JSON string
Maze.prototype.exportMaze = function () {
  const data = {
    version: 3,
    matrix: this.matrix,
    decorations: this.decorations,
    blankFloorTiles: this.blankFloorTiles,
    floorTileMap: this.floorTileMap,
    entryNodes: this.entryNodes,
    entryType: this.entryType || null,
    tileset: this.tileset || null,
    tileWeights: this.tileWeights || null
  };
  return JSON.stringify(data, null, 2);
};

// Import full maze state from JSON string
Maze.prototype.importMaze = function (jsonString) {
  try {
    const parsed = JSON.parse(jsonString);

    // Handle old format (just decorations object)
    if (!parsed.version && !parsed.matrix) {
      this.decorations = parsed;
      return true;
    }

    // New format with full maze state
    if (parsed.matrix) {
      this.matrix = parsed.matrix;
    }
    if (parsed.decorations) {
      this.decorations = parsed.decorations;
    }
    if (parsed.blankFloorTiles) {
      this.blankFloorTiles = parsed.blankFloorTiles;
    }
    if (parsed.floorTileMap) {
      this.floorTileMap = parsed.floorTileMap;
    }
    // Version 2+: entry information
    if (parsed.entryNodes) {
      this.entryNodes = parsed.entryNodes;
    }
    if (parsed.entryType) {
      this.entryType = parsed.entryType;
    }
    // Version 3+: tileset configuration with weights
    if (parsed.tileset) {
      this.tileset = parsed.tileset;
    }
    if (parsed.tileWeights) {
      this.tileWeights = parsed.tileWeights;
    }
    return true;
  } catch (e) {
    console.warn('Failed to parse maze JSON:', e);
    return false;
  }
};

// Legacy alias for backwards compatibility
Maze.prototype.exportDecorations = Maze.prototype.exportMaze;
Maze.prototype.importDecorations = Maze.prototype.importMaze;

// Update entry nodes without regenerating the maze
// Uses current matrix dimensions instead of original width/height
// flipStart/flipExit move the gate to the other end of its wall
Maze.prototype.setEntryType = function (entryType, flipStart, flipExit) {
  if (!this.matrix.length) return;

  // Calculate based on actual matrix dimensions
  const matrixRows = this.matrix.length;
  const matrixCols = this.matrix[0].length;
  const y = matrixRows - 2; // Last non-border row
  const x = matrixCols - 2; // Last non-border column

  let entryNodes = {};
  let access = entryType;
  flipStart = !!flipStart;
  flipExit = !!flipExit;

  // Handle random - pick any entry type
  // Start always on visual top half (north/west walls), exit always on visual bottom half (east/south walls)
  if ("diagonal-random" === access) {
    const options = ["diagonal", "diagonal-alt", "horizontal", "vertical", "same-left", "same-right"];
    access = options[Math.floor(Math.random() * options.length)];
  }

  if ("diagonal" === access) {
    // Start on west wall (visual top-left), exit on east wall (visual bottom-right)
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  if ("diagonal-alt" === access) {
    // Start on north wall (visual top-right), exit on south wall (visual bottom-left)
    entryNodes.start = { x: x, y: 1, gate: { x: x, y: 0 } };
    entryNodes.end = { x: 1, y: y, gate: { x: 1, y: y + 1 } };
  }

  if ("horizontal" === access) {
    // Start on west wall (visual top-left), exit on east wall (visual bottom-right)
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  if ("vertical" === access) {
    // Start on north wall (visual top-right), exit on south wall (visual bottom-left)
    entryNodes.start = { x: x, y: 1, gate: { x: x, y: 0 } };
    entryNodes.end = { x: 1, y: y, gate: { x: 1, y: y + 1 } };
  }

  if ("same-left" === access) {
    // Both on left visual side: start on west wall (NW), exit on south wall (SW)
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: 1, y: y, gate: { x: 1, y: y + 1 } };
  }

  if ("same-right" === access) {
    // Both on right visual side: start on north wall (NE), exit on east wall (SE)
    entryNodes.start = { x: x, y: 1, gate: { x: x, y: 0 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  // Apply flip logic - move gate to other end of its wall
  if (flipStart && entryNodes.start) {
    const s = entryNodes.start;
    if (s.gate.x === 0) {
      // West wall: flip y position
      s.y = s.y === 1 ? y : 1;
      s.gate.y = s.y;
    } else if (s.gate.y === 0) {
      // North wall: flip x position
      s.x = s.x === 1 ? x : 1;
      s.gate.x = s.x;
    }
  }

  if (flipExit && entryNodes.end) {
    const e = entryNodes.end;
    if (e.gate.x === x + 1) {
      // East wall: flip y position
      e.y = e.y === 1 ? y : 1;
      e.gate.y = e.y;
    } else if (e.gate.y === y + 1) {
      // South wall: flip x position
      e.x = e.x === 1 ? x : 1;
      e.gate.x = e.x;
    }
  }

  this.entryType = access; // Store the resolved entry type
  this.entryNodes = entryNodes;
  return entryNodes;
};

// Determine the direction of a gate relative to its entry point
// Returns 'N', 'S', 'E', or 'W'
Maze.prototype.getGateDirection = function (entryX, entryY, gateX, gateY) {
  if (gateY < entryY) return 'N'; // Gate is north of entry
  if (gateY > entryY) return 'S'; // Gate is south of entry
  if (gateX < entryX) return 'W'; // Gate is west of entry
  if (gateX > entryX) return 'E'; // Gate is east of entry
  return 'N'; // Default fallback
};

Maze.prototype.generate = function () {
  // Reset floor tile map for fresh randomization
  this.floorTileMap = {};

  // Use debug test pattern if enabled
  if (this.debugTestPattern) {
    this.generateDebugTestPattern();
    return;
  }

  if (!this.isValidSize()) {
    this.matrix = [];
    alert("Please use smaller maze dimensions");
    return;
  }

  let nodes = this.generateNodes();
  nodes = this.parseMaze(nodes);
  this.getMatrix(nodes);
  this.removeMazeWalls();

  // Apply path scaling if needed
  if (this.pathWidth > 1 || this.pathHeight > 1) {
    this.transformMatrix();
  }
};

// Generate a debug test pattern showing all wall configurations
// Each wall cube will be numbered for identification
Maze.prototype.generateDebugTestPattern = function () {
  // Test pattern with clear spacing between each configuration
  // Numbers refer to cube IDs that will be displayed
  //
  // Layout key:
  // - Cubes 1: Single isolated
  // - Cubes 2-3: Horizontal pair
  // - Cubes 4-6: Horizontal triple
  // - Cubes 7-8: Vertical pair
  // - Cubes 9-11: Vertical triple
  // - Cubes 12-13: L-corner (┘ shape)
  // - Cubes 14-15: L-corner (└ shape)
  // - Cubes 16-17: L-corner (┐ shape)
  // - Cubes 18-19: L-corner (┌ shape)
  // - Cubes 20-22: T-junction (┴ shape)
  // - Cubes 23-25: T-junction (┬ shape)
  // - Cubes 26-28: T-junction (├ shape)
  // - Cubes 29-31: T-junction (┤ shape)
  // - Cubes 32-35: Cross/+ junction
  // - Cubes 36-39: 2x2 block
  // - Row 14-16: Exit configurations (wall with gate openings)

  this.matrix = [
    //         1         2
    // 12345678901234567890123456
    "000000000000000000000000000", // row 0
    "010011100111110000000000000", // row 1: single(1), h-pair(2,3), h-triple(4,5,6)
    "000000000000000000000000000", // row 2
    "010010001100110011000110000", // row 3: v-pair top(7), v-triple top(9), L corners
    "010010001100010010000100000", // row 4: v-pair bot(8), v-triple mid(10)
    "000010000000110011000110000", // row 5: v-triple bot(11), more L corners
    "000000000000000000000000000", // row 6
    "001000010001000010000000000", // row 7: T-junctions top row
    "011100111001110111011100000", // row 8: T-junctions middle
    "001000010001000010001000000", // row 9: T-junctions bottom
    "000000000000000000000000000", // row 10
    "000001100000000000000000000", // row 11: 2x2 block top
    "000001100000000000000000000", // row 12: 2x2 block bottom
    "000000000000000000000000000", // row 13
    "111111111110111111111111111", // row 14: wall with start gate (col 10 is gate)
    "100000000000000000000000001", // row 15: side walls with pathway
    "111111111111111111110111111", // row 16: wall with end gate (col 20 is gate)
  ];

  // Set up entry nodes to demonstrate gate openings
  // The gate coordinates point to wall cells that will be skipped (creating openings)
  this.entryNodes = {
    start: { x: 11, y: 15, gate: { x: 10, y: 14 } }, // Start point with gate in top wall
    end: { x: 19, y: 15, gate: { x: 20, y: 16 } }    // End point with gate in bottom wall
  };
};

Maze.prototype.transformMatrix = function () {
  if (!this.matrix.length) return;

  const origRows = this.matrix.length;
  const origCols = this.matrix[0].length;
  const pw = this.pathWidth;
  const ph = this.pathHeight;

  // Calculate new dimensions
  // Even indices (walls) stay 1, odd indices (corridors) scale
  const getNewCol = (c) => Math.ceil(c / 2) + Math.floor(c / 2) * pw;
  const getNewRow = (r) => Math.ceil(r / 2) + Math.floor(r / 2) * ph;
  const getColWidth = (c) => (c % 2 === 0) ? 1 : pw;
  const getRowHeight = (r) => (r % 2 === 0) ? 1 : ph;

  const newCols = getNewCol(origCols - 1) + getColWidth(origCols - 1);
  const newRows = getNewRow(origRows - 1) + getRowHeight(origRows - 1);

  // Create new matrix filled with walls
  let newMatrix = [];
  for (let r = 0; r < newRows; r++) {
    newMatrix.push("1".repeat(newCols));
  }

  // Transform each cell from original to new matrix
  for (let r = 0; r < origRows; r++) {
    for (let c = 0; c < origCols; c++) {
      const value = this.matrix[r].charAt(c);
      const newR = getNewRow(r);
      const newC = getNewCol(c);
      const blockH = getRowHeight(r);
      const blockW = getColWidth(c);

      // Fill the block in the new matrix
      for (let dr = 0; dr < blockH; dr++) {
        for (let dc = 0; dc < blockW; dc++) {
          const row = newR + dr;
          const col = newC + dc;
          newMatrix[row] = newMatrix[row].substring(0, col) + value + newMatrix[row].substring(col + 1);
        }
      }
    }
  }

  this.matrix = newMatrix;

  // Transform entry nodes to new coordinates
  this.transformEntryNodes(getNewCol, getNewRow);
};

Maze.prototype.transformEntryNodes = function (getNewCol, getNewRow) {
  if (!this.entryNodes) return;

  if (this.entryNodes.start) {
    const s = this.entryNodes.start;
    s.x = getNewCol(s.x);
    s.y = getNewRow(s.y);
    if (s.gate) {
      s.gate.x = getNewCol(s.gate.x);
      s.gate.y = getNewRow(s.gate.y);
    }
  }

  if (this.entryNodes.end) {
    const e = this.entryNodes.end;
    e.x = getNewCol(e.x);
    e.y = getNewRow(e.y);
    if (e.gate) {
      e.gate.x = getNewCol(e.gate.x);
      e.gate.y = getNewRow(e.gate.y);
    }
  }
};

Maze.prototype.isValidSize = function () {
  const max = this.maxCanvasDimension;
  const canvas_width = (this.width * 2 + 1) * this.wallSize;
  const canvas_height = (this.height * 2 + 1) * this.wallSize;

  // Max dimension Firefox and Chrome
  if (max && (max <= canvas_width || max <= canvas_height)) {
    return false;
  }

  // Max area (200 columns) * (200 rows) with wall size 10px
  if (this.maxCanvas && this.maxCanvas <= canvas_width * canvas_height) {
    return false;
  }

  return true;
};

Maze.prototype.generateNodes = function () {
  const count = this.width * this.height;
  let nodes = [];

  for (let i = 0; i < count; i++) {
    // visited, nswe
    nodes[i] = "01111";
  }

  return nodes;
};

Maze.prototype.parseMaze = function (nodes) {
  const mazeSize = nodes.length;
  const positionIndex = { n: 1, s: 2, w: 3, e: 4 };
  const oppositeIndex = { n: 2, s: 1, w: 4, e: 3 };

  if (!mazeSize) {
    return;
  }

  let max = 0;
  let moveNodes = [];
  let visited = 0;
  let position = parseInt(Math.floor(Math.random() * nodes.length), 10);

  let biasCount = 0;
  let biasFactor = 3;
  if (this.bias) {
    if ("horizontal" === this.bias) {
      biasFactor = 1 <= this.width / 100 ? Math.floor(this.width / 100) + 2 : 3;
    } else if ("vertical" === this.bias) {
      biasFactor =
        1 <= this.height / 100 ? Math.floor(this.height / 100) + 2 : 3;
    }
  }

  // Set start node visited.
  nodes[position] = replaceAt(nodes[position], 0, 1);

  while (visited < mazeSize - 1) {
    biasCount++;

    max++;
    if (this.maxMaze && this.maxMaze < max) {
      alert("Please use smaller maze dimensions");
      move_nodes = [];
      this.matrix = [];
      return [];
    }

    let next = this.getNeighbours(position);
    let directions = Object.keys(next).filter(function (key) {
      return -1 !== next[key] && !stringVal(this[next[key]], 0);
    }, nodes);

    if (this.bias && biasCount !== biasFactor) {
      directions = this.biasDirections(directions);
    } else {
      biasCount = 0;
    }

    if (directions.length) {
      ++visited;

      if (1 < directions.length) {
        moveNodes.push(position);
      }

      let direction = directions[Math.floor(Math.random() * directions.length)];

      // Update current position
      nodes[position] = replaceAt(nodes[position], positionIndex[direction], 0);
      // Set new position
      position = next[direction];

      // Update next position
      nodes[position] = replaceAt(nodes[position], oppositeIndex[direction], 0);
      nodes[position] = replaceAt(nodes[position], 0, 1);
    } else {
      if (!moveNodes.length) {
        break;
      }

      position = moveNodes.pop();
    }
  }

  return nodes;
};

Maze.prototype.getMatrix = function (nodes) {
  const mazeSize = this.width * this.height;

  // Add the complete maze in a matrix
  // where 1 is a wall and 0 is a corridor.

  let row1 = "";
  let row2 = "";

  if (nodes.length !== mazeSize) {
    return;
  }

  for (let i = 0; i < mazeSize; i++) {
    row1 += !row1.length ? "1" : "";
    row2 += !row2.length ? "1" : "";

    if (stringVal(nodes[i], 1)) {
      row1 += "11";
      if (stringVal(nodes[i], 4)) {
        row2 += "01";
      } else {
        row2 += "00";
      }
    } else {
      let hasAbove = nodes.hasOwnProperty(i - this.width);
      let above = hasAbove && stringVal(nodes[i - this.width], 4);
      let hasNext = nodes.hasOwnProperty(i + 1);
      let next = hasNext && stringVal(nodes[i + 1], 1);

      if (stringVal(nodes[i], 4)) {
        row1 += "01";
        row2 += "01";
      } else if (next || above) {
        row1 += "01";
        row2 += "00";
      } else {
        row1 += "00";
        row2 += "00";
      }
    }

    if (0 === (i + 1) % this.width) {
      this.matrix.push(row1);
      this.matrix.push(row2);
      row1 = "";
      row2 = "";
    }
  }

  // Add closing row
  this.matrix.push("1".repeat(this.width * 2 + 1));
};

Maze.prototype.getEntryNodes = function (access, flipStart, flipExit) {
  const y = this.height * 2 + 1 - 2;
  const x = this.width * 2 + 1 - 2;

  let entryNodes = {};
  flipStart = !!flipStart;
  flipExit = !!flipExit;

  // Handle random - pick any entry type
  // Start always on visual top half (north/west walls), exit always on visual bottom half (east/south walls)
  if ("diagonal-random" === access) {
    const options = ["diagonal", "diagonal-alt", "horizontal", "vertical", "same-left", "same-right"];
    access = options[Math.floor(Math.random() * options.length)];
  }

  if ("diagonal" === access) {
    // Start on west wall (visual top-left), exit on east wall (visual bottom-right)
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  if ("diagonal-alt" === access) {
    // Start on north wall (visual top-right), exit on south wall (visual bottom-left)
    entryNodes.start = { x: x, y: 1, gate: { x: x, y: 0 } };
    entryNodes.end = { x: 1, y: y, gate: { x: 1, y: y + 1 } };
  }

  if ("horizontal" === access) {
    // Start on west wall (visual top-left), exit on east wall (visual bottom-right)
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  if ("vertical" === access) {
    // Start on north wall (visual top-right), exit on south wall (visual bottom-left)
    entryNodes.start = { x: x, y: 1, gate: { x: x, y: 0 } };
    entryNodes.end = { x: 1, y: y, gate: { x: 1, y: y + 1 } };
  }

  if ("same-left" === access) {
    // Both on left visual side: start on west wall (NW), exit on south wall (SW)
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: 1, y: y, gate: { x: 1, y: y + 1 } };
  }

  if ("same-right" === access) {
    // Both on right visual side: start on north wall (NE), exit on east wall (SE)
    entryNodes.start = { x: x, y: 1, gate: { x: x, y: 0 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  // Apply flip logic - move gate to other end of its wall
  if (flipStart && entryNodes.start) {
    const s = entryNodes.start;
    if (s.gate.x === 0) {
      // West wall: flip y position
      s.y = s.y === 1 ? y : 1;
      s.gate.y = s.y;
    } else if (s.gate.y === 0) {
      // North wall: flip x position
      s.x = s.x === 1 ? x : 1;
      s.gate.x = s.x;
    }
  }

  if (flipExit && entryNodes.end) {
    const e = entryNodes.end;
    if (e.gate.x === x + 1) {
      // East wall: flip y position
      e.y = e.y === 1 ? y : 1;
      e.gate.y = e.y;
    } else if (e.gate.y === y + 1) {
      // South wall: flip x position
      e.x = e.x === 1 ? x : 1;
      e.gate.x = e.x;
    }
  }

  return entryNodes;
};

Maze.prototype.biasDirections = function (directions) {
  const horizontal =
    -1 !== directions.indexOf("w") || -1 !== directions.indexOf("e");
  const vertical =
    -1 !== directions.indexOf("n") || -1 !== directions.indexOf("s");

  if ("horizontal" === this.bias && horizontal) {
    directions = directions.filter(function (key) {
      return "w" === key || "e" === key;
    });
  } else if ("vertical" === this.bias && vertical) {
    directions = directions.filter(function (key) {
      return "n" === key || "s" === key;
    });
  }

  return directions;
};

Maze.prototype.getNeighbours = function (pos) {
  return {
    n: 0 <= pos - this.width ? pos - this.width : -1,
    s: this.width * this.height > pos + this.width ? pos + this.width : -1,
    w: 0 < pos && 0 !== pos % this.width ? pos - 1 : -1,
    e: 0 !== (pos + 1) % this.width ? pos + 1 : -1,
  };
};

Maze.prototype.removeWall = function (row, index) {
  // Remove wall if possible.
  const evenRow = row % 2 === 0;
  const evenIndex = index % 2 === 0;
  const wall = stringVal(this.matrix[row], index);

  if (!wall) {
    return false;
  }

  if (!evenRow && evenIndex) {
    // Uneven row and even column
    const hasTop = row - 2 > 0 && 1 === stringVal(this.matrix[row - 2], index);
    const hasBottom =
      row + 2 < this.matrix.length &&
      1 === stringVal(this.matrix[row + 2], index);

    if (hasTop && hasBottom) {
      this.matrix[row] = replaceAt(this.matrix[row], index, "0");
      return true;
    } else if (!hasTop && hasBottom) {
      const left = 1 === stringVal(this.matrix[row - 1], index - 1);
      const right = 1 === stringVal(this.matrix[row - 1], index + 1);
      if (left || right) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    } else if (!hasBottom && hasTop) {
      const left = 1 === stringVal(this.matrix[row + 1], index - 1);
      const right = 1 === stringVal(this.matrix[row + 1], index + 1);
      if (left || right) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    }
  } else if (evenRow && !evenIndex) {
    // Even row and uneven column
    const hasLeft = 1 === stringVal(this.matrix[row], index - 2);
    const hasRight = 1 === stringVal(this.matrix[row], index + 2);

    if (hasLeft && hasRight) {
      this.matrix[row] = replaceAt(this.matrix[row], index, "0");
      return true;
    } else if (!hasLeft && hasRight) {
      const top = 1 === stringVal(this.matrix[row - 1], index - 1);
      const bottom = 1 === stringVal(this.matrix[row + 1], index - 1);
      if (top || bottom) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    } else if (!hasRight && hasLeft) {
      const top = 1 === stringVal(this.matrix[row - 1], index + 1);
      const bottom = 1 === stringVal(this.matrix[row + 1], index + 1);
      if (top || bottom) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    }
  }

  return false;
};

Maze.prototype.removeMazeWalls = function () {
  if (!this.removeWalls || !this.matrix.length) {
    return;
  }

  const min = 1;
  const max = this.matrix.length - 1;
  const maxTries = this.maxWallsRemove;
  let tries = 0;

  while (tries < maxTries) {
    tries++;

    // Did we reached the goal
    if (this.wallsRemoved >= this.removeWalls) {
      break;
    }

    // Get random row from matrix
    let y = Math.floor(Math.random() * (max - min + 1)) + min;
    y = y === max ? y - 1 : y;

    let walls = [];
    let row = this.matrix[y];

    // Get walls from random row
    for (let i = 0; i < row.length; i++) {
      if (i === 0 || i === row.length - 1) {
        continue;
      }

      const wall = stringVal(row, i);
      if (wall) {
        walls.push(i);
      }
    }

    // Shuffle walls randomly
    shuffleArray(walls);

    // Try breaking a wall for this row.
    for (let i = 0; i < walls.length; i++) {
      if (this.removeWall(y, walls[i])) {
        // Wall can be broken
        this.wallsRemoved++;
        break;
      }
    }
  }
};

Maze.prototype.createRhombus = function ({
  ctx,
  isoX,
  isoY,
  tileWidth,
  tileHeight,
}) {
  // Draw the isometric tile
  ctx.beginPath();
  ctx.moveTo(isoX, isoY);
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5);
  ctx.lineTo(isoX, isoY + tileHeight);
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5);
  ctx.closePath();
  ctx.fill();
};

Maze.prototype.createBorderCube = function ({
  ctx,
  isoX,
  isoY,
  tileWidth,
  tileHeight,
  height = tileHeight, // Height of the cube
  borderColor = "#000000", // Border color
  lineWidth = 2, // Border thickness
  showStroke = true,
  strokeTop = true,
  strokeBottom = true,
  strokeCorners = true,
  strokeWallCorners = false,
  debugStrokeColors = false,
  leftPixel = 0,
  rightPixel = 0,
  topPixel = 0,
  bottomPixel = 0,
  topRightPixel = 0, // Diagonal neighbor for T-junction detection
  bottomRightPixel = 0, // Diagonal neighbor for T-junction detection (other orientation)
}) {
  // Set border style
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Key points for the cube
  const topCenter = { x: isoX, y: isoY };
  const topRight = { x: isoX + tileWidth * 0.5, y: isoY + tileHeight * 0.5 };
  const bottomCenter = { x: isoX, y: isoY + tileHeight };
  const topLeft = { x: isoX - tileWidth * 0.5, y: isoY + tileHeight * 0.5 };
  const bottomLeft = { x: isoX - tileWidth * 0.5, y: isoY + tileHeight * 0.5 + height };
  const bottomRight = { x: isoX + tileWidth * 0.5, y: isoY + tileHeight * 0.5 + height };
  const bottomCenterLow = { x: isoX, y: isoY + tileHeight + height };

  // Extended top face vertices - extend upward very slightly when there's a wall above
  // to cover anti-aliasing artifacts without reaching the stroke area
  const topOverlap = topPixel ? 0.1 : 0;
  const topCenterFill = { x: topCenter.x, y: topCenter.y - topOverlap };
  const topRightFill = { x: topRight.x, y: topRight.y - topOverlap * 0.5 };
  const topLeftFill = { x: topLeft.x, y: topLeft.y - topOverlap * 0.5 };

  // Extended bottom vertices - extend downward slightly when there's a wall below
  const bottomOverlap = bottomPixel ? 0.5 : 0;
  const bottomLeftFill = { x: bottomLeft.x, y: bottomLeft.y + bottomOverlap * 0.5 };
  const bottomRightFill = { x: bottomRight.x, y: bottomRight.y + bottomOverlap * 0.5 };
  const bottomCenterLowFill = { x: bottomCenterLow.x, y: bottomCenterLow.y + bottomOverlap };

  // Draw top face
  if (topPixel) {
    ctx.fillStyle = "#ff0000";
  } else if (leftPixel || rightPixel) {
    ctx.fillStyle = "#ff00ff";
  } else {
    ctx.fillStyle = "#00ff00";
  }

  ctx.beginPath();
  ctx.moveTo(topCenterFill.x, topCenterFill.y);
  ctx.lineTo(topRightFill.x, topRightFill.y);
  ctx.lineTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeftFill.x, topLeftFill.y);
  ctx.closePath();
  ctx.fill();

  // Draw left face - use extended vertices for both top and bottom
  ctx.fillStyle = "#aaa";
  ctx.beginPath();
  ctx.moveTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeftFill.x, topLeftFill.y);
  ctx.lineTo(bottomLeftFill.x, bottomLeftFill.y);
  ctx.lineTo(bottomCenterLowFill.x, bottomCenterLowFill.y);
  ctx.closePath();
  ctx.fill();

  // Draw right face - use extended vertices for both top and bottom
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topRightFill.x, topRightFill.y);
  ctx.lineTo(bottomRightFill.x, bottomRightFill.y);
  ctx.lineTo(bottomCenterLowFill.x, bottomCenterLowFill.y);
  ctx.closePath();
  ctx.fill();

  // Draw strokes selectively
  if (showStroke) {
    // Debug color codes (when debugStrokeColors is enabled):
    // Top edges: Red = topCenter→topRight, Orange = topRight→bottomCenter
    //            Yellow = bottomCenter→topLeft, Lime = topLeft→topCenter
    // Bottom: Cyan
    // Left corner: Blue, Center corner: Magenta, Right corner: Green

    // Top face edges - when strokeWallCorners is enabled, only draw edges on the outer boundary
    if (strokeTop) {
      if (strokeWallCorners) {
        // Draw each edge only if there's no adjacent wall sharing it
        if (!topPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#FF0000"; // RED
          ctx.beginPath();
          ctx.moveTo(topCenter.x, topCenter.y);
          ctx.lineTo(topRight.x, topRight.y);
          ctx.stroke();
        }
        if (!rightPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#FF8800"; // ORANGE
          ctx.beginPath();
          ctx.moveTo(topRight.x, topRight.y);
          ctx.lineTo(bottomCenter.x, bottomCenter.y);
          ctx.stroke();
        }
        if (!bottomPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#CCCC00"; // YELLOW
          ctx.beginPath();
          ctx.moveTo(bottomCenter.x, bottomCenter.y);
          ctx.lineTo(topLeft.x, topLeft.y);
          ctx.stroke();
        }
        if (!leftPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#88FF00"; // LIME
          ctx.beginPath();
          ctx.moveTo(topLeft.x, topLeft.y);
          ctx.lineTo(topCenter.x, topCenter.y);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(topCenter.x, topCenter.y);
        ctx.lineTo(topRight.x, topRight.y);
        ctx.lineTo(bottomCenter.x, bottomCenter.y);
        ctx.lineTo(topLeft.x, topLeft.y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    if (strokeBottom) {
      if (debugStrokeColors) ctx.strokeStyle = "#00FFFF"; // CYAN
      ctx.beginPath();
      ctx.moveTo(bottomLeft.x, bottomLeft.y);
      ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.stroke();
    }

    // Corner edges (vertical edges)
    // strokeWallCorners: only draw at wall section corners (outer perimeter of wall structure)
    // strokeCorners: draw all vertical edges on every cube
    if (strokeWallCorners) {
      // Left corner - draw if left face is exposed (no wall to the left)
      if (!leftPixel) {
        if (debugStrokeColors) ctx.strokeStyle = "#0000FF"; // BLUE
        ctx.beginPath();
        ctx.moveTo(topLeft.x, topLeft.y);
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.stroke();
      }

      // Center corner (front) - only draw when fully exposed at front
      // If there's a wall below (bottomPixel) or to the right (rightPixel), that cube's
      // face will be drawn on top of this stroke, causing thin line artifacts
      if (!bottomPixel && !rightPixel) {
        if (debugStrokeColors) ctx.strokeStyle = "#FF00FF"; // MAGENTA
        ctx.beginPath();
        ctx.moveTo(bottomCenter.x, bottomCenter.y);
        ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
        ctx.stroke();
      }

      // Right corner - draw only at the TOP of a vertical wall section or at inner corners
      // If topPixel=1 (wall above), this edge is interior to a vertical wall, UNLESS
      // the wall above has horizontal extension (topRightPixel=1), making it a T/+ junction
      const rightExposed = !rightPixel && !topPixel;
      const innerCornerTop = !rightPixel && topPixel && topRightPixel;
      const innerLCorner = rightPixel && ((topPixel && !topRightPixel) || (bottomPixel && !bottomRightPixel));
      const tJunctionTop = rightPixel && !topPixel && topRightPixel;
      const tJunctionBottom = rightPixel && !bottomPixel && bottomRightPixel;
      if (rightExposed || innerCornerTop || innerLCorner || tJunctionTop || tJunctionBottom) {
        if (debugStrokeColors) ctx.strokeStyle = "#00FF00"; // GREEN
        ctx.beginPath();
        ctx.moveTo(topRight.x, topRight.y);
        ctx.lineTo(bottomRight.x, bottomRight.y);
        ctx.stroke();
      }
    } else if (strokeCorners) {
      ctx.beginPath();
      ctx.moveTo(topLeft.x, topLeft.y);
      ctx.lineTo(bottomLeft.x, bottomLeft.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bottomCenter.x, bottomCenter.y);
      ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(topRight.x, topRight.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.stroke();
    }
  }
};

Maze.prototype.createTexturedCube = function ({
  ctx,
  isoX,
  isoY,
  tileWidth,
  tileHeight,
  height = tileHeight,
  wallHeight = 1, // Number of tile units tall (for texture tiling)
  leftImage = null,
  rightImage = null,
  topColor = "#ffffff",
  borderColor = "#000000",
  lineWidth = 2,
  showStroke = true,
  strokeTop = true,
  strokeBottom = true,
  strokeCorners = true,
  strokeWallCorners = false,
  debugStrokeColors = false,
  wallBgColor = "",
  tightSpacing = false,
  // Neighbor info for wall corner detection
  leftPixel = 0,
  rightPixel = 0,
  topPixel = 0,
  bottomPixel = 0,
  topRightPixel = 0, // Diagonal neighbor for T-junction detection
  bottomRightPixel = 0, // Diagonal neighbor for T-junction detection (other orientation)
}) {
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Key points for the cube
  const topCenter = { x: isoX, y: isoY };
  const topRight = { x: isoX + tileWidth * 0.5, y: isoY + tileHeight * 0.5 };
  const bottomCenter = { x: isoX, y: isoY + tileHeight };
  const topLeft = { x: isoX - tileWidth * 0.5, y: isoY + tileHeight * 0.5 };
  const bottomLeft = { x: isoX - tileWidth * 0.5, y: isoY + tileHeight * 0.5 + height };
  const bottomRight = { x: isoX + tileWidth * 0.5, y: isoY + tileHeight * 0.5 + height };
  const bottomCenterLow = { x: isoX, y: isoY + tileHeight + height };

  // Extended top face vertices - extend upward very slightly when there's a wall above
  // to cover anti-aliasing artifacts without reaching the stroke area
  const topOverlap = topPixel ? 0.1 : 0;
  const topCenterFill = { x: topCenter.x, y: topCenter.y - topOverlap };
  const topRightFill = { x: topRight.x, y: topRight.y - topOverlap * 0.5 };
  const topLeftFill = { x: topLeft.x, y: topLeft.y - topOverlap * 0.5 };

  // Extended bottom vertices - extend downward slightly when there's a wall below
  const bottomOverlap = bottomPixel ? 0.5 : 0;
  const bottomLeftFill = { x: bottomLeft.x, y: bottomLeft.y + bottomOverlap * 0.5 };
  const bottomRightFill = { x: bottomRight.x, y: bottomRight.y + bottomOverlap * 0.5 };
  const bottomCenterLowFill = { x: bottomCenterLow.x, y: bottomCenterLow.y + bottomOverlap };

  // Draw top face (solid color)
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(topCenterFill.x, topCenterFill.y);
  ctx.lineTo(topRightFill.x, topRightFill.y);
  ctx.lineTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeftFill.x, topLeftFill.y);
  ctx.closePath();
  ctx.fill();

  // Tight spacing padding for wall faces
  const tightPad = tightSpacing ? lineWidth * 0.5 : 0;

  // Draw left face with image or fallback color
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
  ctx.closePath();

  if (leftImage) {
    if (wallBgColor) {
      ctx.fillStyle = wallBgColor;
      ctx.fill();
    }
    ctx.clip();
    // Expand image slightly when tightSpacing to eliminate gaps
    const leftDrawX = topLeft.x - tightPad;
    const leftDrawW = tileWidth * 0.5 + tightPad * 2;

    // Tile vertically if wall is taller than 1 unit
    const tilesCount = Math.ceil(wallHeight);
    const singleTileH = height / wallHeight;
    for (let t = 0; t < tilesCount; t++) {
      const leftDrawY = topLeft.y - tightPad + t * singleTileH;
      const leftDrawH = singleTileH + (t === 0 ? tightPad : 0) + (t === tilesCount - 1 ? tightPad : 0);
      ctx.drawImage(leftImage, leftDrawX, leftDrawY, leftDrawW, leftDrawH);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = wallBgColor || "#aaa";
    ctx.fill();
    ctx.restore();
  }

  // Draw right face with image or fallback color
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
  ctx.closePath();

  if (rightImage) {
    if (wallBgColor) {
      ctx.fillStyle = wallBgColor;
      ctx.fill();
    }
    ctx.clip();
    // Expand image slightly when tightSpacing to eliminate gaps
    const rightDrawX = isoX - tightPad;
    const rightDrawW = tileWidth * 0.5 + tightPad * 2;

    // Tile vertically if wall is taller than 1 unit
    const tilesCountR = Math.ceil(wallHeight);
    const singleTileHR = height / wallHeight;
    for (let t = 0; t < tilesCountR; t++) {
      const rightDrawY = topRight.y - tightPad + t * singleTileHR;
      const rightDrawH = singleTileHR + (t === 0 ? tightPad : 0) + (t === tilesCountR - 1 ? tightPad : 0);
      ctx.drawImage(rightImage, rightDrawX, rightDrawY, rightDrawW, rightDrawH);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = wallBgColor || "#888";
    ctx.fill();
    ctx.restore();
  }

  // Draw strokes selectively
  if (showStroke) {
    // DEBUG: Color codes for strokeWallCorners mode
    // Debug color codes (when debugStrokeColors is enabled):
    // Top edges: Red = topCenter→topRight, Orange = topRight→bottomCenter
    //            Yellow = bottomCenter→topLeft, Lime = topLeft→topCenter
    // Bottom: Cyan
    // Left corner: Blue, Center corner: Magenta, Right corner: Green

    // Top face edges - when strokeWallCorners is enabled, only draw edges on the outer boundary
    if (strokeTop) {
      if (strokeWallCorners) {
        // Draw each edge only if there's no adjacent wall sharing it
        if (!topPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#FF0000"; // RED
          ctx.beginPath();
          ctx.moveTo(topCenter.x, topCenter.y);
          ctx.lineTo(topRight.x, topRight.y);
          ctx.stroke();
        }
        if (!rightPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#FF8800"; // ORANGE
          ctx.beginPath();
          ctx.moveTo(topRight.x, topRight.y);
          ctx.lineTo(bottomCenter.x, bottomCenter.y);
          ctx.stroke();
        }
        if (!bottomPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#CCCC00"; // YELLOW
          ctx.beginPath();
          ctx.moveTo(bottomCenter.x, bottomCenter.y);
          ctx.lineTo(topLeft.x, topLeft.y);
          ctx.stroke();
        }
        if (!leftPixel) {
          if (debugStrokeColors) ctx.strokeStyle = "#88FF00"; // LIME
          ctx.beginPath();
          ctx.moveTo(topLeft.x, topLeft.y);
          ctx.lineTo(topCenter.x, topCenter.y);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(topCenter.x, topCenter.y);
        ctx.lineTo(topRight.x, topRight.y);
        ctx.lineTo(bottomCenter.x, bottomCenter.y);
        ctx.lineTo(topLeft.x, topLeft.y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Bottom edges (horizontal bottom of cube)
    if (strokeBottom) {
      if (debugStrokeColors) ctx.strokeStyle = "#00FFFF"; // CYAN
      ctx.beginPath();
      ctx.moveTo(bottomLeft.x, bottomLeft.y);
      ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.stroke();
    }

    // Corner edges (vertical edges)
    // strokeWallCorners: only draw at wall section corners (outer perimeter of wall structure)
    // strokeCorners: draw all vertical edges on every cube
    if (strokeWallCorners) {
      // Left corner - draw if left face is exposed (no wall to the left)
      if (!leftPixel) {
        if (debugStrokeColors) ctx.strokeStyle = "#0000FF"; // BLUE
        ctx.beginPath();
        ctx.moveTo(topLeft.x, topLeft.y);
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.stroke();
      }

      // Center corner (front) - only draw when fully exposed at front
      // If there's a wall below (bottomPixel) or to the right (rightPixel), that cube's
      // face will be drawn on top of this stroke, causing thin line artifacts
      if (!bottomPixel && !rightPixel) {
        if (debugStrokeColors) ctx.strokeStyle = "#FF00FF"; // MAGENTA
        ctx.beginPath();
        ctx.moveTo(bottomCenter.x, bottomCenter.y);
        ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
        ctx.stroke();
      }

      // Right corner - draw only at the TOP of a vertical wall section or at inner corners
      // If topPixel=1 (wall above), this edge is interior to a vertical wall, UNLESS
      // the wall above has horizontal extension (topRightPixel=1), making it a T/+ junction
      const rightExposed = !rightPixel && !topPixel;
      const innerCornerTop = !rightPixel && topPixel && topRightPixel;
      const innerLCorner = rightPixel && ((topPixel && !topRightPixel) || (bottomPixel && !bottomRightPixel));
      const tJunctionTop = rightPixel && !topPixel && topRightPixel;
      const tJunctionBottom = rightPixel && !bottomPixel && bottomRightPixel;
      if (rightExposed || innerCornerTop || innerLCorner || tJunctionTop || tJunctionBottom) {
        if (debugStrokeColors) ctx.strokeStyle = "#00FF00"; // GREEN
        ctx.beginPath();
        ctx.moveTo(topRight.x, topRight.y);
        ctx.lineTo(bottomRight.x, bottomRight.y);
        ctx.stroke();
      }
    } else if (strokeCorners) {
      // Left corner
      ctx.beginPath();
      ctx.moveTo(topLeft.x, topLeft.y);
      ctx.lineTo(bottomLeft.x, bottomLeft.y);
      ctx.stroke();

      // Center corner (front)
      ctx.beginPath();
      ctx.moveTo(bottomCenter.x, bottomCenter.y);
      ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
      ctx.stroke();

      // Right corner
      ctx.beginPath();
      ctx.moveTo(topRight.x, topRight.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.stroke();
    }
  }
};

Maze.prototype.createCube = function ({
  ctx,
  isoX,
  isoY,
  tileWidth,
  tileHeight,
  height = tileHeight, // Height of the cube
  topColor = "#cccccc",
  leftColor = "#aaaaaa",
  rightColor = "#888888",
}) {
  // Top face
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(isoX, isoY); // Top center
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5); // Top right
  ctx.lineTo(isoX, isoY + tileHeight); // Bottom center
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5); // Top left
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(isoX, isoY + tileHeight); // Bottom center
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5); // Top left
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5 + height); // Bottom left
  ctx.lineTo(isoX, isoY + tileHeight + height); // Bottom center extended
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(isoX, isoY + tileHeight); // Bottom center
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5); // Top right
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5 + height); // Bottom right
  ctx.lineTo(isoX, isoY + tileHeight + height); // Bottom center extended
  ctx.closePath();
  ctx.fill();
};

Maze.prototype.draw = function () {
  const canvas = document.getElementById("maze");
  if (!canvas || !this.matrix.length) {
    return;
  }

  const scale = this.displayScale;
  const tileWidth = this.wallSize; // Base tile width
  const tileHeight = this.wallSize * this.isoRatio; // Base tile height (configurable ratio)

  // Use actual matrix dimensions (may be transformed)
  const matrixCols = this.matrix[0].length;
  const matrixRows = this.matrix.length;

  // Calculate the full isometric dimensions
  const isoWidth = matrixCols * tileWidth * 0.5; // Isometric width
  const isoHeight = matrixRows * tileHeight * 0.5; // Isometric height
  const cubeHeight = tileHeight * this.wallHeight; // Height of the 3D cube faces extending below

  // Adjust canvas size to fit the isometric maze (scaled)
  // Only add stroke margin if strokes are enabled and tight spacing is off
  // strokeMargin accounts for stroke extending beyond tile edges on all sides
  const strokeMargin = (this.showStroke && !this.tightSpacing) ? this.strokeWidth : 0;
  const halfStrokeMargin = strokeMargin * 0.5;
  canvas.width = (isoWidth * 2 + strokeMargin) * scale; // Total projected width
  // Height needs: grid area (isoHeight*2) + top offset (tileHeight) + bottom cube extension (tileHeight + cubeHeight)
  canvas.height = (isoHeight * 2 + tileHeight * 2 + cubeHeight + strokeMargin) * scale;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale); // Apply display scale to all drawing operations

  // Add background (use unscaled dimensions since ctx is already scaled)
  ctx.fillStyle = this.backgroundColor;
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

  // Set maze color
  ctx.fillStyle = this.color;

  // Reset cube numbering for debug pattern
  this.wallCubeNumber = 0;

  const rowCount = this.matrix.length;
  const gateEntry = getEntryNode(this.entryNodes, "start", true);
  const gateExit = getEntryNode(this.entryNodes, "end", true);

  // Offset to center the maze on the canvas (use unscaled dimensions since ctx is scaled)
  // Add halfStrokeMargin to ensure strokes at the edges don't get clipped
  const offsetX = isoWidth + halfStrokeMargin; // Center the maze horizontally with stroke margin
  const offsetY = tileHeight + halfStrokeMargin; // Add vertical margin with stroke margin

  // Helper to get start/end nodes (cache outside loops)
  const startNode = getEntryNode(this.entryNodes, "start", false);
  const endNode = getEntryNode(this.entryNodes, "end", false);

  // Check if pathway is an array (for random tile selection)
  const pathwayIsArray = Array.isArray(this.tileImages.pathway);
  const pathwayTiles = pathwayIsArray ? this.tileImages.pathway : null;
  const pathwayWeights = pathwayIsArray ? this.tileWeights.pathway : null;

  // Helper to get a floor tile for a given position (uses weighted random selection)
  const getFloorTile = (gridX, gridY) => {
    if (pathwayIsArray && pathwayTiles.length > 0) {
      const idx = this.getWeightedTileIndex('pathway', gridX, gridY);
      return idx >= 0 ? pathwayTiles[idx] : null; // May be null for "blank" tiles
    }
    return this.tileImages.pathway || null;
  };

  // PASS 1: Draw all floor/pathway tiles first
  for (let i = 0; i < rowCount; i++) {
    const rowLength = this.matrix[i].length;
    for (let j = 0; j < rowLength; j++) {
      if (gateEntry && gateExit) {
        if (j === gateEntry.x && i === gateEntry.y) continue;
        if (j === gateExit.x && i === gateExit.y) continue;
      }

      const pixel = parseInt(this.matrix[i].charAt(j), 10);
      if (pixel) continue; // Skip walls in this pass

      // Skip blank floor tiles (cleared by user)
      if (this.isFloorBlank(j, i)) continue;

      const isoX = (j - i) * tileWidth * 0.5 + offsetX;
      const isoY = (j + i) * tileHeight * 0.5 + offsetY;

      const isStart = startNode && j === startNode.x && i === startNode.y;
      const isEnd = endNode && j === endNode.x && i === endNode.y;

      // When tightSpacing is enabled, expand tiles slightly to eliminate stroke-sized gaps
      const tightPadding = this.tightSpacing ? this.strokeWidth * 0.5 : 0;

      // Get floor tile for this position (may be from array or single image)
      const img = getFloorTile(j, i);

      // Draw pathway tile if available (null = blank/solid color, skip drawing)
      if (img) {
        const tileAspect = img.naturalHeight / img.naturalWidth;
        const drawWidth = tileWidth + tightPadding * 2;
        const drawHeight = drawWidth * tileAspect;
        const drawX = isoX - drawWidth * 0.5;
        const drawY = isoY - tightPadding * tileAspect;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }

      // Draw block number on pathway (aligned to bottom of floor tile)
      if (this.showBlockNumbers) {
        const fontSize = Math.max(2, tileWidth * 0.0032);
        ctx.fillStyle = "#000000";
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        // Position at bottom of the floor tile (above where cube base would be)
        const labelY = isoY + tileHeight + cubeHeight - 2;
        ctx.fillText(`${j},${i}`, isoX, labelY);
      }

    }
  }

  // Draw end gate floor tile in PASS 1 (so walls render on top)
  if (gateExit && this.entryNodes.end) {
    const floorImg = getFloorTile(gateExit.x, gateExit.y);
    if (floorImg) {
      const tightPadding = this.tightSpacing ? this.strokeWidth * 0.5 : 0;
      const floorIsoX = (gateExit.x - gateExit.y) * tileWidth * 0.5 + offsetX;
      const floorIsoY = (gateExit.x + gateExit.y) * tileHeight * 0.5 + offsetY;
      const tileAspect = floorImg.naturalHeight / floorImg.naturalWidth;
      const drawWidth = tileWidth + tightPadding * 2;
      const drawHeight = drawWidth * tileAspect;
      const drawX = floorIsoX - drawWidth * 0.5;
      // Bottom-align floor tile to cube base
      const cubeBottomY = floorIsoY + tileHeight + cubeHeight;
      const drawY = cubeBottomY - drawHeight;
      ctx.drawImage(floorImg, drawX, drawY, drawWidth, drawHeight);
    }
  }

  // Helper to draw decorations for a specific layer
  const decorationEntries = Object.entries(this.decorations);
  const drawDecorationsForLayer = (layerName) => {
    if (decorationEntries.length === 0) return;

    const tightPadding = this.tightSpacing ? this.strokeWidth * 0.5 : 0;

    for (const [key, decoration] of decorationEntries) {
      // Skip if not in the requested layer
      const decorLayer = decoration.layer || 'floor';
      if (decorLayer !== layerName) continue;

      const [j, i] = key.split(',').map(Number);

      // Skip if out of bounds
      if (i < 0 || i >= rowCount || j < 0 || j >= this.matrix[i]?.length) continue;

      // Skip if this is a wall cell
      const pixel = parseInt(this.matrix[i]?.charAt(j), 10);
      if (pixel === 1) continue;

      const img = this.decorationImages[decoration.tileUrl];
      if (!img) continue;

      const isoX = (j - i) * tileWidth * 0.5 + offsetX;
      const isoY = (j + i) * tileHeight * 0.5 + offsetY;

      const tileAspect = img.naturalHeight / img.naturalWidth;
      const drawWidth = tileWidth + tightPadding * 2;
      const drawHeight = drawWidth * tileAspect;
      const drawX = isoX - drawWidth * 0.5;
      // Bottom-align decoration to floor level (accounting for wall height)
      const floorBottomY = isoY + tileHeight + cubeHeight;
      const drawY = floorBottomY - drawHeight;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }
  };

  // PASS 1.5: Draw "floor" layer decorations (on top of floors, under walls)
  drawDecorationsForLayer('floor');

  // Helper to check if a position is a gate (should be treated as empty for neighbor calculations)
  const isGate = (x, y) => {
    return (gateEntry && x === gateEntry.x && y === gateEntry.y) ||
           (gateExit && x === gateExit.x && y === gateExit.y);
  };

  // Helper to draw a gate tile at the given position
  // Start gates: draw the marker tile at gate position
  // End gates: draw floor at gate position, marker tile one step further out
  const drawGateTile = (gateX, gateY, isStart) => {
    const entryData = isStart ? this.entryNodes.start : this.entryNodes.end;
    if (!entryData) return;

    const dir = entryData.gate
      ? this.getGateDirection(entryData.x, entryData.y, gateX, gateY)
      : (isStart ? 'N' : 'S');
    const tileKey = (isStart ? 'start' : 'end') + dir;
    const img = this.tileImages[tileKey] || this.tileImages[isStart ? 'start' : 'end'];
    const tightPadding = this.tightSpacing ? this.strokeWidth * 0.5 : 0;

    if (!isStart) {
      // End gate: marker tile one step outward from gate (floor drawn in PASS 1)
      // Calculate outward offset based on gate direction
      let outX = 0, outY = 0;
      if (dir === 'N') outY = -1;
      else if (dir === 'S') outY = 1;
      else if (dir === 'E') outX = 1;
      else if (dir === 'W') outX = -1;

      // Marker tile: one step outward from gate position
      const markerX = gateX + outX;
      const markerY = gateY + outY;

      // Draw end marker tile at offset position, shifted down to align with floor level
      if (img) {
        const markerIsoX = (markerX - markerY) * tileWidth * 0.5 + offsetX;
        const markerIsoY = (markerX + markerY) * tileHeight * 0.5 + offsetY;
        const tileAspect = img.naturalHeight / img.naturalWidth;
        const drawWidth = tileWidth + tightPadding * 2;
        const drawHeight = drawWidth * tileAspect;
        // Apply horizontal offset, inverted for visual left side ('S' in isometric) to push away from wall correctly
        const xOffsetMultiplier = (dir === 'S') ? -1 : 1;
        const drawX = markerIsoX - drawWidth * 0.5 + (this.endMarkerOffsetX * xOffsetMultiplier);
        const cubeBottomY = markerIsoY + tileHeight + cubeHeight;
        const drawY = cubeBottomY - drawHeight + cubeHeight + this.endMarkerOffset; // Shift down one cubeHeight + offset
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }
    } else {
      // Start gate: draw marker tile at gate position
      if (img) {
        const gateIsoX = (gateX - gateY) * tileWidth * 0.5 + offsetX;
        const gateIsoY = (gateX + gateY) * tileHeight * 0.5 + offsetY;
        const tileAspect = img.naturalHeight / img.naturalWidth;
        const drawWidth = tileWidth + tightPadding * 2;
        const drawHeight = drawWidth * tileAspect;
        const drawX = gateIsoX - drawWidth * 0.5;
        // Bottom-align: position so tile bottom matches the base of wall cubes
        const cubeBottomY = gateIsoY + tileHeight + cubeHeight;
        const drawY = cubeBottomY - drawHeight;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }
    }
  };

  // PASS 2: Draw all wall tiles and gate tiles in correct depth order
  for (let i = 0; i < rowCount; i++) {
    const rowLength = this.matrix[i].length;
    for (let j = 0; j < rowLength; j++) {
      // Check if this is a gate position - draw gate tile instead of wall
      const isStartGate = gateEntry && j === gateEntry.x && i === gateEntry.y;
      const isEndGate = gateExit && j === gateExit.x && i === gateExit.y;

      if (isStartGate) {
        drawGateTile(j, i, true);
        continue;
      }
      if (isEndGate) {
        drawGateTile(j, i, false);
        continue;
      }

      const pixel = parseInt(this.matrix[i].charAt(j), 10);
      if (!pixel) continue; // Skip floors in this pass

      // Get neighbor pixel values, treating gate positions as empty (0)
      const leftPixel = j > 0 ? (isGate(j - 1, i) ? 0 : parseInt(this.matrix[i].charAt(j - 1), 10)) : 0;
      const rightPixel = j < rowLength - 1 ? (isGate(j + 1, i) ? 0 : parseInt(this.matrix[i].charAt(j + 1), 10)) : 0;
      const topPixel = i > 0 ? (isGate(j, i - 1) ? 0 : parseInt(this.matrix[i - 1].charAt(j), 10)) : 0;
      const bottomPixel = i < rowCount - 1 ? (isGate(j, i + 1) ? 0 : parseInt(this.matrix[i + 1].charAt(j), 10)) : 0;
      const topRightPixel = i > 0 && j < rowLength - 1 ? (isGate(j + 1, i - 1) ? 0 : parseInt(this.matrix[i - 1].charAt(j + 1), 10)) : 0;
      const bottomRightPixel = i < rowCount - 1 && j < rowLength - 1 ? (isGate(j + 1, i + 1) ? 0 : parseInt(this.matrix[i + 1].charAt(j + 1), 10)) : 0;

      const isoX = (j - i) * tileWidth * 0.5 + offsetX;
      const isoY = (j + i) * tileHeight * 0.5 + offsetY;

      // Draw wall tile - select from weighted arrays if applicable
      const wallLeftImages = this.tileImages.wallLeft;
      const wallRightImages = this.tileImages.wallRight;
      const hasWallLeft = wallLeftImages && (Array.isArray(wallLeftImages) ? wallLeftImages.length > 0 : true);
      const hasWallRight = wallRightImages && (Array.isArray(wallRightImages) ? wallRightImages.length > 0 : true);

      if (hasWallLeft || hasWallRight) {
        // Get wall tile for this position (weighted random selection for arrays)
        let leftImage = null;
        let rightImage = null;

        if (hasWallLeft) {
          if (Array.isArray(wallLeftImages)) {
            const idx = this.getWeightedTileIndex('wallLeft', j, i);
            leftImage = idx >= 0 ? wallLeftImages[idx] : null;
          } else {
            leftImage = wallLeftImages;
          }
        }

        if (hasWallRight) {
          if (Array.isArray(wallRightImages)) {
            const idx = this.getWeightedTileIndex('wallRight', j, i);
            rightImage = idx >= 0 ? wallRightImages[idx] : null;
          } else {
            rightImage = wallRightImages;
          }
        }

        this.createTexturedCube({
          ctx,
          isoX,
          isoY,
          tileWidth,
          tileHeight,
          height: cubeHeight,
          wallHeight: this.wallHeight,
          leftImage: leftImage,
          rightImage: rightImage,
          topColor: "#ffffff",
          showStroke: this.showStroke,
          strokeTop: this.strokeTop,
          strokeBottom: this.strokeBottom,
          strokeCorners: this.strokeCorners,
          strokeWallCorners: this.strokeWallCorners,
          debugStrokeColors: this.debugStrokeColors,
          lineWidth: this.strokeWidth,
          wallBgColor: this.wallBgColor,
          tightSpacing: this.tightSpacing,
          leftPixel,
          rightPixel,
          topPixel,
          bottomPixel,
          topRightPixel,
          bottomRightPixel,
        });
      } else {
        this.createBorderCube({
          ctx,
          isoX,
          isoY,
          tileWidth,
          tileHeight,
          height: cubeHeight,
          showStroke: this.showStroke,
          strokeTop: this.strokeTop,
          strokeBottom: this.strokeBottom,
          strokeCorners: this.strokeCorners,
          strokeWallCorners: this.strokeWallCorners,
          debugStrokeColors: this.debugStrokeColors,
          lineWidth: this.strokeWidth,
          leftPixel,
          rightPixel,
          topPixel,
          bottomPixel,
          topRightPixel,
          bottomRightPixel,
        });
      }

      // Draw cube number for debug test pattern (sequential numbering)
      if (this.debugTestPattern) {
        this.wallCubeNumber = (this.wallCubeNumber || 0) + 1;
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${Math.max(6, tileWidth * 0.25)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelY = isoY + tileHeight * 0.5;
        ctx.fillText(this.wallCubeNumber.toString(), isoX, labelY);
      }

      // Draw block number on wall (grid coordinates on top face)
      if (this.showBlockNumbers) {
        const fontSize = Math.max(2, tileWidth * 0.0032);
        ctx.fillStyle = "#000000";
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Position at center of top face
        const labelY = isoY + tileHeight * 0.5;
        ctx.fillText(`${j},${i}`, isoX, labelY);
      }
    }
  }

  // PASS 2.5: Redraw top face strokes to cover any artifacts from extended fills
  // This ensures strokes are always on top of all fills
  // Only redraws edges that should be visible (respects neighbor-aware logic)
  if (this.showStroke && this.strokeTop) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < rowCount; i++) {
      const rowLength = this.matrix[i].length;
      for (let j = 0; j < rowLength; j++) {
        // Skip gate positions
        const isStartGate = gateEntry && j === gateEntry.x && i === gateEntry.y;
        const isEndGate = gateExit && j === gateExit.x && i === gateExit.y;
        if (isStartGate || isEndGate) continue;

        const pixel = parseInt(this.matrix[i].charAt(j), 10);
        if (!pixel) continue; // Skip floors

        // Get all neighbor pixels
        const leftPixel = j > 0 ? (isGate(j - 1, i) ? 0 : parseInt(this.matrix[i].charAt(j - 1), 10)) : 0;
        const rightPixel = j < rowLength - 1 ? (isGate(j + 1, i) ? 0 : parseInt(this.matrix[i].charAt(j + 1), 10)) : 0;
        const topPixel = i > 0 ? (isGate(j, i - 1) ? 0 : parseInt(this.matrix[i - 1].charAt(j), 10)) : 0;
        const bottomPixel = i < rowCount - 1 ? (isGate(j, i + 1) ? 0 : parseInt(this.matrix[i + 1].charAt(j), 10)) : 0;

        // Only redraw strokes for walls that have a wall above (where triangles appear)
        if (!topPixel) continue;

        const isoX = (j - i) * tileWidth * 0.5 + offsetX;
        const isoY = (j + i) * tileHeight * 0.5 + offsetY;

        // Top face vertices
        const topCenter = { x: isoX, y: isoY };
        const topRight = { x: isoX + tileWidth * 0.5, y: isoY + tileHeight * 0.5 };
        const bottomCenter = { x: isoX, y: isoY + tileHeight };
        const topLeft = { x: isoX - tileWidth * 0.5, y: isoY + tileHeight * 0.5 };

        // Only redraw edges that should be visible (no adjacent wall sharing them)
        // This matches the strokeWallCorners logic from createBorderCube

        // Upper-right edge (topCenter → topRight): draw if no wall above (but we know topPixel=1 here)
        // Skip this edge since topPixel is always true in this pass

        // Lower-right edge (topRight → bottomCenter): draw if no wall to the right
        if (!rightPixel) {
          ctx.beginPath();
          ctx.moveTo(topRight.x, topRight.y);
          ctx.lineTo(bottomCenter.x, bottomCenter.y);
          ctx.stroke();
        }

        // Lower-left edge (bottomCenter → topLeft): draw if no wall below
        if (!bottomPixel) {
          ctx.beginPath();
          ctx.moveTo(bottomCenter.x, bottomCenter.y);
          ctx.lineTo(topLeft.x, topLeft.y);
          ctx.stroke();
        }

        // Upper-left edge (topLeft → topCenter): draw if no wall to the left
        if (!leftPixel) {
          ctx.beginPath();
          ctx.moveTo(topLeft.x, topLeft.y);
          ctx.lineTo(topCenter.x, topCenter.y);
          ctx.stroke();
        }
      }
    }
  }

  // PASS 3: Draw "overlay" layer decorations (on top of everything)
  drawDecorationsForLayer('overlay');

  // PASS 4: Draw exit indicator (arrow and EXIT text)
  if (this.showEntryIndicators && gateExit && this.entryNodes.end) {
    const entryData = this.entryNodes.end;
    const gateX = gateExit.x;
    const gateY = gateExit.y;
    const dir = this.getGateDirection(entryData.x, entryData.y, gateX, gateY);

    // Calculate marker position (one step outward from gate)
    let outX = 0, outY = 0;
    if (dir === 'N') outY = -1;
    else if (dir === 'S') outY = 1;
    else if (dir === 'E') outX = 1;
    else if (dir === 'W') outX = -1;

    const markerX = gateX + outX;
    const markerY = gateY + outY;

    // Get isometric position of marker
    const tightPadding = this.tightSpacing ? this.strokeWidth * 0.5 : 0;
    const markerIsoX = (markerX - markerY) * tileWidth * 0.5 + offsetX;
    const markerIsoY = (markerX + markerY) * tileHeight * 0.5 + offsetY;
    const xOffsetMultiplier = (dir === 'S') ? -1 : 1;
    const adjustedMarkerX = markerIsoX + (this.endMarkerOffsetX * xOffsetMultiplier);
    const cubeBottomY = markerIsoY + tileHeight + cubeHeight;
    const markerBottomY = cubeBottomY + cubeHeight + this.endMarkerOffset;

    // Determine position type based on direction and entry position
    // SW: South wall, west end (low x) | SE: South wall, east end (high x)
    // ES: East wall, south end (high y) | EN: East wall, north end (low y)
    const matrixCols = this.matrix[0].length;
    const matrixRows = this.matrix.length;
    const midX = matrixCols / 2;
    const midY = matrixRows / 2;

    let positionType;
    if (dir === 'S') {
      positionType = entryData.x < midX ? 'SW' : 'SE';
    } else if (dir === 'E') {
      positionType = entryData.y > midY ? 'ES' : 'EN';
    } else {
      positionType = 'SW'; // Fallback
    }

    // Arrow and text styling
    const arrowSize = tileWidth * 0.5;
    const arrowWidth = arrowSize * 0.6;
    const fontSize = this.entryIndicatorFontSize > 0 ? this.entryIndicatorFontSize : Math.max(12, tileWidth * 0.4);
    const textGap = fontSize * 0.3;

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';

    const exitText = 'EXIT';
    const textMetrics = ctx.measureText(exitText);
    const textWidth = textMetrics.width;
    const charWidth = textWidth / 4; // Approximate width per character

    if (positionType === 'SW') {
      // Arrow below marker pointing UP, EXIT below arrow, E aligned to center
      const arrowTipY = markerBottomY + arrowSize * 0.5;
      const arrowBaseY = arrowTipY + arrowSize;

      // Draw arrow pointing up
      ctx.beginPath();
      ctx.moveTo(adjustedMarkerX, arrowTipY);
      ctx.lineTo(adjustedMarkerX - arrowWidth * 0.5, arrowBaseY);
      ctx.lineTo(adjustedMarkerX + arrowWidth * 0.5, arrowBaseY);
      ctx.closePath();
      ctx.fill();

      // Draw EXIT text below arrow, E (first char) aligned to center
      ctx.textAlign = 'left';
      const textX = adjustedMarkerX - charWidth * 0.5;
      const textY = arrowBaseY + textGap + fontSize * 0.5;
      ctx.fillText(exitText, textX, textY);

    } else if (positionType === 'SE') {
      // Arrow to LEFT of marker pointing RIGHT, EXIT to left, vertically centered
      const arrowTipX = adjustedMarkerX - arrowSize * 1.5;
      const arrowBaseX = arrowTipX - arrowSize;
      const arrowY = markerBottomY - tileHeight * 0.5;

      // Draw arrow pointing right
      ctx.beginPath();
      ctx.moveTo(arrowTipX, arrowY);
      ctx.lineTo(arrowBaseX, arrowY - arrowWidth * 0.5);
      ctx.lineTo(arrowBaseX, arrowY + arrowWidth * 0.5);
      ctx.closePath();
      ctx.fill();

      // Draw EXIT text to left of arrow, vertically centered
      ctx.textAlign = 'right';
      const textX = arrowBaseX - textGap;
      ctx.fillText(exitText, textX, arrowY);

    } else if (positionType === 'ES') {
      // Arrow to RIGHT of marker pointing LEFT, EXIT to right, vertically centered
      const arrowTipX = adjustedMarkerX + arrowSize * 1.5;
      const arrowBaseX = arrowTipX + arrowSize;
      const arrowY = markerBottomY - tileHeight * 0.5;

      // Draw arrow pointing left
      ctx.beginPath();
      ctx.moveTo(arrowTipX, arrowY);
      ctx.lineTo(arrowBaseX, arrowY - arrowWidth * 0.5);
      ctx.lineTo(arrowBaseX, arrowY + arrowWidth * 0.5);
      ctx.closePath();
      ctx.fill();

      // Draw EXIT text to right of arrow, vertically centered
      ctx.textAlign = 'left';
      const textX = arrowBaseX + textGap;
      ctx.fillText(exitText, textX, arrowY);

    } else if (positionType === 'EN') {
      // Arrow below marker pointing UP, EXIT below arrow, T aligned to center
      const arrowTipY = markerBottomY + arrowSize * 0.5;
      const arrowBaseY = arrowTipY + arrowSize;

      // Draw arrow pointing up
      ctx.beginPath();
      ctx.moveTo(adjustedMarkerX, arrowTipY);
      ctx.lineTo(adjustedMarkerX - arrowWidth * 0.5, arrowBaseY);
      ctx.lineTo(adjustedMarkerX + arrowWidth * 0.5, arrowBaseY);
      ctx.closePath();
      ctx.fill();

      // Draw EXIT text below arrow, T (4th char, index 3) aligned to center
      ctx.textAlign = 'left';
      const textX = adjustedMarkerX - charWidth * 3.5; // Offset so T is centered
      const textY = arrowBaseY + textGap + fontSize * 0.5;
      ctx.fillText(exitText, textX, textY);
    }

    ctx.restore();
  }

  // PASS 5: Draw start indicator (arrow and START text)
  if (this.showEntryIndicators && gateEntry && this.entryNodes.start) {
    const entryData = this.entryNodes.start;
    const gateX = gateEntry.x;
    const gateY = gateEntry.y;
    const dir = this.getGateDirection(entryData.x, entryData.y, gateX, gateY);

    // Start marker is at the gate position (not offset like end marker)
    const markerX = gateX;
    const markerY = gateY;

    // Get isometric position of marker
    const markerIsoX = (markerX - markerY) * tileWidth * 0.5 + offsetX;
    const markerIsoY = (markerX + markerY) * tileHeight * 0.5 + offsetY;
    const cubeBottomY = markerIsoY + tileHeight + cubeHeight;

    // Determine position type based on direction and entry position
    // WN: West wall, north end (low y) | WS: West wall, south end (high y)
    // NW: North wall, west end (low x) | NE: North wall, east end (high x)
    const matrixCols = this.matrix[0].length;
    const matrixRows = this.matrix.length;
    const midX = matrixCols / 2;
    const midY = matrixRows / 2;

    let positionType;
    if (dir === 'W') {
      positionType = entryData.y < midY ? 'WN' : 'WS';
    } else if (dir === 'N') {
      positionType = entryData.x < midX ? 'NW' : 'NE';
    } else {
      positionType = 'WN'; // Fallback
    }

    // Arrow and text styling
    const arrowSize = tileWidth * 0.5;
    const arrowWidth = arrowSize * 0.6;
    const fontSize = this.entryIndicatorFontSize > 0 ? this.entryIndicatorFontSize : Math.max(12, tileWidth * 0.4);
    const textGap = fontSize * 0.3;

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';

    const startText = 'START';
    const textMetrics = ctx.measureText(startText);
    const textWidth = textMetrics.width;
    const charWidth = textWidth / 5; // 5 characters in START

    if (positionType === 'WN') {
      // Arrow to LEFT of marker pointing RIGHT, START to left, vertically centered
      const arrowTipX = markerIsoX - arrowSize * 1.5;
      const arrowBaseX = arrowTipX - arrowSize;
      const arrowY = markerIsoY + tileHeight * 0.5;

      // Draw arrow pointing right
      ctx.beginPath();
      ctx.moveTo(arrowTipX, arrowY);
      ctx.lineTo(arrowBaseX, arrowY - arrowWidth * 0.5);
      ctx.lineTo(arrowBaseX, arrowY + arrowWidth * 0.5);
      ctx.closePath();
      ctx.fill();

      // Draw START text to left of arrow, vertically centered
      ctx.textAlign = 'right';
      const textX = arrowBaseX - textGap;
      ctx.fillText(startText, textX, arrowY);

    } else if (positionType === 'WS') {
      // Arrow above marker pointing DOWN, START above arrow, S aligned to center
      const arrowTipY = markerIsoY - arrowSize * 0.5;
      const arrowBaseY = arrowTipY - arrowSize;

      // Draw arrow pointing down
      ctx.beginPath();
      ctx.moveTo(markerIsoX, arrowTipY);
      ctx.lineTo(markerIsoX - arrowWidth * 0.5, arrowBaseY);
      ctx.lineTo(markerIsoX + arrowWidth * 0.5, arrowBaseY);
      ctx.closePath();
      ctx.fill();

      // Draw START text above arrow, S (first char) aligned to center
      ctx.textAlign = 'left';
      const textX = markerIsoX - charWidth * 0.5;
      const textY = arrowBaseY - textGap - fontSize * 0.5;
      ctx.fillText(startText, textX, textY);

    } else if (positionType === 'NW') {
      // Arrow to LEFT of marker pointing RIGHT, START to left, vertically centered
      const arrowTipX = markerIsoX - arrowSize * 1.5;
      const arrowBaseX = arrowTipX - arrowSize;
      const arrowY = markerIsoY + tileHeight * 0.5;

      // Draw arrow pointing right
      ctx.beginPath();
      ctx.moveTo(arrowTipX, arrowY);
      ctx.lineTo(arrowBaseX, arrowY - arrowWidth * 0.5);
      ctx.lineTo(arrowBaseX, arrowY + arrowWidth * 0.5);
      ctx.closePath();
      ctx.fill();

      // Draw START text to left of arrow, vertically centered
      ctx.textAlign = 'right';
      const textX = arrowBaseX - textGap;
      ctx.fillText(startText, textX, arrowY);

    } else if (positionType === 'NE') {
      // Arrow above marker pointing DOWN, START above arrow, word centered
      const arrowTipY = markerIsoY - arrowSize * 0.5;
      const arrowBaseY = arrowTipY - arrowSize;

      // Draw arrow pointing down
      ctx.beginPath();
      ctx.moveTo(markerIsoX, arrowTipY);
      ctx.lineTo(markerIsoX - arrowWidth * 0.5, arrowBaseY);
      ctx.lineTo(markerIsoX + arrowWidth * 0.5, arrowBaseY);
      ctx.closePath();
      ctx.fill();

      // Draw START text above arrow, centered on arrow
      ctx.textAlign = 'center';
      const textY = arrowBaseY - textGap - fontSize * 0.5;
      ctx.fillText(startText, markerIsoX, textY);
    }

    ctx.restore();
  }
};

Maze.prototype.generateSVG = function () {
  if (!this.matrix.length) {
    return null;
  }

  const scale = this.displayScale;
  const tileWidth = this.wallSize;
  const tileHeight = this.wallSize * this.isoRatio;

  // Use actual matrix dimensions (may be transformed)
  const matrixCols = this.matrix[0].length;
  const matrixRows = this.matrix.length;

  const isoWidth = matrixCols * tileWidth * 0.5;
  const isoHeight = matrixRows * tileHeight * 0.5;
  const cubeHeight = tileHeight * this.wallHeight;

  // Add stroke margin to prevent edge clipping (consistent with draw())
  const strokeMargin = (this.showStroke && !this.tightSpacing) ? this.strokeWidth : 0;
  const halfStrokeMargin = strokeMargin * 0.5;

  const svgWidth = (isoWidth * 2 + strokeMargin) * scale;
  const svgHeight = (isoHeight * 2 + tileHeight * 2 + cubeHeight + strokeMargin) * scale;

  const rowCount = this.matrix.length;
  const gateEntry = getEntryNode(this.entryNodes, "start", true);
  const gateExit = getEntryNode(this.entryNodes, "end", true);

  const offsetX = isoWidth + halfStrokeMargin;
  const offsetY = tileHeight + halfStrokeMargin;

  let paths = [];

  for (let i = 0; i < rowCount; i++) {
    const rowLength = this.matrix[i].length;
    for (let j = 0; j < rowLength; j++) {
      if (gateEntry && gateExit) {
        if (j === gateEntry.x && i === gateEntry.y) continue;
        if (j === gateExit.x && i === gateExit.y) continue;
      }

      const pixel = parseInt(this.matrix[i].charAt(j), 10);
      const leftPixel = j > 0 ? parseInt(this.matrix[i].charAt(j - 1), 10) : 0;
      const rightPixel = j < rowLength - 1 ? parseInt(this.matrix[i].charAt(j + 1), 10) : 0;
      const topPixel = i > 0 ? parseInt(this.matrix[i - 1].charAt(j), 10) : 0;

      if (pixel) {
        const isoX = (j - i) * tileWidth * 0.5 + offsetX;
        const isoY = (j + i) * tileHeight * 0.5 + offsetY;
        const height = tileHeight;

        // Determine top face color
        let topColor;
        if (topPixel) {
          topColor = "#ff0000";
        } else if (leftPixel || rightPixel) {
          topColor = "#ff00ff";
        } else {
          topColor = "#00ff00";
        }

        // Top face
        paths.push(`<path d="M ${isoX} ${isoY} L ${isoX + tileWidth * 0.5} ${isoY + tileHeight * 0.5} L ${isoX} ${isoY + tileHeight} L ${isoX - tileWidth * 0.5} ${isoY + tileHeight * 0.5} Z" fill="${topColor}" stroke="#000000" stroke-width="2"/>`);

        // Left face
        paths.push(`<path d="M ${isoX} ${isoY + tileHeight} L ${isoX - tileWidth * 0.5} ${isoY + tileHeight * 0.5} L ${isoX - tileWidth * 0.5} ${isoY + tileHeight * 0.5 + height} L ${isoX} ${isoY + tileHeight + height} Z" fill="#aaaaaa" stroke="#000000" stroke-width="2"/>`);

        // Right face
        paths.push(`<path d="M ${isoX} ${isoY + tileHeight} L ${isoX + tileWidth * 0.5} ${isoY + tileHeight * 0.5} L ${isoX + tileWidth * 0.5} ${isoY + tileHeight * 0.5 + height} L ${isoX} ${isoY + tileHeight + height} Z" fill="#888888" stroke="#000000" stroke-width="2"/>`);
      }
    }
  }

  const viewBoxWidth = isoWidth * 2 + strokeMargin;
  const viewBoxHeight = isoHeight * 2 + tileHeight * 2 + cubeHeight + strokeMargin;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <rect width="100%" height="100%" fill="${this.backgroundColor}"/>
  <g>
    ${paths.join('\n    ')}
  </g>
</svg>`;

  return svg;
};
