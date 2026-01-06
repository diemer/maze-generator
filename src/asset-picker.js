// Asset list for tile picker
const TILE_ASSETS = [
  "src/assets/isobricks.png",
  "src/assets/isobricks2.png",
  "src/assets/isobricks3.png",
  "src/assets/isobricks4.png",
  "src/assets/isobrickswall.png",
  "src/assets/isobrickswall2.png",
  "src/assets/isobrickswall3.png",
  "src/assets/isobrickswall4.png",
  "src/assets/isocrack.png",
  "src/assets/isocube.png",
  "src/assets/Isowoodtexture.png",
  "src/assets/Isowoodtexture2.png",
  "src/assets/isorock.png",
  "src/assets/isorock2.png",
  "src/assets/IsoPillar.png",
  "src/assets/IsoPillar2.png",
  "src/assets/isosquare-pillar1.png",
  "src/assets/ISOARCH.png",
  "src/assets/ISOARCH2.png",
  "src/assets/ISOARCHporticullis.png",
  "src/assets/isoDoorWood1.png",
  "src/assets/isoDoorWood2.png",
  "src/assets/isowindow.png",
  "src/assets/isowindow2.png",
  "src/assets/isostair.png",
  "src/assets/isostair2.png",
  "src/assets/isostair3.png",
  "src/assets/isostair4.png",
  "src/assets/isoslope.png",
  "src/assets/isoslope2.png",
  "src/assets/isoslopeback.png",
  "src/assets/isoslopeback2.png",
  "src/assets/isoladder.png",
  "src/assets/isoladder2.png",
  "src/assets/isopebbles.png",
  "src/assets/Iso-Pit.png",
  "src/assets/isotree.png",
  "src/assets/isobush.png",
  "src/assets/isowalltorch.png",
  "src/assets/isowalltorch2.png",
  "src/assets/isocandle.png",
  "src/assets/isocandlelit.png",
  "src/assets/isobanner.png",
  "src/assets/isobanner2.png",
  "src/assets/IsoTableRound.png",
  "src/assets/IsoTableSquare.png",
  "src/assets/IsoChair1.png",
  "src/assets/IsoChair2.png",
  "src/assets/IsoChair3.png",
  "src/assets/IsoChair4.png",
  "src/assets/isobed.png",
  "src/assets/isobed2.png",
  "src/assets/isobed3.png",
  "src/assets/isobed4.png",
  "src/assets/isobookcase.png",
  "src/assets/isobookcase2.png",
  "src/assets/isobookcase-back.png",
  "src/assets/isobookcase-back2.png",
  "src/assets/isoempty-bookcase.png",
  "src/assets/isoempty-bookcase2.png",
  "src/assets/isobook.png",
  "src/assets/IsoBarrel.png",
  "src/assets/isoChest.png",
  "src/assets/isoChest2.png",
  "src/assets/isocrate.png",
  "src/assets/isogold.png",
  "src/assets/isoRug.png",
  "src/assets/isoRug2.png",
  "src/assets/isobones.png",
  "src/assets/isobones2.png",
  "src/assets/isolever.png",
  "src/assets/isolever2.png",
  "src/assets/isobrickswall-left.png",
  "src/assets/isobrickswall-right.png",
];

// Parse weighted tile format: "url|weight,url|weight,..." or legacy "url,url,..."
function parseWeightedTiles(inputValue) {
  if (!inputValue || !inputValue.trim()) return [];
  return inputValue.split(",").map(v => {
    v = v.trim();
    if (!v) return null;
    const parts = v.split("|");
    const url = parts[0].trim();
    const weight = parts.length > 1 ? parseFloat(parts[1]) || 1 : 1;
    return { url, weight };
  }).filter(t => t !== null);
}

// Serialize weighted tiles back to input format
function serializeWeightedTiles(tiles) {
  return tiles.map(t => `${t.url}|${t.weight}`).join(",");
}

