function Maze(args) {
  const defaults = {
    width: 20,
    height: 20,
    wallSize: 10,
    displayScale: 1.0,
    entryType: "",
    bias: "",
    color: "#000000",
    backgroundColor: "#FFFFFF",
    solveColor: "#cc3737",
    removeWalls: 0,

    // Tileset configuration: { wall: url, pathway: url, start: url, end: url }
    tileset: null,

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
  this.removeWalls = parseInt(settings["removeWalls"], 10);
  this.entryNodes = this.getEntryNodes(settings["entryType"]);
  this.bias = settings["bias"];
  this.color = settings["color"];
  this.backgroundColor = settings["backgroundColor"];
  this.solveColor = settings["solveColor"];
  this.tileset = settings["tileset"];
  this.tileImages = {}; // Will hold loaded Image objects
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

    const tileTypes = ['wall', 'pathway', 'start', 'end'];
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
  if (!this.isValidSize()) {
    this.matrix = [];
    alert("Please use smaller maze dimensions");
    return;
  }

  let nodes = this.generateNodes();
  nodes = this.parseMaze(nodes);
  this.getMatrix(nodes);
  this.removeMazeWalls();
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
  leftPixel = 0,
  rightPixel = 0,
  topPixel = 0,
  bottomPixel = 0,
}) {
  // Set border style
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round'; // Prevent spike artifacts at corners

  // Draw top face border
  if (topPixel) {
    ctx.fillStyle = "#ff0000";
  } else if (leftPixel || rightPixel) {
    ctx.fillStyle = "#ff00ff";
  } else {
    ctx.fillStyle = "#00ff00";
  }

  ctx.beginPath();
  ctx.moveTo(isoX, isoY); // Top center
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5); // Top right
  ctx.lineTo(isoX, isoY + tileHeight); // Bottom center
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5); // Top left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw left face border
  ctx.fillStyle = "#aaa";
  ctx.beginPath();
  ctx.moveTo(isoX, isoY + tileHeight); // Bottom center
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5); // Top left
  ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5 + height); // Bottom left
  ctx.lineTo(isoX, isoY + tileHeight + height); // Bottom center extended
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw right face border
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(isoX, isoY + tileHeight); // Bottom center
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5); // Top right
  ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5 + height); // Bottom right
  ctx.lineTo(isoX, isoY + tileHeight + height); // Bottom center extended
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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

  // Calculate the full isometric dimensions
  const isoWidth = (this.width * 2 + 1) * tileWidth * 0.5; // Isometric width
  const isoHeight = (this.height * 2 + 1) * tileHeight * 0.5; // Isometric height
  const cubeHeight = tileHeight; // Height of the 3D cube faces extending below

  // Adjust canvas size to fit the isometric maze (scaled)
  // Add extra margin for stroke width (lineWidth=2 means 1px on each side)
  const strokeMargin = 2;
  canvas.width = (isoWidth * 2 + strokeMargin) * scale; // Total projected width
  canvas.height = (isoHeight * 2 + tileHeight + cubeHeight + strokeMargin) * scale; // Total projected height + cube depth

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale); // Apply display scale to all drawing operations

  // Add background (use unscaled dimensions since ctx is already scaled)
  ctx.fillStyle = this.backgroundColor;
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

  // Set maze color
  ctx.fillStyle = this.color;

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
      // Get previous pixel value
      const leftPixel = j > 0 ? parseInt(this.matrix[i].charAt(j - 1), 10) : 0;
      const rightPixel =
        j < rowLength - 1 ? parseInt(this.matrix[i].charAt(j + 1), 10) : 0;
      const topPixel = i > 0 ? parseInt(this.matrix[i - 1].charAt(j), 10) : 0;
      const bottomPixel =
        i < rowCount - 1 ? parseInt(this.matrix[i + 1].charAt(j), 10) : 0;
      console.log({ j, pixel, leftPixel, rightPixel, topPixel, bottomPixel });

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
        if (this.tileImages.wall) {
          // Draw tile image centered on isometric position
          const img = this.tileImages.wall;
          const drawX = isoX - tileWidth * 0.5;
          const drawY = isoY;
          ctx.drawImage(img, drawX, drawY, tileWidth, tileHeight + cubeHeight);
        } else {
          // Fallback to programmatic cube drawing
          this.createBorderCube({
            ctx,
            isoX,
            isoY,
            tileWidth,
            tileHeight,
            leftPixel,
            rightPixel,
            topPixel,
            bottomPixel,
          });
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

  const isoWidth = (this.width * 2 + 1) * tileWidth * 0.5;
  const isoHeight = (this.height * 2 + 1) * tileHeight * 0.5;
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
