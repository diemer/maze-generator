/**
 * Custom Decoration Library Module
 * Manages user-uploaded PNG decorations stored in Supabase
 */

(function (root) {
  "use strict";

  // Constants
  var MAX_IMAGE_SIZE = 512; // px - max dimension for uploaded images
  var SUPPORTED_IMAGE_TYPES = ["image/png", "image/svg+xml", "image/jpeg", "image/gif", "image/webp"];

  // In-memory library cache
  var decorationsCache = null;
  var isLoading = false;

  /**
   * Load decorations from Supabase
   */
  async function loadLibrary() {
    if (decorationsCache !== null) return decorationsCache;
    if (isLoading) return [];

    isLoading = true;
    try {
      if (typeof SupabaseClient === "undefined" || !SupabaseClient.getDecorations) {
        console.warn("Supabase not available for decorations");
        decorationsCache = [];
        return decorationsCache;
      }

      var result = await SupabaseClient.getDecorations();
      if (result.error) {
        console.warn("Failed to load decorations:", result.error);
        decorationsCache = [];
      } else {
        decorationsCache = result.data || [];
      }
    } catch (e) {
      console.warn("Failed to load decoration library:", e);
      decorationsCache = [];
    } finally {
      isLoading = false;
    }

    return decorationsCache;
  }

  /**
   * Refresh the cache from Supabase
   */
  async function refreshLibrary() {
    decorationsCache = null;
    return await loadLibrary();
  }

  /**
   * Resize image to max dimensions while preserving aspect ratio
   * Returns Promise<{blob, width, height}>
   */
  function resizeImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("Failed to read file"));
      };

      reader.onload = function (e) {
        var img = new Image();

        img.onerror = function () {
          reject(new Error("Failed to load image"));
        };

        img.onload = function () {
          var canvas = document.createElement("canvas");
          var scale = Math.min(1, maxSize / Math.max(img.width, img.height));

          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(function (blob) {
            resolve({
              blob: blob,
              width: canvas.width,
              height: canvas.height,
            });
          }, "image/png");
        };

        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Process uploaded files and add to Supabase
   */
  async function processUpload(files) {
    if (typeof SupabaseClient === "undefined" || !SupabaseClient.uploadDecoration) {
      if (typeof showToast !== "undefined") {
        showToast("Supabase not available", "error");
      }
      return 0;
    }

    var uploadedCount = 0;

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (SUPPORTED_IMAGE_TYPES.indexOf(file.type) === -1) {
        console.warn("Skipping unsupported file type:", file.name, file.type);
        continue;
      }

      try {
        // Resize image
        var resized = await resizeImage(file, MAX_IMAGE_SIZE);

        // Create a File object from the blob for upload
        var resizedFile = new File([resized.blob], file.name, { type: "image/png" });

        // Remove common image extensions from display name
        var name = file.name.replace(/\.(png|svg|jpe?g|gif|webp)$/i, "");

        // Upload to Supabase
        var result = await SupabaseClient.uploadDecoration(resizedFile, name);

        if (result.error) {
          console.error("Failed to upload " + file.name + ":", result.error);
          if (typeof showToast !== "undefined") {
            showToast("Failed to upload " + file.name, "error");
          }
        } else {
          uploadedCount++;
        }
      } catch (e) {
        console.error("Error processing " + file.name + ":", e);
      }
    }

    if (uploadedCount > 0) {
      await refreshLibrary();
      renderLibraryGrid();
      if (typeof showToast !== "undefined") {
        showToast("Uploaded " + uploadedCount + " decoration" + (uploadedCount > 1 ? "s" : ""), "success");
      }
    }

    return uploadedCount;
  }

  /**
   * Remove a decoration from Supabase
   */
  async function removeDecoration(id) {
    if (typeof SupabaseClient === "undefined" || !SupabaseClient.deleteDecoration) {
      return false;
    }

    var result = await SupabaseClient.deleteDecoration(id);

    if (result.error) {
      console.error("Failed to delete decoration:", result.error);
      if (typeof showToast !== "undefined") {
        showToast("Failed to delete decoration", "error");
      }
      return false;
    }

    await refreshLibrary();
    renderLibraryGrid();

    if (typeof showToast !== "undefined") {
      showToast("Decoration deleted", "success");
    }

    return true;
  }

  /**
   * Get decorations from cache
   */
  function getDecorations() {
    return decorationsCache || [];
  }

  /**
   * Get a single decoration by ID
   */
  function getDecoration(id) {
    var decorations = getDecorations();
    return decorations.find(function (d) {
      return d.id === id;
    });
  }

  /**
   * Export library as JSON (for backup)
   */
  function exportLibrary() {
    return JSON.stringify(getDecorations(), null, 2);
  }

  /**
   * Render the library grid
   */
  function renderLibraryGrid() {
    var grid = document.getElementById("custom-decoration-grid");
    if (!grid) return;

    var decorations = getDecorations();

    grid.innerHTML = "";

    if (decorations.length === 0) {
      var empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "No custom decorations yet. Upload some images!";
      grid.appendChild(empty);
      return;
    }

    decorations.forEach(function (dec) {
      var item = document.createElement("div");
      item.className = "custom-decoration-item";
      item.dataset.id = dec.id;
      item.title = dec.name;

      var img = document.createElement("img");
      img.src = dec.image_url;
      img.alt = dec.name;
      item.appendChild(img);

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.innerHTML = "&times;";
      deleteBtn.title = "Delete decoration";
      deleteBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (confirm('Delete "' + dec.name + '"?')) {
          removeDecoration(dec.id);
        }
      });
      item.appendChild(deleteBtn);

      // Click to select for placement
      item.addEventListener("click", function () {
        selectCustomDecoration(dec);
      });

      grid.appendChild(item);
    });
  }

  /**
   * Select a custom decoration for placement
   */
  function selectCustomDecoration(decoration) {
    // Use the tile-placement module's API if available
    if (root.TilePlacement) {
      // Toggle behavior: if same decoration is selected, deselect it
      var currentSelection = root.TilePlacement.getSelectedDecoration
        ? root.TilePlacement.getSelectedDecoration()
        : null;

      if (currentSelection === decoration.image_url) {
        // Same decoration - deselect it
        if (root.TilePlacement.clearSelectedDecoration) {
          root.TilePlacement.clearSelectedDecoration();
        }
        // Clear visual selection
        var items = document.querySelectorAll(".custom-decoration-item");
        items.forEach(function (item) {
          item.classList.remove("selected");
        });
        return;
      }

      if (root.TilePlacement.setSelectedDecoration) {
        root.TilePlacement.setSelectedDecoration(decoration.image_url);
      }
      // Enable free-form mode for custom decorations
      if (root.TilePlacement.setFreeFormMode) {
        root.TilePlacement.setFreeFormMode(true);
      }
    }

    // Update visual selection state for custom items
    var items = document.querySelectorAll(".custom-decoration-item");
    items.forEach(function (item) {
      item.classList.remove("selected");
    });

    var selectedItem = document.querySelector(
      '.custom-decoration-item[data-id="' + decoration.id + '"]'
    );
    if (selectedItem) {
      selectedItem.classList.add("selected");
    }
  }

  /**
   * Initialize the library UI
   */
  function initLibraryUI() {
    var uploadZone = document.getElementById("decoration-upload-zone");
    var fileInput = document.getElementById("decoration-file-input");
    var browseBtn = document.getElementById("browse-decorations-btn");

    if (!uploadZone) return;

    // Browse button click
    if (browseBtn && fileInput) {
      browseBtn.addEventListener("click", function () {
        fileInput.click();
      });
    }

    // File input change
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        if (fileInput.files.length > 0) {
          processUpload(fileInput.files).then(function () {
            fileInput.value = "";
          });
        }
      });
    }

    // Drag and drop
    uploadZone.addEventListener("dragover", function (e) {
      e.preventDefault();
      uploadZone.classList.add("drag-over");
    });

    uploadZone.addEventListener("dragleave", function (e) {
      e.preventDefault();
      uploadZone.classList.remove("drag-over");
    });

    uploadZone.addEventListener("drop", function (e) {
      e.preventDefault();
      uploadZone.classList.remove("drag-over");

      var files = Array.prototype.filter.call(e.dataTransfer.files, function (f) {
        return SUPPORTED_IMAGE_TYPES.indexOf(f.type) !== -1;
      });

      if (files.length > 0) {
        processUpload(files);
      }
    });

    // Initial load and render
    loadLibrary().then(function () {
      renderLibraryGrid();
    });
  }

  // ============================================
  // Auto-placement functionality
  // ============================================

  /**
   * Seeded random number generator (mulberry32)
   */
  function createSeededRandom(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Get all valid floor cell positions from maze matrix
   */
  function getFloorCells(maze) {
    var cells = [];
    if (!maze || !maze.matrix || !maze.matrix.length) return cells;

    for (var y = 0; y < maze.matrix.length; y++) {
      var row = maze.matrix[y];
      for (var x = 0; x < row.length; x++) {
        var value = parseInt(row.charAt(x), 10);
        if (value === 0) {
          cells.push({ gridX: x, gridY: y });
        }
      }
    }
    return cells;
  }

  /**
   * Convert grid position to logical canvas coordinates
   */
  function gridToLogical(gridX, gridY, maze) {
    var tileWidth = maze.wallSize;
    var tileHeight = maze.wallSize * maze.isoRatio;
    var matrixCols = maze.matrix[0].length;

    var isoWidth = matrixCols * tileWidth * 0.5;
    var strokeMargin = (maze.showStroke && !maze.tightSpacing) ? maze.strokeWidth : 0;
    var halfStrokeMargin = strokeMargin * 0.5;

    var offsetX = isoWidth + halfStrokeMargin;
    var offsetY = tileHeight + halfStrokeMargin;

    var centerX = gridX + 0.5;
    var centerY = gridY + 0.5;
    var isoX = (centerX - centerY) * tileWidth * 0.5 + offsetX;
    var isoY = (centerX + centerY) * tileHeight * 0.5 + offsetY;

    var cubeHeight = tileHeight * (maze.wallHeight || 1);
    isoY += cubeHeight;

    return { logicalX: isoX, logicalY: isoY };
  }

  /**
   * Get currently selected decorations
   */
  function getSelectedDecorations() {
    var selected = [];

    // Check custom decorations (from library)
    var customItems = document.querySelectorAll(".custom-decoration-item.selected");
    customItems.forEach(function (item) {
      var id = item.dataset.id;
      var dec = getDecoration(id);
      if (dec) {
        selected.push({
          id: dec.id,
          name: dec.name,
          dataUrl: dec.image_url,
          width: dec.width || 64,
          height: dec.height || 64,
        });
      }
    });

    // Check built-in palette items
    var paletteItems = document.querySelectorAll(".palette-item.selected");
    paletteItems.forEach(function (item) {
      var img = item.querySelector("img");
      if (img && img.src) {
        selected.push({
          id: "builtin_" + img.src,
          name: img.alt || "decoration",
          dataUrl: img.src,
          width: img.naturalWidth || 64,
          height: img.naturalHeight || 64,
        });
      }
    });

    return selected;
  }

  /**
   * Auto-place decorations on the maze
   */
  function autoPlaceDecorations(options) {
    options = options || {};

    var maze = typeof mazeNodes !== "undefined" ? mazeNodes : null;
    if (!maze || !maze.matrix || !maze.matrix.length) {
      console.warn("No maze available for auto-placement");
      return { placed: 0 };
    }

    var decorations = options.decorations || getSelectedDecorations();
    if (decorations.length === 0) {
      if (typeof showToast !== "undefined") {
        showToast("Please select at least one decoration first", "info");
      }
      return { placed: 0 };
    }

    var density = options.density || 10;
    var seed = options.seed || Math.floor(Math.random() * 1000000);
    var scaleMin = options.scaleMin || 0.5;
    var scaleMax = options.scaleMax || 1.5;

    clearAutoPlacedDecorations();

    var random = createSeededRandom(seed);
    var floorCells = getFloorCells(maze);
    if (floorCells.length === 0) {
      return { placed: 0, seed: seed };
    }

    // Shuffle floor cells
    for (var i = floorCells.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var temp = floorCells[i];
      floorCells[i] = floorCells[j];
      floorCells[j] = temp;
    }

    var numToPlace = Math.min(density, floorCells.length);
    var usedCells = {};
    var placedCount = 0;

    for (var k = 0; k < floorCells.length && placedCount < numToPlace; k++) {
      var cell = floorCells[k];
      var cellKey = cell.gridX + "," + cell.gridY;

      if (usedCells[cellKey]) continue;

      var cellValue = parseInt(maze.matrix[cell.gridY].charAt(cell.gridX), 10);
      if (cellValue !== 0) continue;

      // Skip cells adjacent to walls
      var hasAdjacentWall = false;
      var checkPositions = [
        { x: cell.gridX - 1, y: cell.gridY },
        { x: cell.gridX + 1, y: cell.gridY },
        { x: cell.gridX, y: cell.gridY - 1 },
        { x: cell.gridX, y: cell.gridY + 1 },
        { x: cell.gridX - 1, y: cell.gridY - 1 },
        { x: cell.gridX + 1, y: cell.gridY - 1 },
        { x: cell.gridX - 1, y: cell.gridY + 1 },
        { x: cell.gridX + 1, y: cell.gridY + 1 },
      ];
      for (var c = 0; c < checkPositions.length; c++) {
        var pos = checkPositions[c];
        if (pos.y >= 0 && pos.y < maze.matrix.length &&
            pos.x >= 0 && pos.x < maze.matrix[0].length) {
          var adjacentValue = parseInt(maze.matrix[pos.y].charAt(pos.x), 10);
          if (adjacentValue === 1) {
            hasAdjacentWall = true;
            break;
          }
        }
      }
      if (hasAdjacentWall) continue;

      usedCells[cellKey] = true;

      var dec = decorations[Math.floor(random() * decorations.length)];
      var scale = scaleMin + random() * (scaleMax - scaleMin);
      var logical = gridToLogical(cell.gridX, cell.gridY, maze);

      var tileWidth = maze.wallSize;
      var tileHeight = maze.wallSize * maze.isoRatio;
      logical.logicalX += (random() - 0.5) * tileWidth * 0.3;
      logical.logicalY += (random() - 0.5) * tileHeight * 0.3;

      var tileSize = maze.wallSize;
      var imgAspect = dec.height / dec.width;
      var baseWidth = tileSize;
      var baseHeight = tileSize * imgAspect;

      var decoration = {
        tileUrl: dec.dataUrl,
        layer: "overlay",
        logicalX: logical.logicalX,
        logicalY: logical.logicalY,
        scale: scale,
        baseWidth: baseWidth,
        baseHeight: baseHeight,
        autoPlaced: true,
      };

      maze.addFreeFormDecoration(decoration);
      placedCount++;
    }

    if (maze.loadDecorations) {
      maze.loadDecorations().then(function () {
        maze.draw();
        if (typeof TilePlacement !== "undefined" && TilePlacement.saveCanvasState) {
          TilePlacement.saveCanvasState();
        }
      });
    } else {
      maze.draw();
    }

    return { placed: placedCount, seed: seed };
  }

  /**
   * Clear all auto-placed decorations
   */
  function clearAutoPlacedDecorations() {
    var maze = typeof mazeNodes !== "undefined" ? mazeNodes : null;
    if (!maze || !maze.freeFormDecorations) return 0;

    var toRemove = [];
    Object.keys(maze.freeFormDecorations).forEach(function (id) {
      if (maze.freeFormDecorations[id].autoPlaced) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(function (id) {
      maze.removeFreeFormDecoration(id);
    });

    if (toRemove.length > 0) {
      maze.draw();
      if (typeof TilePlacement !== "undefined" && TilePlacement.saveCanvasState) {
        TilePlacement.saveCanvasState();
      }
    }

    return toRemove.length;
  }

  /**
   * Initialize auto-placement UI
   */
  function initAutoPlacementUI() {
    var densitySlider = document.getElementById("auto-placement-density");
    var densityValue = document.getElementById("auto-placement-density-value");
    var seedInput = document.getElementById("auto-placement-seed");
    var scaleMinInput = document.getElementById("auto-placement-scale-min");
    var scaleMaxInput = document.getElementById("auto-placement-scale-max");
    var autoPlaceBtn = document.getElementById("auto-place-btn");
    var clearAutoPlacedBtn = document.getElementById("clear-auto-placed-btn");

    if (densitySlider && densityValue) {
      densitySlider.addEventListener("input", function () {
        densityValue.textContent = densitySlider.value;
      });
    }

    if (autoPlaceBtn) {
      autoPlaceBtn.addEventListener("click", function () {
        var density = densitySlider ? parseInt(densitySlider.value, 10) : 10;
        var seed = seedInput && seedInput.value ? parseInt(seedInput.value, 10) : null;
        var scaleMin = scaleMinInput ? parseFloat(scaleMinInput.value) : 0.5;
        var scaleMax = scaleMaxInput ? parseFloat(scaleMaxInput.value) : 1.5;

        var result = autoPlaceDecorations({
          density: density,
          seed: seed,
          scaleMin: scaleMin,
          scaleMax: scaleMax,
        });

        if (seedInput && result.seed) {
          seedInput.value = result.seed;
        }
      });
    }

    if (clearAutoPlacedBtn) {
      clearAutoPlacedBtn.addEventListener("click", function () {
        clearAutoPlacedDecorations();
      });
    }

    // Enable multi-select with shift key
    var grid = document.getElementById("custom-decoration-grid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var item = e.target.closest(".custom-decoration-item");
        if (!item) return;

        if (e.shiftKey) {
          e.stopPropagation();
          item.classList.toggle("selected");
          e.preventDefault();
        }
      }, true);
    }
  }

  // Combined init function
  function init() {
    initLibraryUI();
    initAutoPlacementUI();
  }

  // Export module
  root.DecorationLibrary = {
    init: init,
    loadLibrary: loadLibrary,
    refreshLibrary: refreshLibrary,
    getDecorations: getDecorations,
    getDecoration: getDecoration,
    removeDecoration: removeDecoration,
    processUpload: processUpload,
    exportLibrary: exportLibrary,
    renderLibraryGrid: renderLibraryGrid,
    autoPlaceDecorations: autoPlaceDecorations,
    clearAutoPlacedDecorations: clearAutoPlacedDecorations,
  };
})(typeof window !== "undefined" ? window : this);