function initAssetPickers() {
  const pickers = document.querySelectorAll(".asset-picker");

  pickers.forEach((picker) => {
    const input = picker.querySelector('input[type="text"]');
    const toggle = picker.querySelector(".picker-toggle");
    const grid = picker.querySelector(".asset-grid");
    const preview = picker.querySelector(".selected-preview");
    const isMulti = picker.dataset.multi === "true";
    const selectedTilesContainer = picker.querySelector(".selected-tiles");
    const addBlankBtn = picker.querySelector(".add-blank-btn");

    // For multi-select mode, track selected tiles as objects with {url, weight}
    let selectedTiles = [];

    // Initialize from input value
    if (isMulti && input.value.trim()) {
      selectedTiles = parseWeightedTiles(input.value);
      updateWeightedTileDisplay(
        selectedTilesContainer,
        selectedTiles,
        removeFromSelection,
        updateWeight,
      );
    }

    function removeFromSelection(index) {
      selectedTiles.splice(index, 1);
      input.value = serializeWeightedTiles(selectedTiles);
      updateWeightedTileDisplay(
        selectedTilesContainer,
        selectedTiles,
        removeFromSelection,
        updateWeight,
      );
      refreshMazeTileset();
    }

    function updateWeight(index, newWeight) {
      selectedTiles[index].weight = newWeight;
      input.value = serializeWeightedTiles(selectedTiles);
      refreshMazeTileset();
    }

    // Populate grid with assets
    TILE_ASSETS.forEach((asset) => {
      const item = document.createElement("div");
      item.className = "asset-item";
      item.innerHTML = `<img src="${asset}" alt="${asset.split("/").pop()}" title="${asset.split("/").pop()}">`;
      item.addEventListener("click", () => {
        if (isMulti) {
          // Multi-select: add to array if not already present
          const existingIndex = selectedTiles.findIndex(t => t.url === asset);
          if (existingIndex === -1) {
            selectedTiles.push({ url: asset, weight: 1 });
            input.value = serializeWeightedTiles(selectedTiles);
            updateWeightedTileDisplay(
              selectedTilesContainer,
              selectedTiles,
              removeFromSelection,
              updateWeight,
            );
          }
        } else {
          // Single select: replace value
          input.value = asset;
          updatePreview(preview, asset);
          grid.classList.remove("show");
        }
        refreshMazeTileset();
      });
      grid.appendChild(item);
    });

    // Toggle grid visibility
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      grid.classList.toggle("show");
    });

    // Update preview on input change (single-select only)
    if (!isMulti) {
      input.addEventListener("input", () => {
        updatePreview(preview, input.value);
      });
    }

    // Live update on blur (after typing a URL)
    input.addEventListener("change", () => {
      if (isMulti) {
        // Re-parse the input value
        selectedTiles = parseWeightedTiles(input.value);
        updateWeightedTileDisplay(
          selectedTilesContainer,
          selectedTiles,
          removeFromSelection,
          updateWeight,
        );
      }
      refreshMazeTileset();
    });

    // Close grid when clicking outside
    document.addEventListener("click", (e) => {
      if (!picker.contains(e.target)) {
        grid.classList.remove("show");
      }
    });

    // Add blank button (multi-select only)
    if (addBlankBtn) {
      addBlankBtn.addEventListener("click", (e) => {
        e.preventDefault();
        selectedTiles.push({ url: "blank", weight: 1 });
        input.value = serializeWeightedTiles(selectedTiles);
        updateWeightedTileDisplay(
          selectedTilesContainer,
          selectedTiles,
          removeFromSelection,
          updateWeight,
        );
        refreshMazeTileset();
      });
    }

    // Add clear button functionality
    const clearBtn = picker.querySelector(".clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (isMulti) {
          selectedTiles = [];
          input.value = "";
          updateWeightedTileDisplay(
            selectedTilesContainer,
            selectedTiles,
            removeFromSelection,
            updateWeight,
          );
        } else {
          input.value = "";
          updatePreview(preview, "");
        }
        refreshMazeTileset();
      });
    }
  });
}

