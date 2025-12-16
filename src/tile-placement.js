/**
 * Tile Placement Interaction Module
 * Handles canvas click events for placing decorative tiles
 */

(function(root) {
  'use strict';

  // Currently selected decoration tile URL and layer
  var selectedDecorationTile = null;
  var selectedLayer = 'floor'; // 'floor' (under walls) or 'overlay' (above walls)

  // Undo stack for decoration placements
  // Each entry: { key: "x,y", previous: null | {tileUrl, category, layer} }
  var undoStack = [];
  var MAX_UNDO_STACK = 50;

  // Decoration categories with available tiles and their default layers
  var DECORATION_CATEGORIES = {
    furniture: {
      layer: 'floor',  // Furniture goes under walls
      tiles: [
        'src/assets/isoChest.png',
        'src/assets/isoChest2.png',
        'src/assets/IsoTableRound.png',
        'src/assets/IsoTableSquare.png',
        'src/assets/IsoChair1.png',
        'src/assets/IsoChair2.png',
        'src/assets/isobed.png',
        'src/assets/isobookcase.png',
        'src/assets/IsoBarrel.png',
        'src/assets/isocrate.png'
      ]
    },
    lighting: {
      layer: 'overlay',  // Lighting effects go on top
      tiles: [
        'src/assets/isowalltorch.png',
        'src/assets/isowalltorch2.png',
        'src/assets/isocandle.png',
        'src/assets/isocandlelit.png'
      ]
    },
    hazards: {
      layer: 'floor',  // Hazards on floor
      tiles: [
        'src/assets/Iso-Pit.png',
        'src/assets/isobones.png',
        'src/assets/isobones2.png'
      ]
    }
  };

  // Map tile URL to its default layer
  var tileLayerMap = {};

  // Track hovered grid cell for preview
  var hoveredCell = null;

  // Cache for preview image
  var previewImage = null;
  var previewImageUrl = null;

  // Saved canvas state for preview overlay
  var savedCanvasData = null;

  /**
   * Initialize tile placement functionality
   */
  function initTilePlacement() {
    var canvas = document.getElementById('maze');
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // Initialize decoration palette UI
    initDecorationPalette();

    // Initialize export/import buttons
    initExportImport();
  }

  /**
   * Handle mouse move on the maze canvas
   */
  function handleCanvasMouseMove(e) {
    if (!selectedDecorationTile) {
      hoveredCell = null;
      clearPreview();
      updateHoverInfo(null);
      return;
    }

    if (typeof mazeNodes === 'undefined' || !mazeNodes.matrix || !mazeNodes.matrix.length) {
      return;
    }

    var canvas = e.target;
    var rect = canvas.getBoundingClientRect();
    var screenX = e.clientX - rect.left;
    var screenY = e.clientY - rect.top;

    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var matrixCols = mazeNodes.matrix[0].length;
    var matrixRows = mazeNodes.matrix.length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;
    var scale = mazeNodes.displayScale;

    var coords = IsoGeometry.screenToGrid(
      screenX, screenY, tileWidth, tileHeight, offsetX, offsetY, scale
    );

    if (coords.gridX >= 0 && coords.gridX < matrixCols &&
        coords.gridY >= 0 && coords.gridY < matrixRows) {
      var pixel = parseInt(mazeNodes.matrix[coords.gridY].charAt(coords.gridX), 10);
      var isFloor = pixel === 0;
      var decoration = mazeNodes.getDecoration(coords.gridX, coords.gridY);

      var newHoveredCell = isFloor ? { x: coords.gridX, y: coords.gridY } : null;

      // Only redraw if hovered cell changed
      if (!hoveredCell || !newHoveredCell ||
          hoveredCell.x !== newHoveredCell.x || hoveredCell.y !== newHoveredCell.y) {
        hoveredCell = newHoveredCell;
        drawPreview();
      }

      updateHoverInfo({
        x: coords.gridX,
        y: coords.gridY,
        isFloor: isFloor,
        hasDecoration: !!decoration,
        decorationUrl: decoration ? decoration.tileUrl : null,
        decorationLayer: decoration ? decoration.layer : null
      });
    } else {
      if (hoveredCell) {
        hoveredCell = null;
        clearPreview();
      }
      updateHoverInfo(null);
    }
  }

  /**
   * Handle mouse leave on the canvas
   */
  function handleCanvasMouseLeave() {
    hoveredCell = null;
    clearPreview();
    updateHoverInfo(null);
  }

  /**
   * Save the current canvas state for preview overlay
   */
  function saveCanvasState() {
    var canvas = document.getElementById('maze');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    savedCanvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Clear the preview by restoring saved canvas state
   */
  function clearPreview() {
    if (!savedCanvasData) return;
    var canvas = document.getElementById('maze');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(savedCanvasData, 0, 0);
  }

  /**
   * Draw the preview decoration at the hovered cell
   */
  function drawPreview() {
    if (!hoveredCell || !selectedDecorationTile || !previewImage) {
      clearPreview();
      return;
    }

    if (typeof mazeNodes === 'undefined' || !mazeNodes.matrix) return;

    var canvas = document.getElementById('maze');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // Restore clean canvas first
    if (savedCanvasData) {
      ctx.putImageData(savedCanvasData, 0, 0);
    } else {
      // No saved state yet, can't draw preview
      return;
    }

    // Calculate position (same as decoration rendering in maze-iso.js)
    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var cubeHeight = tileHeight * (mazeNodes.wallHeight || 1);
    var matrixCols = mazeNodes.matrix[0].length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;
    var scale = mazeNodes.displayScale || 1;

    var j = hoveredCell.x;
    var i = hoveredCell.y;

    var isoX = (j - i) * tileWidth * 0.5 + offsetX;
    var isoY = (j + i) * tileHeight * 0.5 + offsetY;

    var tightPadding = mazeNodes.tightSpacing ? (mazeNodes.strokeWidth || 2) * 0.5 : 0;
    var tileAspect = previewImage.naturalHeight / previewImage.naturalWidth;
    var drawWidth = tileWidth + tightPadding * 2;
    var drawHeight = drawWidth * tileAspect;
    var drawX = isoX - drawWidth * 0.5;
    var floorBottomY = isoY + tileHeight + cubeHeight;
    var drawY = floorBottomY - drawHeight;

    // Draw with transparency - scale coordinates directly since putImageData resets transform
    ctx.globalAlpha = 0.6;
    ctx.drawImage(previewImage,
      drawX * scale, drawY * scale,
      drawWidth * scale, drawHeight * scale);
    ctx.globalAlpha = 1.0;
  }

  /**
   * Load preview image for selected decoration
   */
  function loadPreviewImage(tileUrl) {
    if (previewImageUrl === tileUrl && previewImage) {
      return; // Already loaded
    }

    previewImageUrl = tileUrl;
    previewImage = null;

    if (!tileUrl) return;

    var img = new Image();
    img.onload = function() {
      previewImage = img;
      // Redraw preview if we're hovering
      if (hoveredCell) {
        drawPreview();
      }
    };
    img.src = tileUrl;
  }

  /**
   * Update the hover info display
   */
  function updateHoverInfo(info) {
    var el = document.getElementById('hover-info');
    if (!el) return;

    if (!info) {
      el.textContent = '';
      return;
    }

    if (!info.isFloor) {
      el.textContent = 'Cell (' + info.x + ', ' + info.y + '): Wall (cannot place)';
    } else if (info.hasDecoration) {
      var filename = info.decorationUrl.split('/').pop();
      var layerInfo = info.decorationLayer ? ' [' + info.decorationLayer + ']' : '';
      el.textContent = 'Cell (' + info.x + ', ' + info.y + '): ' + filename + layerInfo + ' (click to remove)';
    } else {
      el.textContent = 'Cell (' + info.x + ', ' + info.y + '): Empty (place on ' + selectedLayer + ' layer)';
    }
  }

  /**
   * Handle click on the maze canvas
   */
  function handleCanvasClick(e) {
    // Only process if a decoration tool is selected
    if (!selectedDecorationTile) return;

    // Check if maze exists
    if (typeof mazeNodes === 'undefined' || !mazeNodes.matrix || !mazeNodes.matrix.length) {
      return;
    }

    var canvas = e.target;
    var rect = canvas.getBoundingClientRect();
    var screenX = e.clientX - rect.left;
    var screenY = e.clientY - rect.top;

    // Get maze parameters
    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var matrixCols = mazeNodes.matrix[0].length;
    var matrixRows = mazeNodes.matrix.length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;
    var scale = mazeNodes.displayScale;

    // Convert to grid coordinates using IsoGeometry
    var coords = IsoGeometry.screenToGrid(
      screenX, screenY, tileWidth, tileHeight, offsetX, offsetY, scale
    );
    var gridX = coords.gridX;
    var gridY = coords.gridY;

    // Validate bounds
    if (gridX < 0 || gridX >= matrixCols || gridY < 0 || gridY >= matrixRows) {
      return;
    }

    // Check if clicking on floor (not wall)
    var pixel = parseInt(mazeNodes.matrix[gridY].charAt(gridX), 10);
    if (pixel !== 0) {
      console.log('Cannot place decoration on wall at (' + gridX + ', ' + gridY + ')');
      return;
    }

    // Get existing decoration at this position
    var existing = mazeNodes.getDecoration(gridX, gridY);
    var key = gridX + ',' + gridY;

    // Store previous state for undo
    var previousState = existing ? {
      tileUrl: existing.tileUrl,
      category: existing.category,
      layer: existing.layer
    } : null;

    if (existing && existing.tileUrl === selectedDecorationTile) {
      // Same tile - remove it (toggle off)
      mazeNodes.setDecoration(gridX, gridY, null);
    } else {
      // Place new decoration with user-selected layer
      mazeNodes.setDecoration(gridX, gridY, selectedDecorationTile, 'misc', selectedLayer);
    }

    // Track in undo stack
    undoStack.push({ key: key, previous: previousState });
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift(); // Remove oldest entry
    }
    updateUndoButton();

    // Reload decoration images and redraw
    mazeNodes.loadDecorations().then(function() {
      mazeNodes.draw();
      saveCanvasState(); // Save for preview overlay
    });
  }

  /**
   * Undo the last decoration placement
   */
  function undoLastPlacement() {
    if (undoStack.length === 0) return;
    if (typeof mazeNodes === 'undefined' || !mazeNodes.setDecoration) return;

    var lastAction = undoStack.pop();
    var coords = lastAction.key.split(',').map(Number);
    var gridX = coords[0];
    var gridY = coords[1];

    if (lastAction.previous) {
      // Restore previous decoration
      mazeNodes.setDecoration(
        gridX, gridY,
        lastAction.previous.tileUrl,
        lastAction.previous.category,
        lastAction.previous.layer
      );
    } else {
      // Remove decoration (there was nothing before)
      mazeNodes.setDecoration(gridX, gridY, null);
    }

    updateUndoButton();

    mazeNodes.loadDecorations().then(function() {
      mazeNodes.draw();
      saveCanvasState(); // Save for preview overlay
    });
  }

  /**
   * Update undo button state
   */
  function updateUndoButton() {
    var btn = document.getElementById('undo-decoration');
    if (btn) {
      btn.disabled = undoStack.length === 0;
      btn.textContent = 'Undo' + (undoStack.length > 0 ? ' (' + undoStack.length + ')' : '');
    }
  }

  /**
   * Set the currently selected decoration tile
   */
  function setSelectedDecoration(tileUrl) {
    selectedDecorationTile = tileUrl;
    loadPreviewImage(tileUrl);
    updatePaletteSelection();
    updateCursor();
  }

  /**
   * Clear the selected decoration (deselect tool)
   */
  function clearSelectedDecoration() {
    selectedDecorationTile = null;
    previewImage = null;
    previewImageUrl = null;
    hoveredCell = null;
    clearPreview();
    updatePaletteSelection();
    updateCursor();
  }

  /**
   * Get the currently selected decoration tile URL
   */
  function getSelectedDecoration() {
    return selectedDecorationTile;
  }

  /**
   * Update cursor style based on selection
   */
  function updateCursor() {
    var canvas = document.getElementById('maze');
    if (!canvas) return;

    if (selectedDecorationTile) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  /**
   * Update visual selection state in palette
   */
  function updatePaletteSelection() {
    var items = document.querySelectorAll('.palette-item');
    items.forEach(function(item) {
      var isSelected = item.dataset.tile === selectedDecorationTile;
      item.classList.toggle('selected', isSelected);
    });
  }

  /**
   * Set the selected layer
   */
  function setSelectedLayer(layer) {
    selectedLayer = layer;
    updateLayerToggle();
  }

  /**
   * Update layer toggle UI to reflect current selection
   */
  function updateLayerToggle() {
    var floorRadio = document.getElementById('layer-floor');
    var overlayRadio = document.getElementById('layer-overlay');
    if (floorRadio) floorRadio.checked = (selectedLayer === 'floor');
    if (overlayRadio) overlayRadio.checked = (selectedLayer === 'overlay');
  }

  /**
   * Initialize the decoration palette UI
   */
  function initDecorationPalette() {
    Object.entries(DECORATION_CATEGORIES).forEach(function(entry) {
      var category = entry[0];
      var categoryData = entry[1];
      var tiles = categoryData.tiles;
      var categoryLayer = categoryData.layer;

      var container = document.querySelector(
        '.palette-category[data-category="' + category + '"] .palette-items'
      );
      if (!container) return;

      tiles.forEach(function(tileUrl) {
        // Map tile to its default layer (for reference only)
        tileLayerMap[tileUrl] = categoryLayer;

        var item = document.createElement('div');
        item.className = 'palette-item';
        item.dataset.tile = tileUrl;
        item.dataset.layer = categoryLayer;
        item.title = tileUrl.split('/').pop();

        var img = document.createElement('img');
        img.src = tileUrl;
        img.alt = tileUrl.split('/').pop();
        item.appendChild(img);

        item.addEventListener('click', function() {
          setSelectedDecoration(tileUrl);
          // Don't automatically change layer - user controls it with the toggle
        });

        container.appendChild(item);
      });
    });

    // Layer toggle radio buttons
    var floorRadio = document.getElementById('layer-floor');
    var overlayRadio = document.getElementById('layer-overlay');
    if (floorRadio) {
      floorRadio.addEventListener('change', function() {
        if (this.checked) setSelectedLayer('floor');
      });
    }
    if (overlayRadio) {
      overlayRadio.addEventListener('change', function() {
        if (this.checked) setSelectedLayer('overlay');
      });
    }

    // Clear all decorations button
    var clearBtn = document.getElementById('clear-decorations');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (typeof mazeNodes !== 'undefined' && mazeNodes.clearDecorations) {
          mazeNodes.clearDecorations();
          undoStack = []; // Clear undo stack
          updateUndoButton();
          mazeNodes.draw();
        }
      });
    }

    // Undo button
    var undoBtn = document.getElementById('undo-decoration');
    if (undoBtn) {
      undoBtn.addEventListener('click', undoLastPlacement);
      updateUndoButton();
    }

    // Deselect tool button
    var deselectBtn = document.getElementById('deselect-tool');
    if (deselectBtn) {
      deselectBtn.addEventListener('click', function() {
        clearSelectedDecoration();
      });
    }
  }

  /**
   * Initialize export/import functionality
   */
  function initExportImport() {
    var exportBtn = document.getElementById('export-decorations');
    var importBtn = document.getElementById('import-decorations');

    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        if (typeof mazeNodes === 'undefined' || !mazeNodes.exportDecorations) {
          alert('No maze generated yet');
          return;
        }

        var json = mazeNodes.exportDecorations();
        var decorationCount = Object.keys(mazeNodes.decorations).length;

        if (decorationCount === 0) {
          alert('No decorations to export');
          return;
        }

        // Copy to clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(json).then(function() {
            alert('Exported ' + decorationCount + ' decoration(s) to clipboard');
          });
        } else {
          // Fallback for older browsers
          prompt('Copy this JSON:', json);
        }
      });
    }

    if (importBtn) {
      importBtn.addEventListener('click', function() {
        if (typeof mazeNodes === 'undefined' || !mazeNodes.importDecorations) {
          alert('No maze generated yet');
          return;
        }

        var json = prompt('Paste decorations JSON:');
        if (!json) return;

        if (mazeNodes.importDecorations(json)) {
          mazeNodes.loadDecorations().then(function() {
            mazeNodes.draw();
            saveCanvasState(); // Save for preview overlay
            var count = Object.keys(mazeNodes.decorations).length;
            alert('Imported ' + count + ' decoration(s)');
          });
        } else {
          alert('Failed to parse JSON. Please check the format.');
        }
      });
    }
  }

  // Expose to global scope
  root.TilePlacement = {
    init: initTilePlacement,
    setSelectedDecoration: setSelectedDecoration,
    clearSelectedDecoration: clearSelectedDecoration,
    getSelectedDecoration: getSelectedDecoration,
    setSelectedLayer: setSelectedLayer,
    getSelectedLayer: function() { return selectedLayer; },
    undo: undoLastPlacement,
    getUndoCount: function() { return undoStack.length; },
    saveCanvasState: saveCanvasState,
    DECORATION_CATEGORIES: DECORATION_CATEGORIES
  };

})(typeof self !== 'undefined' ? self : this);
