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
    const tileWall = document.getElementById('tile-wall');
    const tilePathway = document.getElementById('tile-pathway');
    const tileStart = document.getElementById('tile-start');
    const tileEnd = document.getElementById('tile-end');

    let tileset = null;
    const wallUrl = tileWall ? tileWall.value.trim() : '';
    const pathwayUrl = tilePathway ? tilePathway.value.trim() : '';
    const startUrl = tileStart ? tileStart.value.trim() : '';
    const endUrl = tileEnd ? tileEnd.value.trim() : '';

    if (wallUrl || pathwayUrl || startUrl || endUrl) {
        tileset = {};
        if (wallUrl) tileset.wall = wallUrl;
        if (pathwayUrl) tileset.pathway = pathwayUrl;
        if (startUrl) tileset.start = startUrl;
        if (endUrl) tileset.end = endUrl;
    }

    const settings = {
        width: getInputIntVal('width', 20),
        height: getInputIntVal('height', 20),
        wallSize: getInputIntVal('wall-size', 10),
        displayScale: getInputFloatVal('display-scale', 1.0),
        removeWalls: getInputIntVal('remove_walls', 0),
        tileset: tileset,
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