// Update the weighted tile display with vertical rows
function updateWeightedTileDisplay(container, tiles, onRemove, onWeightChange) {
  if (!container) return;

  container.innerHTML = tiles
    .map((tile, idx) => {
      const isBlank = tile.url === "blank" || tile.url === "";
      const imageHtml = isBlank
        ? '<span class="blank-indicator"></span>'
        : `<img src="${tile.url}" alt="tile" title="${tile.url.split("/").pop()}">`;

      return `<div class="tile-row" data-idx="${idx}">
        ${imageHtml}
        <span class="weight-label">Weight:</span>
        <input type="number" class="weight-input" value="${tile.weight}" min="0" step="0.1" data-idx="${idx}">
        <button type="button" class="remove-tile" data-idx="${idx}">&times;</button>
      </div>`;
    })
    .join("");

  // Add remove handlers
  container.querySelectorAll(".remove-tile").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const idx = parseInt(btn.dataset.idx, 10);
      onRemove(idx);
    });
  });

  // Add weight change handlers (both input for live updates and change for final value)
  container.querySelectorAll(".weight-input").forEach((input) => {
    const handleWeightChange = () => {
      const idx = parseInt(input.dataset.idx, 10);
      const newWeight = parseFloat(input.value) || 1;
      onWeightChange(idx, newWeight);
    };
    input.addEventListener("change", handleWeightChange);
    input.addEventListener("input", handleWeightChange);
  });
}

// Update the multi-select display with tile chips (legacy, kept for compatibility)
function updateMultiSelectDisplay(container, tiles, onRemove) {
  if (!container) return;

  container.innerHTML = tiles
    .map((tile, idx) => {
      if (tile === "blank" || tile === "") {
        return `<span class="tile-chip" data-idx="${idx}">
        <span class="blank-indicator"></span>
        <button type="button" class="remove-chip">&times;</button>
      </span>`;
      }
      return `<span class="tile-chip" data-idx="${idx}">
      <img src="${tile}" alt="tile">
      <button type="button" class="remove-chip">&times;</button>
    </span>`;
    })
    .join("");

  // Add remove handlers
  container.querySelectorAll(".remove-chip").forEach((btn, idx) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onRemove(idx);
    });
  });
}

function updatePreview(previewEl, src) {
  if (src && src.trim()) {
    previewEl.innerHTML = `<img src="${src}" alt="Preview">`;
    previewEl.classList.add("has-image");
  } else {
    previewEl.innerHTML = "";
    previewEl.classList.remove("has-image");
  }
}

