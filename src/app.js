// Global variables
let mazeNodes = {};

// Check if globals are defined
if (typeof maxMaze === "undefined") {
    maxMaze = 0;
}

if (typeof maxSolve === "undefined") {
    maxSolve = 0;
}

if (typeof maxCanvas === "undefined") {
    maxCanvas = 0;
}

if (typeof maxCanvasDimension === "undefined") {
    maxCanvasDimension = 0;
}

if (typeof maxWallsRemove === "undefined") {
    maxWallsRemove = 300;
}

// Update remove max walls html
const removeMaxWallsText = document.querySelector(".desc span");
if (removeMaxWallsText) {
    removeMaxWallsText.innerHTML = maxWallsRemove;
}

const removeWallsInput = document.getElementById("remove_walls");
if (removeWallsInput) {
    removeWallsInput.max = maxWallsRemove;
}

const download = document.getElementById("download");
download.addEventListener("click", downloadImage, false);
download.setAttribute("download", "maze.png");

function initMaze() {
    download.setAttribute("download", "maze.png");
    download.innerHTML = "Download Maze";

    // Build tileset from input fields
    const tileWallLeft = document.getElementById("tile-wall-left");
    const tileWallRight = document.getElementById("tile-wall-right");
    const tilePathway = document.getElementById("tile-pathway");
    // Directional start tiles
    const tileStartN = document.getElementById("tile-start-n");
    const tileStartS = document.getElementById("tile-start-s");
    const tileStartE = document.getElementById("tile-start-e");
    const tileStartW = document.getElementById("tile-start-w");
    // Directional end tiles
    const tileEndN = document.getElementById("tile-end-n");
    const tileEndS = document.getElementById("tile-end-s");
    const tileEndE = document.getElementById("tile-end-e");
    const tileEndW = document.getElementById("tile-end-w");
    const showStrokeCheckbox = document.getElementById("show-stroke");

    let tileset = null;
    const wallLeftUrl = tileWallLeft ? tileWallLeft.value.trim() : "";
    const wallRightUrl = tileWallRight ? tileWallRight.value.trim() : "";
    const pathwayValue = tilePathway ? tilePathway.value.trim() : "";

    // Check if pathway is multi-select (comma-separated values)
    const pathwayPicker = tilePathway
        ? tilePathway.closest(".asset-picker")
        : null;
    const isPathwayMulti =
        pathwayPicker && pathwayPicker.dataset.multi === "true";
    let pathwayTiles = null;

    if (pathwayValue) {
        if (isPathwayMulti && pathwayValue.includes(",")) {
            // Parse as array, keeping "blank" as-is
            pathwayTiles = pathwayValue
                .split(",")
                .map((v) => v.trim())
                .filter((v) => v);
        } else if (isPathwayMulti) {
            // Single value but multi-select enabled - use as array
            pathwayTiles = [pathwayValue];
        } else {
            // Single select mode - use as string
            pathwayTiles = pathwayValue;
        }
    }

    // Directional start URLs
    const startNUrl = tileStartN ? tileStartN.value.trim() : "";
    const startSUrl = tileStartS ? tileStartS.value.trim() : "";
    const startEUrl = tileStartE ? tileStartE.value.trim() : "";
    const startWUrl = tileStartW ? tileStartW.value.trim() : "";
    // Directional end URLs
    const endNUrl = tileEndN ? tileEndN.value.trim() : "";
    const endSUrl = tileEndS ? tileEndS.value.trim() : "";
    const endEUrl = tileEndE ? tileEndE.value.trim() : "";
    const endWUrl = tileEndW ? tileEndW.value.trim() : "";

    const hasAnyTile =
        wallLeftUrl ||
        wallRightUrl ||
        pathwayTiles ||
        startNUrl ||
        startSUrl ||
        startEUrl ||
        startWUrl ||
        endNUrl ||
        endSUrl ||
        endEUrl ||
        endWUrl;

    if (hasAnyTile) {
        tileset = {};
        if (wallLeftUrl) tileset.wallLeft = wallLeftUrl;
        if (wallRightUrl) tileset.wallRight = wallRightUrl;
        if (pathwayTiles) tileset.pathway = pathwayTiles;
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
    const strokeTopCheckbox = document.getElementById("stroke-top");
    const strokeBottomCheckbox = document.getElementById("stroke-bottom");
    const strokeCornersCheckbox = document.getElementById("stroke-corners");
    const strokeWallCornersCheckbox = document.getElementById(
        "stroke-wall-corners",
    );
    const debugStrokeColorsCheckbox = document.getElementById(
        "debug-stroke-colors",
    );
    const debugTestPatternCheckbox =
        document.getElementById("debug-test-pattern");
    const showBlockNumbersCheckbox =
        document.getElementById("show-block-numbers");
    const tightSpacingCheckbox = document.getElementById("tight-spacing");
    const strokeTop = strokeTopCheckbox ? strokeTopCheckbox.checked : true;
    const strokeBottom = strokeBottomCheckbox
        ? strokeBottomCheckbox.checked
        : true;
    const strokeCorners = strokeCornersCheckbox
        ? strokeCornersCheckbox.checked
        : true;
    const strokeWallCorners = strokeWallCornersCheckbox
        ? strokeWallCornersCheckbox.checked
        : false;
    const debugStrokeColors = debugStrokeColorsCheckbox
        ? debugStrokeColorsCheckbox.checked
        : false;
    const debugTestPattern = debugTestPatternCheckbox
        ? debugTestPatternCheckbox.checked
        : false;
    const showBlockNumbers = showBlockNumbersCheckbox
        ? showBlockNumbersCheckbox.checked
        : false;
    const tightSpacing = tightSpacingCheckbox
        ? tightSpacingCheckbox.checked
        : false;
    const wallHeight = getInputFloatVal("wall-height", 1.0);
    const strokeWidth = getInputFloatVal("stroke-width", 2);
    const wallBgColorInput = document.getElementById("wall-bg-color");
    const wallBgColor = wallBgColorInput ? wallBgColorInput.value.trim() : "";
    const isoRatioSelect = document.getElementById("iso-ratio");
    const isoRatio = isoRatioSelect ? parseFloat(isoRatioSelect.value) : 0.5;
    const endMarkerOffset = getInputFloatVal("end-marker-offset", -3.5);
    const endMarkerOffsetX = getInputFloatVal("end-marker-offset-x", -1);
    const showEntryIndicatorsCheckbox = document.getElementById("show-entry-indicators");
    const showEntryIndicators = showEntryIndicatorsCheckbox ? showEntryIndicatorsCheckbox.checked : true;
    const entryIndicatorFontSize = getInputFloatVal("entry-indicator-font-size", 0);

    const settings = {
        width: getInputIntVal("width", 20),
        height: getInputIntVal("height", 20),
        wallSize: getInputIntVal("wall-size", 10),
        displayScale: getInputFloatVal("display-scale", 1.0),
        pathWidth: getInputIntVal("path-width", 1),
        pathHeight: getInputIntVal("path-height", 1),
        removeWalls: getInputIntVal("remove_walls", 0),
        tileset: tileset,
        showStroke: showStroke,
        strokeTop: strokeTop,
        strokeBottom: strokeBottom,
        strokeCorners: strokeCorners,
        strokeWallCorners: strokeWallCorners,
        debugStrokeColors: debugStrokeColors,
        debugTestPattern: debugTestPattern,
        showBlockNumbers: showBlockNumbers,
        tightSpacing: tightSpacing,
        wallHeight: wallHeight,
        strokeWidth: strokeWidth,
        wallBgColor: wallBgColor,
        isoRatio: isoRatio,
        endMarkerOffset: endMarkerOffset,
        endMarkerOffsetX: endMarkerOffsetX,
        showEntryIndicators: showEntryIndicators,
        entryIndicatorFontSize: entryIndicatorFontSize,
        entryType: "",
        bias: "",
        color: "#000000",
        backgroudColor: "#FFFFFF",
        solveColor: "#cc3737",

        // restrictions
        maxMaze: maxMaze,
        maxCanvas: maxCanvas,
        maxCanvasDimension: maxCanvasDimension,
        maxSolve: maxSolve,
        maxWallsRemove: maxWallsRemove,
    };

    const colors = ["color", "backgroundColor", "solveColor"];
    for (let i = 0; i < colors.length; i++) {
        const colorInput = document.getElementById(colors[i]);
        settings[colors[i]] = colorInput.value;
        if (!isValidHex(settings[colors[i]])) {
            let defaultColor = colorInput.parentNode.dataset.default;
            colorInput.value = defaultColor;
            settings[colors[i]] = defaultColor;
        }

        const colorSample =
            colorInput.parentNode.querySelector(".color-sample");
        colorSample.style = "background-color: " + settings[colors[i]] + ";";
    }

    if (settings["removeWalls"] > maxWallsRemove) {
        settings["removeWalls"] = maxWallsRemove;
        if (removeWallsInput) {
            removeWallsInput.value = maxWallsRemove;
        }
    }

    const entry = document.getElementById("entry");
    if (entry) {
        settings["entryType"] = entry.options[entry.selectedIndex].value;
    }

    const flipStartCheckbox = document.getElementById("flip-start");
    const flipExitCheckbox = document.getElementById("flip-exit");
    settings["flipStart"] = flipStartCheckbox ? flipStartCheckbox.checked : false;
    settings["flipExit"] = flipExitCheckbox ? flipExitCheckbox.checked : false;

    const bias = document.getElementById("bias");
    if (bias) {
        settings["bias"] = bias.options[bias.selectedIndex].value;
    }

    const maze = new Maze(settings);
    maze.generate();

    // Load tileset images (if any) before drawing
    maze.loadTileset().then(function () {
        maze.draw();

        // Save canvas state for decoration preview overlay
        if (
            typeof TilePlacement !== "undefined" &&
            TilePlacement.saveCanvasState
        ) {
            TilePlacement.saveCanvasState();
        }

        if (download && download.classList.contains("hide")) {
            download.classList.toggle("hide");
        }

        const solveButton = document.getElementById("solve");
        if (solveButton && solveButton.classList.contains("hide")) {
            solveButton.classList.toggle("hide");
        }

        mazeNodes = {};
        if (maze.matrix.length) {
            mazeNodes = maze;
        }

        location.href = "#";
        location.href = "#generate";
    });
}

function downloadImage(e) {
    const formatSelect = document.getElementById("export-format");
    const format = formatSelect ? formatSelect.value : "png";

    if (format === "svg" && mazeNodes && mazeNodes.generateSVG) {
        const svg = mazeNodes.generateSVG();
        if (svg) {
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            download.setAttribute("href", url);
            download.setAttribute("download", "maze.svg");
        }
    } else {
        try {
            const image = document
                .getElementById("maze")
                .toDataURL("image/png");
            download.setAttribute("href", image);
            download.setAttribute("download", "maze.png");
        } catch (err) {
            // Canvas is tainted by cross-origin images
            e.preventDefault();
            alert(
                "Cannot export PNG: canvas contains cross-origin images. Try running from a local server or use SVG export instead.",
            );
            console.error("toDataURL failed:", err);
        }
    }
}

function initSolve() {
    const solveButton = document.getElementById("solve");
    if (solveButton) {
        solveButton.classList.toggle("hide");
    }

    download.setAttribute("download", "maze-solved.png");
    download.innerHTML = "Download Solved Maze";

    if (typeof mazeNodes.matrix === "undefined" || !mazeNodes.matrix.length) {
        return;
    }

    const solver = new Solver(mazeNodes);
    solver.solve();
    if (mazeNodes.wallsRemoved) {
        solver.drawAstarSolve();
    } else {
        solver.draw();
    }

    mazeNodes = {};
}
