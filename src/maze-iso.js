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

    // Tileset configuration: { wallLeft: url, wallRight: url, pathway: url, start: url, end: url }
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
  this.entryNodes = this.getEntryNodes(settings["entryType"]);
  this.bias = settings["bias"];
  this.color = settings["color"];
  this.backgroundColor = settings["backgroundColor"];
  this.solveColor = settings["solveColor"];
  this.tileset = settings["tileset"];
  this.tileImages = {}; // Will hold loaded Image objects
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

    const tileTypes = ['wallLeft', 'wallRight', 'pathway', 'start', 'end'];
    const promises = [];

    tileTypes.forEach((type) => {
      if (this.tileset[type]) {
        const promise = new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => {
            this.tileImages[type] = img;
            res();
          };
          img.onerror = () => {
            console.warn(`Failed to load tile: ${type}`);
            res(); // Don't reject, just skip this tile
          };
          img.src = this.tileset[type];
        });
        promises.push(promise);
      }
    });

    Promise.all(promises).then(resolve).catch(reject);
  });
};

Maze.prototype.generate = function () {
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
  ];

  // Clear entry nodes for test pattern
  this.entryNodes = {};
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

Maze.prototype.getEntryNodes = function (access) {
  const y = this.height * 2 + 1 - 2;
  const x = this.width * 2 + 1 - 2;

  let entryNodes = {};

  if ("diagonal" === access) {
    entryNodes.start = { x: 1, y: 1, gate: { x: 0, y: 1 } };
    entryNodes.end = { x: x, y: y, gate: { x: x + 1, y: y } };
  }

  if ("horizontal" === access || "vertical" === access) {
    let xy = "horizontal" === access ? y : x;
    xy = (xy - 1) / 2;
    let even = xy % 2 === 0;
    xy = even ? xy + 1 : xy;

    let start_x = "horizontal" === access ? 1 : xy;
    let start_y = "horizontal" === access ? xy : 1;
    let end_x = "horizontal" === access ? x : even ? start_x : start_x + 2;
    let end_y = "horizontal" === access ? (even ? start_y : start_y + 2) : y;
    let startgate =
      "horizontal" === access ? { x: 0, y: start_y } : { x: start_x, y: 0 };
    let endgate =
      "horizontal" === access ? { x: x + 1, y: end_y } : { x: end_x, y: y + 1 };

    entryNodes.start = { x: start_x, y: start_y, gate: startgate };
    entryNodes.end = { x: end_x, y: end_y, gate: endgate };
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

  // Draw top face
  if (topPixel) {
    ctx.fillStyle = "#ff0000";
  } else if (leftPixel || rightPixel) {
    ctx.fillStyle = "#ff00ff";
  } else {
    ctx.fillStyle = "#00ff00";
  }

  ctx.beginPath();
  ctx.moveTo(topCenter.x, topCenter.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.closePath();
  ctx.fill();

  // Draw left face
  ctx.fillStyle = "#aaa";
  ctx.beginPath();
  ctx.moveTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
  ctx.closePath();
  ctx.fill();

  // Draw right face
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomCenterLow.x, bottomCenterLow.y);
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

  // Draw top face (solid color)
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(topCenter.x, topCenter.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomCenter.x, bottomCenter.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.closePath();
  ctx.fill();

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
    ctx.drawImage(leftImage, topLeft.x, topLeft.y, tileWidth * 0.5, height);
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
    ctx.drawImage(rightImage, isoX, topRight.y, tileWidth * 0.5, height);
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
  const tileHeight = this.wallSize / 2; // Base tile height for isometric view

  // Use actual matrix dimensions (may be transformed)
  const matrixCols = this.matrix[0].length;
  const matrixRows = this.matrix.length;

  // Calculate the full isometric dimensions
  const isoWidth = matrixCols * tileWidth * 0.5; // Isometric width
  const isoHeight = matrixRows * tileHeight * 0.5; // Isometric height
  const cubeHeight = tileHeight * this.wallHeight; // Height of the 3D cube faces extending below

  // Adjust canvas size to fit the isometric maze (scaled)
  // Only add stroke margin if strokes are enabled
  const strokeMargin = this.showStroke ? this.strokeWidth : 0;
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
  const offsetX = isoWidth; // Center the maze horizontally
  const offsetY = tileHeight; // Add vertical margin

  console.log(this.matrix);
  for (let i = 0; i < rowCount; i++) {
    const rowLength = this.matrix[i].length;
    for (let j = 0; j < rowLength; j++) {
      if (gateEntry && gateExit) {
        if (j === gateEntry.x && i === gateEntry.y) {
          continue;
        }
        if (j === gateExit.x && i === gateExit.y) {
          continue;
        }
      }

      // Logic from above to determine wallness or pathness
      // let hasAbove = nodes.hasOwnProperty(i - this.width);
      // let above = hasAbove && stringVal(nodes[i - this.width], 4);
      // let hasNext = nodes.hasOwnProperty(i + 1);
      // let next = hasNext && stringVal(nodes[i + 1], 1);
      //
      // if (stringVal(nodes[i], 4)) {
      //   row1 += "01";
      //   row2 += "01";
      // } else if (next || above) {
      //   row1 += "01";
      //   row2 += "00";
      // } else {
      //   row1 += "00";
      //   row2 += "00";
      // }
      //

      // Get the pixel value
      const pixel = parseInt(this.matrix[i].charAt(j), 10);
      // Get neighbor pixel values
      const leftPixel = j > 0 ? parseInt(this.matrix[i].charAt(j - 1), 10) : 0;
      const rightPixel =
        j < rowLength - 1 ? parseInt(this.matrix[i].charAt(j + 1), 10) : 0;
      const topPixel = i > 0 ? parseInt(this.matrix[i - 1].charAt(j), 10) : 0;
      const bottomPixel =
        i < rowCount - 1 ? parseInt(this.matrix[i + 1].charAt(j), 10) : 0;
      // Diagonal neighbors for detecting T-junction inner corners
      const topRightPixel =
        i > 0 && j < rowLength - 1
          ? parseInt(this.matrix[i - 1].charAt(j + 1), 10)
          : 0;
      const bottomRightPixel =
        i < rowCount - 1 && j < rowLength - 1
          ? parseInt(this.matrix[i + 1].charAt(j + 1), 10)
          : 0;

      // Calculate the isometric tile coordinates
      const isoX = (j - i) * tileWidth * 0.5 + offsetX;
      const isoY = (j + i) * tileHeight * 0.5 + offsetY;

      // Check if this is a start or end position
      const startNode = getEntryNode(this.entryNodes, "start", false);
      const endNode = getEntryNode(this.entryNodes, "end", false);
      const isStart = startNode && j === startNode.x && i === startNode.y;
      const isEnd = endNode && j === endNode.x && i === endNode.y;

      if (pixel) {
        // Draw wall tile
        if (this.tileImages.wallLeft || this.tileImages.wallRight) {
          // Use textured cube with directional wall images
          this.createTexturedCube({
            ctx,
            isoX,
            isoY,
            tileWidth,
            tileHeight,
            height: cubeHeight,
            leftImage: this.tileImages.wallLeft || null,
            rightImage: this.tileImages.wallRight || null,
            topColor: "#ffffff",
            showStroke: this.showStroke,
            strokeTop: this.strokeTop,
            strokeBottom: this.strokeBottom,
            strokeCorners: this.strokeCorners,
            strokeWallCorners: this.strokeWallCorners,
            debugStrokeColors: this.debugStrokeColors,
            lineWidth: this.strokeWidth,
            wallBgColor: this.wallBgColor,
            leftPixel,
            rightPixel,
            topPixel,
            bottomPixel,
            topRightPixel,
            bottomRightPixel,
          });
        } else {
          // Fallback to programmatic cube drawing
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

        // Draw cube number for debug test pattern
        if (this.debugTestPattern) {
          this.wallCubeNumber = (this.wallCubeNumber || 0) + 1;
          ctx.fillStyle = "#000000";
          ctx.font = `bold ${Math.max(6, tileWidth * 0.25)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Position number on top face of cube
          const labelY = isoY + tileHeight * 0.5;
          ctx.fillText(this.wallCubeNumber.toString(), isoX, labelY);
        }
      } else {
        // Draw pathway tile if available
        if (this.tileImages.pathway) {
          const img = this.tileImages.pathway;
          const drawX = isoX - tileWidth * 0.5;
          const drawY = isoY;
          ctx.drawImage(img, drawX, drawY, tileWidth, tileHeight);
        }

        // Draw start/end markers
        if (isStart && this.tileImages.start) {
          const img = this.tileImages.start;
          const drawX = isoX - tileWidth * 0.5;
          const drawY = isoY;
          ctx.drawImage(img, drawX, drawY, tileWidth, tileHeight);
        }
        if (isEnd && this.tileImages.end) {
          const img = this.tileImages.end;
          const drawX = isoX - tileWidth * 0.5;
          const drawY = isoY;
          ctx.drawImage(img, drawX, drawY, tileWidth, tileHeight);
        }
        // Draw the isometric tile
        // ctx.beginPath();
        // ctx.moveTo(isoX, isoY);
        // ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5);
        // ctx.lineTo(isoX, isoY + tileHeight);
        // ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5);
        // ctx.closePath();
        // ctx.fill();
      }
    }
  }
};

Maze.prototype.generateSVG = function () {
  if (!this.matrix.length) {
    return null;
  }

  const scale = this.displayScale;
  const tileWidth = this.wallSize;
  const tileHeight = this.wallSize / 2;

  // Use actual matrix dimensions (may be transformed)
  const matrixCols = this.matrix[0].length;
  const matrixRows = this.matrix.length;

  const isoWidth = matrixCols * tileWidth * 0.5;
  const isoHeight = matrixRows * tileHeight * 0.5;
  const cubeHeight = tileHeight;

  const svgWidth = (isoWidth * 2) * scale;
  const svgHeight = (isoHeight * 2 + tileHeight + cubeHeight) * scale;

  const rowCount = this.matrix.length;
  const gateEntry = getEntryNode(this.entryNodes, "start", true);
  const gateExit = getEntryNode(this.entryNodes, "end", true);

  const offsetX = isoWidth;
  const offsetY = tileHeight;

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

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${isoWidth * 2} ${isoHeight * 2 + tileHeight + cubeHeight}">
  <rect width="100%" height="100%" fill="${this.backgroundColor}"/>
  <g>
    ${paths.join('\n    ')}
  </g>
</svg>`;

  return svg;
};