// Refresh the maze display with new tileset without regenerating paths
function refreshMazeTileset() {
  if (
    typeof mazeNodes === "undefined" ||
    !mazeNodes.matrix ||
    !mazeNodes.matrix.length
  ) {
    return; // No maze generated yet
  }

  // Build tileset from current input values
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

  const wallLeftValue = tileWallLeft ? tileWallLeft.value.trim() : "";
  const wallRightValue = tileWallRight ? tileWallRight.value.trim() : "";
  const pathwayValue = tilePathway ? tilePathway.value.trim() : "";

  // Check if wall-left is multi-select (comma-separated values with weights)
  const wallLeftPicker = tileWallLeft ? tileWallLeft.closest(".asset-picker") : null;
  const isWallLeftMulti = wallLeftPicker && wallLeftPicker.dataset.multi === "true";
  let wallLeftTiles = null;

  if (wallLeftValue) {
    if (isWallLeftMulti && wallLeftValue.includes(",")) {
      // Parse as weighted array
      wallLeftTiles = parseWeightedTiles(wallLeftValue);
    } else if (isWallLeftMulti) {
      // Single value but multi-select enabled
      wallLeftTiles = parseWeightedTiles(wallLeftValue);
    } else {
      // Single select mode - use as string
      wallLeftTiles = wallLeftValue;
    }
  }

  // Check if wall-right is multi-select (comma-separated values with weights)
  const wallRightPicker = tileWallRight ? tileWallRight.closest(".asset-picker") : null;
  const isWallRightMulti = wallRightPicker && wallRightPicker.dataset.multi === "true";
  let wallRightTiles = null;

  if (wallRightValue) {
    if (isWallRightMulti && wallRightValue.includes(",")) {
      // Parse as weighted array
      wallRightTiles = parseWeightedTiles(wallRightValue);
    } else if (isWallRightMulti) {
      // Single value but multi-select enabled
      wallRightTiles = parseWeightedTiles(wallRightValue);
    } else {
      // Single select mode - use as string
      wallRightTiles = wallRightValue;
    }
  }

  // Check if pathway is multi-select (comma-separated values)
  const pathwayPicker = tilePathway
    ? tilePathway.closest(".asset-picker")
    : null;
  const isPathwayMulti =
    pathwayPicker && pathwayPicker.dataset.multi === "true";
  let pathwayTiles = null;

  if (pathwayValue) {
    if (isPathwayMulti && pathwayValue.includes(",")) {
      // Parse as weighted array
      pathwayTiles = parseWeightedTiles(pathwayValue);
    } else if (isPathwayMulti) {
      // Single value but multi-select enabled
      pathwayTiles = parseWeightedTiles(pathwayValue);
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

  // Update tileset on existing maze
  let tileset = null;
  const hasAnyTile =
    wallLeftTiles ||
    wallRightTiles ||
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
    if (wallLeftTiles) tileset.wallLeft = wallLeftTiles;
    if (wallRightTiles) tileset.wallRight = wallRightTiles;
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

  const wallHeightInput = document.getElementById("wall-height");
  const strokeWidthInput = document.getElementById("stroke-width");
  const wallBgColorInput = document.getElementById("wall-bg-color");
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
  const tightSpacingCheckbox = document.getElementById("tight-spacing");
  const isoRatioSelect = document.getElementById("iso-ratio");

  mazeNodes.tileset = tileset;
  mazeNodes.tileImages = {}; // Clear cached images
  mazeNodes.floorTileMap = {}; // Clear tile selection cache so new weights take effect
  mazeNodes.showStroke = showStrokeCheckbox ? showStrokeCheckbox.checked : true;
  mazeNodes.strokeTop = strokeTopCheckbox ? strokeTopCheckbox.checked : true;
  mazeNodes.strokeBottom = strokeBottomCheckbox
    ? strokeBottomCheckbox.checked
    : true;
  mazeNodes.strokeCorners = strokeCornersCheckbox
    ? strokeCornersCheckbox.checked
    : true;
  mazeNodes.strokeWallCorners = strokeWallCornersCheckbox
    ? strokeWallCornersCheckbox.checked
    : false;
  mazeNodes.debugStrokeColors = debugStrokeColorsCheckbox
    ? debugStrokeColorsCheckbox.checked
    : false;
  mazeNodes.debugTestPattern = debugTestPatternCheckbox
    ? debugTestPatternCheckbox.checked
    : false;
  mazeNodes.tightSpacing = tightSpacingCheckbox
    ? tightSpacingCheckbox.checked
    : false;
  mazeNodes.wallHeight = wallHeightInput
    ? parseFloat(wallHeightInput.value) || 1.0
    : 1.0;
  mazeNodes.strokeWidth = strokeWidthInput
    ? parseFloat(strokeWidthInput.value) || 2
    : 2;
  mazeNodes.wallBgColor = wallBgColorInput ? wallBgColorInput.value.trim() : "";
  mazeNodes.isoRatio = isoRatioSelect
    ? parseFloat(isoRatioSelect.value) || 0.5
    : 0.5;
  const endMarkerOffsetInput = document.getElementById("end-marker-offset");
  mazeNodes.endMarkerOffset = endMarkerOffsetInput
    ? parseFloat(endMarkerOffsetInput.value) || 0
    : 0;
  const endMarkerOffsetXInput = document.getElementById("end-marker-offset-x");
  mazeNodes.endMarkerOffsetX = endMarkerOffsetXInput
    ? parseFloat(endMarkerOffsetXInput.value) || 0
    : 0;

  // Reload tileset and redraw
  mazeNodes.loadTileset().then(function () {
    mazeNodes.draw();
    // Save canvas state for decoration preview overlay
    if (typeof TilePlacement !== "undefined" && TilePlacement.saveCanvasState) {
      TilePlacement.saveCanvasState();
    }
  });
}

// Initialize stroke toggle listeners
function initStrokeToggle() {
  const strokeCheckboxes = [
    "show-stroke",
    "stroke-top",
    "stroke-bottom",
    "stroke-corners",
    "stroke-wall-corners",
    "debug-stroke-colors",
    "tight-spacing",
  ];
  strokeCheckboxes.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener("change", refreshMazeTileset);
    }
  });
}

// Initialize wall background color listener
function initWallBgColor() {
  const wallBgColorInput = document.getElementById("wall-bg-color");
  if (wallBgColorInput) {
    wallBgColorInput.addEventListener("change", function () {
      // Update color sample preview
      const colorSample =
        wallBgColorInput.parentNode.querySelector(".color-sample");
      if (colorSample) {
        colorSample.style.backgroundColor =
          wallBgColorInput.value.trim() || "transparent";
      }
      refreshMazeTileset();
    });
  }
}

