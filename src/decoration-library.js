/**
 * Custom Decoration Library Module
 * Manages user-uploaded PNG decorations stored in localStorage
 */

(function (root) {
  "use strict";

  // Constants
  var STORAGE_KEY = "maze-generator-custom-decorations";
  var MAX_IMAGE_SIZE = 512; // px - max dimension for uploaded images
  var DEFAULT_CATEGORIES = ["monsters", "props", "npcs", "effects"];
  var STORAGE_WARNING_THRESHOLD = 4 * 1024 * 1024; // 4MB warning threshold

  // In-memory library cache
  var library = null;

  /**
   * Load library from localStorage
   */
  function loadLibrary() {
    if (library !== null) return library;

    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        library = JSON.parse(data);
        // Ensure structure is valid
        if (!library.decorations) library.decorations = [];
        if (!library.categories) library.categories = DEFAULT_CATEGORIES.slice();
      } else {
        library = {
          decorations: [],
          categories: DEFAULT_CATEGORIES.slice(),
        };
      }
    } catch (e) {
      console.warn("Failed to load decoration library:", e);
      library = {
        decorations: [],
        categories: DEFAULT_CATEGORIES.slice(),
      };
    }

    return library;
  }

  /**
   * Save library to localStorage
   */
  function saveLibrary() {
    if (!library) return false;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      return true;
    } catch (e) {
      console.warn("Failed to save decoration library:", e);
      if (e.name === "QuotaExceededError") {
        alert(
          "Storage is full! Please delete some decorations to make room."
        );
      }
      return false;
    }
  }

  /**
   * Get estimated storage size in bytes
   */
  function getStorageSize() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? data.length * 2 : 0; // UTF-16 = 2 bytes per char
    } catch (e) {
      return 0;
    }
  }

  /**
   * Format bytes as human-readable string
   */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  /**
   * Resize image to max dimensions while preserving aspect ratio
   * Returns Promise<{dataUrl, width, height}>
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

          resolve({
            dataUrl: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height,
          });
        };

        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Process uploaded files and add to library
   */
  // Supported image types for decoration uploads
  var SUPPORTED_IMAGE_TYPES = ["image/png", "image/svg+xml", "image/jpeg", "image/gif", "image/webp"];

  function processUpload(files, category) {
    var lib = loadLibrary();
    var promises = [];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (SUPPORTED_IMAGE_TYPES.indexOf(file.type) === -1) {
        console.warn("Skipping unsupported file type:", file.name, file.type);
        continue;
      }

      promises.push(
        resizeImage(file, MAX_IMAGE_SIZE).then(
          (function (fileName) {
            return function (result) {
              return {
                fileName: fileName,
                dataUrl: result.dataUrl,
                width: result.width,
                height: result.height,
              };
            };
          })(file.name)
        )
      );
    }

    return Promise.all(promises).then(function (results) {
      results.forEach(function (result) {
        // Remove common image extensions from display name
        var name = result.fileName.replace(/\.(png|svg|jpe?g|gif|webp)$/i, "");
        var decoration = {
          id: "dec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          name: name,
          category: category || "props",
          dataUrl: result.dataUrl,
          width: result.width,
          height: result.height,
          created: Date.now(),
        };
        lib.decorations.push(decoration);
      });

      saveLibrary();
      renderLibraryGrid();
      updateStorageIndicator();

      return results.length;
    });
  }

  /**
   * Add a single decoration to the library
   */
  function addDecoration(name, category, dataUrl, width, height) {
    var lib = loadLibrary();

    var decoration = {
      id: "dec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: name,
      category: category || "props",
      dataUrl: dataUrl,
      width: width,
      height: height,
      created: Date.now(),
    };

    lib.decorations.push(decoration);
    saveLibrary();

    return decoration;
  }

  /**
   * Remove a decoration from the library
   */
  function removeDecoration(id) {
    var lib = loadLibrary();
    var index = lib.decorations.findIndex(function (d) {
      return d.id === id;
    });

    if (index !== -1) {
      lib.decorations.splice(index, 1);
      saveLibrary();
      renderLibraryGrid();
      updateStorageIndicator();
      return true;
    }

    return false;
  }

  /**
   * Update a decoration's properties
   */
  function updateDecoration(id, updates) {
    var lib = loadLibrary();
    var decoration = lib.decorations.find(function (d) {
      return d.id === id;
    });

    if (decoration) {
      Object.keys(updates).forEach(function (key) {
        if (key !== "id" && key !== "dataUrl") {
          decoration[key] = updates[key];
        }
      });
      saveLibrary();
      return decoration;
    }

    return null;
  }

  /**
   * Get decorations, optionally filtered by category
   */
  function getDecorations(category) {
    var lib = loadLibrary();

    if (!category || category === "all") {
      return lib.decorations;
    }

    return lib.decorations.filter(function (d) {
      return d.category === category;
    });
  }

  /**
   * Get a single decoration by ID
   */
  function getDecoration(id) {
    var lib = loadLibrary();
    return lib.decorations.find(function (d) {
      return d.id === id;
    });
  }

  /**
   * Get all categories
   */
  function getCategories() {
    var lib = loadLibrary();
    return lib.categories;
  }

  /**
   * Add a new category
   */
  function addCategory(name) {
    var lib = loadLibrary();
    var normalized = name.toLowerCase().trim();

    if (normalized && lib.categories.indexOf(normalized) === -1) {
      lib.categories.push(normalized);
      saveLibrary();
      updateCategoryDropdown();
      return true;
    }

    return false;
  }

  /**
   * Remove a category (moves decorations to 'props')
   */
  function removeCategory(name) {
    var lib = loadLibrary();
    var index = lib.categories.indexOf(name);

    if (index !== -1 && DEFAULT_CATEGORIES.indexOf(name) === -1) {
      lib.categories.splice(index, 1);

      // Move decorations in this category to 'props'
      lib.decorations.forEach(function (d) {
        if (d.category === name) {
          d.category = "props";
        }
      });

      saveLibrary();
      updateCategoryDropdown();
      renderLibraryGrid();
      return true;
    }

    return false;
  }

  /**
   * Export library as JSON
   */
  function exportLibrary() {
    var lib = loadLibrary();
    return JSON.stringify(lib, null, 2);
  }

  /**
   * Import library from JSON (merges with existing)
   */
  function importLibrary(json) {
    try {
      var imported = JSON.parse(json);
      var lib = loadLibrary();

      // Merge categories
      if (imported.categories) {
        imported.categories.forEach(function (cat) {
          if (lib.categories.indexOf(cat) === -1) {
            lib.categories.push(cat);
          }
        });
      }

      // Merge decorations (skip duplicates by id)
      if (imported.decorations) {
        var existingIds = lib.decorations.map(function (d) {
          return d.id;
        });

        imported.decorations.forEach(function (dec) {
          if (existingIds.indexOf(dec.id) === -1) {
            lib.decorations.push(dec);
          }
        });
      }

      saveLibrary();
      renderLibraryGrid();
      updateCategoryDropdown();
      updateStorageIndicator();

      return true;
    } catch (e) {
      console.error("Failed to import library:", e);
      return false;
    }
  }

  /**
   * Update storage indicator in UI
   */
  function updateStorageIndicator() {
    var indicator = document.getElementById("storage-used");
    if (!indicator) return;

    var size = getStorageSize();
    indicator.textContent = formatBytes(size);

    var container = indicator.parentElement;
    if (container) {
      if (size > STORAGE_WARNING_THRESHOLD) {
        container.classList.add("storage-warning");
      } else {
        container.classList.remove("storage-warning");
      }
    }
  }

  /**
   * Update category dropdown
   */
  function updateCategoryDropdown() {
    var select = document.getElementById("decoration-category-filter");
    var uploadSelect = document.getElementById("decoration-upload-category");
    if (!select) return;

    var categories = getCategories();
    var currentValue = select.value;

    // Clear and rebuild options
    select.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(function (cat) {
      var option = document.createElement("option");
      option.value = cat;
      option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      select.appendChild(option);
    });

    // Restore selection if still valid
    if (currentValue && categories.indexOf(currentValue) !== -1) {
      select.value = currentValue;
    }

    // Update upload category select if it exists
    if (uploadSelect) {
      var uploadValue = uploadSelect.value;
      uploadSelect.innerHTML = "";
      categories.forEach(function (cat) {
        var option = document.createElement("option");
        option.value = cat;
        option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        uploadSelect.appendChild(option);
      });
      if (uploadValue && categories.indexOf(uploadValue) !== -1) {
        uploadSelect.value = uploadValue;
      }
    }
  }

  /**
   * Render the library grid
   */
  function renderLibraryGrid() {
    var grid = document.getElementById("custom-decoration-grid");
    if (!grid) return;

    var filter = document.getElementById("decoration-category-filter");
    var category = filter ? filter.value : "all";
    var decorations = getDecorations(category);

    grid.innerHTML = "";

    if (decorations.length === 0) {
      var empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "No custom decorations yet. Upload some PNGs!";
      grid.appendChild(empty);
      return;
    }

    decorations.forEach(function (dec) {
      var item = document.createElement("div");
      item.className = "custom-decoration-item";
      item.dataset.id = dec.id;
      item.title = dec.name + " (" + dec.category + ")";

      var img = document.createElement("img");
      img.src = dec.dataUrl;
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

      if (currentSelection === decoration.dataUrl) {
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
        root.TilePlacement.setSelectedDecoration(decoration.dataUrl);
      }
      // Enable free-form mode for custom decorations
      if (root.TilePlacement.setFreeFormMode) {
        root.TilePlacement.setFreeFormMode(true);
      }
    }

    // Deselect built-in palette items (done by setSelectedDecoration via updatePaletteSelection)
    // But we need to re-add selection to custom item after that clears it

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
    var addCategoryBtn = document.getElementById("add-category-btn");
    var categoryFilter = document.getElementById("decoration-category-filter");

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
          var categorySelect = document.getElementById("decoration-upload-category");
          var category = categorySelect ? categorySelect.value : "props";
          processUpload(fileInput.files, category).then(function (count) {
            fileInput.value = "";
            if (count > 0) {
              console.log("Uploaded " + count + " decoration(s)");
            }
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
        var categorySelect = document.getElementById("decoration-upload-category");
        var category = categorySelect ? categorySelect.value : "props";
        processUpload(files, category);
      }
    });

    // Add category button
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener("click", function () {
        var name = prompt("Enter new category name:");
        if (name) {
          if (addCategory(name)) {
            var categorySelect = document.getElementById("decoration-upload-category");
            if (categorySelect) {
              categorySelect.value = name.toLowerCase().trim();
            }
          } else {
            alert("Category already exists or invalid name.");
          }
        }
      });
    }

    // Category filter change
    if (categoryFilter) {
      categoryFilter.addEventListener("change", function () {
        renderLibraryGrid();
      });
    }

    // Initial render
    updateCategoryDropdown();
    renderLibraryGrid();
    updateStorageIndicator();
  }

  // ============================================
  // Auto-placement functionality
  // ============================================

  /**
   * Seeded random number generator (mulberry32)
   * Returns a function that generates random numbers 0-1
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
   * Returns array of {gridX, gridY} for cells with value 0
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
   * Must match the offset calculation in maze-iso.js draw()
   */
  function gridToLogical(gridX, gridY, maze) {
    var tileWidth = maze.wallSize;
    var tileHeight = maze.wallSize * maze.isoRatio;
    var matrixCols = maze.matrix[0].length;

    // Calculate isoWidth (same as in draw())
    var isoWidth = matrixCols * tileWidth * 0.5;

    // Calculate stroke margin (same as in draw())
    var strokeMargin = (maze.showStroke && !maze.tightSpacing) ? maze.strokeWidth : 0;
    var halfStrokeMargin = strokeMargin * 0.5;

    // Offset must match draw() exactly
    var offsetX = isoWidth + halfStrokeMargin;
    var offsetY = tileHeight + halfStrokeMargin;

    // Calculate isometric position at the CENTER of the tile (add 0.5 to grid coords)
    // This places the decoration anchor at the bottom-center of the floor diamond
    var centerX = gridX + 0.5;
    var centerY = gridY + 0.5;
    var isoX = (centerX - centerY) * tileWidth * 0.5 + offsetX;
    var isoY = (centerX + centerY) * tileHeight * 0.5 + offsetY;

    // Add the cube height offset so decoration sits on the floor surface, not the tile top
    var cubeHeight = tileHeight * (maze.wallHeight || 1);
    isoY += cubeHeight;

    return { logicalX: isoX, logicalY: isoY };
  }

  /**
   * Get currently selected decorations from library grid AND built-in palette
   */
  function getSelectedDecorations() {
    var selected = [];

    // Check custom decorations (from library)
    var customItems = document.querySelectorAll(".custom-decoration-item.selected");
    customItems.forEach(function (item) {
      var id = item.dataset.id;
      var dec = getDecoration(id);
      if (dec) {
        selected.push(dec);
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
   * Toggle multi-selection for auto-placement
   */
  var multiSelectMode = false;

  function enableMultiSelect() {
    multiSelectMode = true;
    var grid = document.getElementById("custom-decoration-grid");
    if (grid) {
      grid.classList.add("multi-select-mode");
    }
  }

  function disableMultiSelect() {
    multiSelectMode = false;
    var grid = document.getElementById("custom-decoration-grid");
    if (grid) {
      grid.classList.remove("multi-select-mode");
    }
  }

  function toggleDecorationSelection(decorationId) {
    var item = document.querySelector(
      '.custom-decoration-item[data-id="' + decorationId + '"]'
    );
    if (item) {
      item.classList.toggle("selected");
    }
  }

  /**
   * Auto-place decorations on the maze
   */
  function autoPlaceDecorations(options) {
    options = options || {};

    // mazeNodes is a global variable
    var maze = typeof mazeNodes !== "undefined" ? mazeNodes : null;
    if (!maze || !maze.matrix || !maze.matrix.length) {
      console.warn("No maze available for auto-placement");
      return { placed: 0 };
    }

    // Get selected decorations
    var decorations = options.decorations || getSelectedDecorations();
    if (decorations.length === 0) {
      alert("Please select at least one decoration from the library first.");
      return { placed: 0 };
    }

    // Options
    var density = options.density || 10;
    var seed = options.seed || Math.floor(Math.random() * 1000000);
    var scaleMin = options.scaleMin || 0.5;
    var scaleMax = options.scaleMax || 1.5;

    // Clear any existing auto-placed decorations first
    clearAutoPlacedDecorations();

    // Create seeded random
    var random = createSeededRandom(seed);

    // Get all floor cells
    var floorCells = getFloorCells(maze);
    if (floorCells.length === 0) {
      console.warn("No floor cells found");
      return { placed: 0, seed: seed };
    }

    // Shuffle floor cells using Fisher-Yates
    for (var i = floorCells.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var temp = floorCells[i];
      floorCells[i] = floorCells[j];
      floorCells[j] = temp;
    }

    // Calculate how many decorations to place
    var numToPlace = Math.min(density, floorCells.length);

    // Track placed positions to avoid overlap (using grid cells)
    var usedCells = {};
    var placedCount = 0;

    console.log("Auto-placement: found " + floorCells.length + " floor cells, placing " + numToPlace);

    for (var k = 0; k < floorCells.length && placedCount < numToPlace; k++) {
      var cell = floorCells[k];
      var cellKey = cell.gridX + "," + cell.gridY;

      // Skip if cell already used
      if (usedCells[cellKey]) continue;

      // Verify this is actually a floor cell (value 0)
      var cellValue = parseInt(maze.matrix[cell.gridY].charAt(cell.gridX), 10);
      if (cellValue !== 0) {
        continue;
      }

      // Skip cells adjacent to walls - decorations there look visually wrong
      // Check all 8 neighbors plus the cell behind in isometric view
      var hasAdjacentWall = false;
      var checkPositions = [
        { x: cell.gridX - 1, y: cell.gridY },     // left
        { x: cell.gridX + 1, y: cell.gridY },     // right
        { x: cell.gridX, y: cell.gridY - 1 },     // above (behind in iso)
        { x: cell.gridX, y: cell.gridY + 1 },     // below (front in iso)
        { x: cell.gridX - 1, y: cell.gridY - 1 }, // top-left
        { x: cell.gridX + 1, y: cell.gridY - 1 }, // top-right
        { x: cell.gridX - 1, y: cell.gridY + 1 }, // bottom-left
        { x: cell.gridX + 1, y: cell.gridY + 1 }, // bottom-right
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
      if (hasAdjacentWall) {
        continue;
      }

      // Mark cell and neighbors as used (simple spacing)
      usedCells[cellKey] = true;

      // Pick a random decoration
      var dec = decorations[Math.floor(random() * decorations.length)];

      // Random scale within range
      var scale = scaleMin + random() * (scaleMax - scaleMin);

      // Convert grid to logical coordinates
      var logical = gridToLogical(cell.gridX, cell.gridY, maze);

      // Add small random offset within the tile for variety
      var tileWidth = maze.wallSize;
      var tileHeight = maze.wallSize * maze.isoRatio;
      logical.logicalX += (random() - 0.5) * tileWidth * 0.3;
      logical.logicalY += (random() - 0.5) * tileHeight * 0.3;

      console.log("Placing #" + (placedCount + 1) + " at grid(" + cell.gridX + "," + cell.gridY + ") scale=" + scale.toFixed(3));

      // Scale decoration to fit within a tile (use wallSize as reference)
      var tileSize = maze.wallSize;
      var imgAspect = dec.height / dec.width;
      var baseWidth = tileSize;  // Fit to tile width
      var baseHeight = tileSize * imgAspect;

      // Create free-form decoration
      var decoration = {
        tileUrl: dec.dataUrl,
        layer: "overlay",  // Use overlay layer so decorations appear on top of walls
        logicalX: logical.logicalX,
        logicalY: logical.logicalY,
        scale: scale,
        baseWidth: baseWidth,
        baseHeight: baseHeight,
        autoPlaced: true, // Mark as auto-placed for easy clearing
      };

      var id = maze.addFreeFormDecoration(decoration);
      console.log("  -> Added with id: " + id + ", tileUrl: " + dec.dataUrl);

      placedCount++;
    }

    // Load decoration images then redraw
    if (maze.loadDecorations) {
      maze.loadDecorations().then(function () {
        console.log("Decoration images loaded, redrawing...");
        console.log("  decorationImages keys:", Object.keys(maze.decorationImages));
        console.log("  freeFormDecorations count:", Object.keys(maze.freeFormDecorations || {}).length);
        maze.draw();

        // Save state if TilePlacement available
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

    // Density slider
    if (densitySlider && densityValue) {
      densitySlider.addEventListener("input", function () {
        densityValue.textContent = densitySlider.value;
      });
    }

    // Auto-place button
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

        // Update seed input with used seed for reproducibility
        if (seedInput && result.seed) {
          seedInput.value = result.seed;
        }

        console.log("Auto-placed " + result.placed + " decorations (seed: " + result.seed + ")");
      });
    }

    // Clear auto-placed button
    if (clearAutoPlacedBtn) {
      clearAutoPlacedBtn.addEventListener("click", function () {
        var count = clearAutoPlacedDecorations();
        console.log("Cleared " + count + " auto-placed decorations");
      });
    }

    // Enable multi-select on custom decorations for auto-placement
    var grid = document.getElementById("custom-decoration-grid");
    if (grid) {
      // Override click behavior when shift is held for multi-select
      grid.addEventListener("click", function (e) {
        var item = e.target.closest(".custom-decoration-item");
        if (!item) return;

        if (e.shiftKey) {
          e.stopPropagation();
          item.classList.toggle("selected");
          // Don't trigger normal selection/placement
          e.preventDefault();
        }
      }, true); // Capture phase to intercept before normal handler
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
    getDecorations: getDecorations,
    getDecoration: getDecoration,
    addDecoration: addDecoration,
    removeDecoration: removeDecoration,
    updateDecoration: updateDecoration,
    getCategories: getCategories,
    addCategory: addCategory,
    removeCategory: removeCategory,
    processUpload: processUpload,
    exportLibrary: exportLibrary,
    importLibrary: importLibrary,
    getStorageSize: getStorageSize,
    renderLibraryGrid: renderLibraryGrid,
    autoPlaceDecorations: autoPlaceDecorations,
    clearAutoPlacedDecorations: clearAutoPlacedDecorations,
  };
})(typeof window !== "undefined" ? window : this);
