// Global variables
let mazeNodes = {};

// Check if globals are defined
if (typeof maxMaze === 'undefined') {
    maxMaze = 0;
}

if (typeof maxSolve === 'undefined') {
    maxSolve = 0;
}

if (typeof maxCanvas === 'undefined') {
    maxCanvas = 0;
}

if (typeof maxCanvasDimension === 'undefined') {
    maxCanvasDimension = 0;
}

if (typeof maxWallsRemove === 'undefined') {
    maxWallsRemove = 300;
}

// Update remove max walls html
const removeMaxWallsText = document.querySelector('.desc span');
if (removeMaxWallsText) {
    removeMaxWallsText.innerHTML = maxWallsRemove;
}

const removeWallsInput = document.getElementById('remove_walls');
if (removeWallsInput) {
    removeWallsInput.max = maxWallsRemove;
}

const download = document.getElementById("download");
download.addEventListener("click", downloadImage, false);
download.setAttribute('download', 'maze.png');

function initMaze() {
    download.setAttribute('download', 'maze.png');
    download.innerHTML = 'download maze';

    // Build tileset from input fields
    const tileWallLeft = document.getElementById('tile-wall-left');
    const tileWallRight = document.getElementById('tile-wall-right');
    const tilePathway = document.getElementById('tile-pathway');
    // Directional start tiles
    const tileStartN = document.getElementById('tile-start-n');
    const tileStartS = document.getElementById('tile-start-s');
    const tileStartE = document.getElementById('tile-start-e');
    const tileStartW = document.getElementById('tile-start-w');
    // Directional end tiles
    const tileEndN = document.getElementById('tile-end-n');
    const tileEndS = document.getElementById('tile-end-s');
    const tileEndE = document.getElementById('tile-end-e');
    const tileEndW = document.getElementById('tile-end-w');
    const showStrokeCheckbox = document.getElementById('show-stroke');

    let tileset = null;
    const wallLeftUrl = tileWallLeft ? tileWallLeft.value.trim() : '';
    const wallRightUrl = tileWallRight ? tileWallRight.value.trim() : '';
    const pathwayUrl = tilePathway ? tilePathway.value.trim() : '';
    // Directional start URLs
    const startNUrl = tileStartN ? tileStartN.value.trim() : '';
    const startSUrl = tileStartS ? tileStartS.value.trim() : '';
    const startEUrl = tileStartE ? tileStartE.value.trim() : '';
    const startWUrl = tileStartW ? tileStartW.value.trim() : '';
    // Directional end URLs
    const endNUrl = tileEndN ? tileEndN.value.trim() : '';
    const endSUrl = tileEndS ? tileEndS.value.trim() : '';
    const endEUrl = tileEndE ? tileEndE.value.trim() : '';
    const endWUrl = tileEndW ? tileEndW.value.trim() : '';

    const hasAnyTile = wallLeftUrl || wallRightUrl || pathwayUrl ||
        startNUrl || startSUrl || startEUrl || startWUrl ||
        endNUrl || endSUrl || endEUrl || endWUrl;

    if (hasAnyTile) {
        tileset = {};
        if (wallLeftUrl) tileset.wallLeft = wallLeftUrl;
        if (wallRightUrl) tileset.wallRight = wallRightUrl;
        if (pathwayUrl) tileset.pathway = pathwayUrl;
        // Directional start tiles
        if (startNUrl) tileset.startN = startNUrl;
        if (startSUrl) tileset.startS = startSUrl;
        if (startEUrl) tileset.startE = startEUrl;
        if (startWUrl) tileset.startW = startWUrl;
        // Directional end tiles
        if (endNUrl) tileset.endN = endNUrl;
        if (endSUrl) tileset.endS = endSUrl;
        if (endEUrl) tileset.endE = endEUrl;
        if (endWUrl) tileset.endW = endWUrl;
    }

    const showStroke = showStrokeCheckbox ? showStrokeCheckbox.checked : true;
    const strokeTopCheckbox = document.getElementById('stroke-top');
    const strokeBottomCheckbox = document.getElementById('stroke-bottom');
    const strokeCornersCheckbox = document.getElementById('stroke-corners');
    const strokeWallCornersCheckbox = document.getElementById('stroke-wall-corners');
    const debugStrokeColorsCheckbox = document.getElementById('debug-stroke-colors');
    const debugTestPatternCheckbox = document.getElementById('debug-test-pattern');
    const tightSpacingCheckbox = document.getElementById('tight-spacing');
    const strokeTop = strokeTopCheckbox ? strokeTopCheckbox.checked : true;
    const strokeBottom = strokeBottomCheckbox ? strokeBottomCheckbox.checked : true;
    const strokeCorners = strokeCornersCheckbox ? strokeCornersCheckbox.checked : true;
    const strokeWallCorners = strokeWallCornersCheckbox ? strokeWallCornersCheckbox.checked : false;
    const debugStrokeColors = debugStrokeColorsCheckbox ? debugStrokeColorsCheckbox.checked : false;
    const debugTestPattern = debugTestPatternCheckbox ? debugTestPatternCheckbox.checked : false;
    const tightSpacing = tightSpacingCheckbox ? tightSpacingCheckbox.checked : false;
    const wallHeight = getInputFloatVal('wall-height', 1.0);
    const strokeWidth = getInputFloatVal('stroke-width', 2);
    const wallBgColorInput = document.getElementById('wall-bg-color');
    const wallBgColor = wallBgColorInput ? wallBgColorInput.value.trim() : '';
    const isoRatioSelect = document.getElementById('iso-ratio');
    const isoRatio = isoRatioSelect ? parseFloat(isoRatioSelect.value) : 0.5;

    const settings = {
        width: getInputIntVal('width', 20),
        height: getInputIntVal('height', 20),
        wallSize: getInputIntVal('wall-size', 10),
        displayScale: getInputFloatVal('display-scale', 1.0),
        pathWidth: getInputIntVal('path-width', 1),
        pathHeight: getInputIntVal('path-height', 1),
        removeWalls: getInputIntVal('remove_walls', 0),
        tileset: tileset,
        showStroke: showStroke,
        strokeTop: strokeTop,
        strokeBottom: strokeBottom,
        strokeCorners: strokeCorners,
        strokeWallCorners: strokeWallCorners,
        debugStrokeColors: debugStrokeColors,
        debugTestPattern: debugTestPattern,
        tightSpacing: tightSpacing,
        wallHeight: wallHeight,
        strokeWidth: strokeWidth,
        wallBgColor: wallBgColor,
        isoRatio: isoRatio,
        entryType: '',
        bias: '',
        color: '#000000',
        backgroudColor: '#FFFFFF',
        solveColor: '#cc3737',

        // restrictions
        maxMaze: maxMaze,
        maxCanvas: maxCanvas,
        maxCanvasDimension: maxCanvasDimension,
        maxSolve: maxSolve,
        maxWallsRemove: maxWallsRemove,
    }

    const colors = ['color', 'backgroundColor', 'solveColor'];
    for (let i = 0; i < colors.length; i++) {
        const colorInput = document.getElementById(colors[i]);
        settings[colors[i]] = colorInput.value
        if (!isValidHex(settings[colors[i]])) {
            let defaultColor = colorInput.parentNode.dataset.default;
            colorInput.value = defaultColor;
            settings[colors[i]] = defaultColor;
        }

        const colorSample = colorInput.parentNode.querySelector('.color-sample');
        colorSample.style = 'background-color: ' + settings[colors[i]] + ';';
    }

    if (settings['removeWalls'] > maxWallsRemove) {
        settings['removeWalls'] = maxWallsRemove;
        if (removeWallsInput) {
            removeWallsInput.value = maxWallsRemove;
        }
    }

    const entry = document.getElementById('entry');
    if (entry) {
        settings['entryType'] = entry.options[entry.selectedIndex].value;
    }

    const bias = document.getElementById('bias');
    if (bias) {
        settings['bias'] = bias.options[bias.selectedIndex].value;
    }

    const maze = new Maze(settings);
    maze.generate();

    // Load tileset images (if any) before drawing
    maze.loadTileset().then(function() {
        maze.draw();

        if (download && download.classList.contains('hide')) {
            download.classList.toggle("hide");
        }

        const solveButton = document.getElementById("solve");
        if (solveButton && solveButton.classList.contains('hide')) {
            solveButton.classList.toggle("hide");
        }

        mazeNodes = {}
        if (maze.matrix.length) {
            mazeNodes = maze;
        }

        location.href = "#";
        location.href = "#generate";
    });
}

function downloadImage(e) {
    const formatSelect = document.getElementById('export-format');
    const format = formatSelect ? formatSelect.value : 'png';

    if (format === 'svg' && mazeNodes && mazeNodes.generateSVG) {
        const svg = mazeNodes.generateSVG();
        if (svg) {
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            download.setAttribute("href", url);
            download.setAttribute('download', 'maze.svg');
        }
    } else {
        const image = document.getElementById('maze').toDataURL("image/png");
        image.replace("image/png", "image/octet-stream");
        download.setAttribute("href", image);
        download.setAttribute('download', 'maze.png');
    }
}

function initSolve() {
    const solveButton = document.getElementById("solve");
    if (solveButton) {
        solveButton.classList.toggle("hide");
    }

    download.setAttribute('download', 'maze-solved.png');
    download.innerHTML = 'download solved maze';

    if ((typeof mazeNodes.matrix === 'undefined') || !mazeNodes.matrix.length) {
        return;
    }

    const solver = new Solver(mazeNodes);
    solver.solve();
    if (mazeNodes.wallsRemoved) {
        solver.drawAstarSolve();
    } else {
        solver.draw();
    }

    mazeNodes = {}
}