// Initialize isometric ratio listener
function initIsoRatio() {
  const isoRatioSelect = document.getElementById("iso-ratio");
  if (isoRatioSelect) {
    isoRatioSelect.addEventListener("change", refreshMazeTileset);
  }
}

// Initialize end marker offset listeners
function initEndMarkerOffset() {
  const endMarkerOffsetInput = document.getElementById("end-marker-offset");
  if (endMarkerOffsetInput) {
    endMarkerOffsetInput.addEventListener("change", refreshMazeTileset);
    endMarkerOffsetInput.addEventListener("input", refreshMazeTileset);
  }
  const endMarkerOffsetXInput = document.getElementById("end-marker-offset-x");
  if (endMarkerOffsetXInput) {
    endMarkerOffsetXInput.addEventListener("change", refreshMazeTileset);
    endMarkerOffsetXInput.addEventListener("input", refreshMazeTileset);
  }
}

// Initialize end marker presets
function initEndMarkerPresets() {
  const presetStairs = document.getElementById("preset-stairs");
  const presetDoor = document.getElementById("preset-door");

  if (presetStairs) {
    presetStairs.addEventListener("click", function () {
      // Set offsets
      const offsetY = document.getElementById("end-marker-offset");
      const offsetX = document.getElementById("end-marker-offset-x");
      if (offsetY) offsetY.value = "-3.25";
      if (offsetX) offsetX.value = "-0.25";

      // Set stair images
      const endN = document.getElementById("tile-end-n");
      const endS = document.getElementById("tile-end-s");
      const endE = document.getElementById("tile-end-e");
      const endW = document.getElementById("tile-end-w");
      if (endN) endN.value = "src/assets/isostair.png";
      if (endS) endS.value = "src/assets/isostair3.png";
      if (endE) endE.value = "src/assets/isostair2.png";
      if (endW) endW.value = "src/assets/isostair4.png";

      // Update previews
      updateAllEndMarkerPreviews();
      refreshMazeTileset();
    });
  }

  if (presetDoor) {
    presetDoor.addEventListener("click", function () {
      // Set offsets
      const offsetY = document.getElementById("end-marker-offset");
      const offsetX = document.getElementById("end-marker-offset-x");
      if (offsetY) offsetY.value = "0";
      if (offsetX) offsetX.value = "0";

      // Set door/archway images
      const endN = document.getElementById("tile-end-n");
      const endS = document.getElementById("tile-end-s");
      const endE = document.getElementById("tile-end-e");
      const endW = document.getElementById("tile-end-w");
      if (endN) endN.value = "src/assets/stoneWallArchway_N.png";
      if (endS) endS.value = "src/assets/stoneWallArchway_S.png";
      if (endE) endE.value = "src/assets/stoneWallArchway_E.png";
      if (endW) endW.value = "src/assets/stoneWallArchway_W.png";

      // Update previews
      updateAllEndMarkerPreviews();
      refreshMazeTileset();
    });
  }
}

// Update previews for all end marker inputs
function updateAllEndMarkerPreviews() {
  const endIds = ["tile-end-n", "tile-end-s", "tile-end-e", "tile-end-w"];
  endIds.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      const picker = input.closest(".asset-picker");
      if (picker) {
        const preview = picker.querySelector(".selected-preview");
        if (preview) {
          updatePreview(preview, input.value.trim());
        }
      }
    }
  });
}

// Initialize previews for inputs with existing values
function initPreviews() {
  const pickers = document.querySelectorAll(".asset-picker");
  pickers.forEach((picker) => {
    const input = picker.querySelector('input[type="text"]');
    const preview = picker.querySelector(".selected-preview");
    if (input && preview && input.value.trim()) {
      updatePreview(preview, input.value.trim());
    }
  });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", function () {
  initAssetPickers();
  initStrokeToggle();
  initWallBgColor();
  initIsoRatio();
  initEndMarkerOffset();
  initEndMarkerPresets();
  initPreviews();

  // Initialize tile placement for decorations
  if (typeof TilePlacement !== "undefined") {
    TilePlacement.init();
  }
});
