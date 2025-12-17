/**
 * Tile Placement Interaction Module
 * Handles canvas click events for placing decorative tiles
 */

(function(root) {
  'use strict';

  // Currently selected decoration tile URL and layer
  var selectedDecorationTile = null;
  var selectedLayer = 'floor'; // 'floor' (under walls) or 'overlay' (above walls)

  // Wall tool mode: 'add', 'remove', or null (decoration mode)
  var selectedWallTool = null;

  // Undo stack for placements (decorations and walls)
  // Each entry: { type: 'decoration'|'wall', key: "x,y", previous: ... }
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

  // Track hovered wall cell for remove preview
  var hoveredWallCell = null;

  // Animation frame for bouncing arrow
  var animationFrameId = null;
  var animationStartTime = null;

  // Cache for preview image
  var previewImage = null;
  var previewImageUrl = null;

  // Overlay canvas for preview (avoids CORS issues with getImageData)
  var overlayCanvas = null;

  /**
   * Initialize tile placement functionality
   */
  function initTilePlacement() {
    var canvas = document.getElementById('maze');
    if (!canvas) return;

    // Create overlay canvas for preview
    createOverlayCanvas();

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // Initialize decoration palette UI
    initDecorationPalette();

    // Initialize export/import buttons
    initExportImport();
  }

  /**
   * Create or update the overlay canvas for preview
   */
  function createOverlayCanvas() {
    var mazeCanvas = document.getElementById('maze');
    if (!mazeCanvas) return;

    // Remove existing overlay if any
    if (overlayCanvas && overlayCanvas.parentNode) {
      overlayCanvas.parentNode.removeChild(overlayCanvas);
    }

    // Create new overlay canvas
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'maze-preview-overlay';
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.pointerEvents = 'none'; // Let clicks pass through
    overlayCanvas.style.left = mazeCanvas.offsetLeft + 'px';
    overlayCanvas.style.top = mazeCanvas.offsetTop + 'px';

    // Insert after maze canvas
    mazeCanvas.parentNode.insertBefore(overlayCanvas, mazeCanvas.nextSibling);

    // Match size
    updateOverlaySize();
  }

  /**
   * Update overlay canvas size to match maze canvas
   */
  function updateOverlaySize() {
    var mazeCanvas = document.getElementById('maze');
    if (!mazeCanvas || !overlayCanvas) return;

    overlayCanvas.width = mazeCanvas.width;
    overlayCanvas.height = mazeCanvas.height;
    overlayCanvas.style.left = mazeCanvas.offsetLeft + 'px';
    overlayCanvas.style.top = mazeCanvas.offsetTop + 'px';
  }

  /**
   * Handle mouse move on the maze canvas
   */
  function handleCanvasMouseMove(e) {
    // Need either decoration or wall tool selected
    if (!selectedDecorationTile && !selectedWallTool) {
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
      var isWall = pixel === 1;
      var decoration = mazeNodes.getDecoration(coords.gridX, coords.gridY);

      // Only draw decoration preview (not for wall tool)
      if (selectedDecorationTile) {
        var newHoveredCell = isFloor ? { x: coords.gridX, y: coords.gridY } : null;

        // Only redraw if hovered cell changed
        if (!hoveredCell || !newHoveredCell ||
            hoveredCell.x !== newHoveredCell.x || hoveredCell.y !== newHoveredCell.y) {
          hoveredCell = newHoveredCell;
          hoveredWallCell = null;
          drawPreview();
        }
      } else if (selectedWallTool === 'remove') {
        // Track which wall would be removed
        var wallToRemove = null;
        if (isWall) {
          wallToRemove = { x: coords.gridX, y: coords.gridY };
        } else {
          // Check neighbors
          var foundWall = findWallCellAtClick(coords.gridX, coords.gridY);
          if (foundWall) {
            wallToRemove = { x: foundWall.gridX, y: foundWall.gridY };
          }
        }

        // Only redraw if hovered wall changed
        if (!hoveredWallCell || !wallToRemove ||
            hoveredWallCell.x !== wallToRemove.x || hoveredWallCell.y !== wallToRemove.y) {
          hoveredWallCell = wallToRemove;
          hoveredCell = null;
          drawPreview();
        }
      } else if (selectedWallTool === 'add') {
        // Track which floor cell would become a wall
        var floorToAdd = isFloor ? { x: coords.gridX, y: coords.gridY } : null;

        // Only redraw if hovered cell changed
        if (!hoveredWallCell || !floorToAdd ||
            hoveredWallCell.x !== floorToAdd.x || hoveredWallCell.y !== floorToAdd.y) {
          hoveredWallCell = floorToAdd;
          hoveredCell = null;
          drawPreview();
        }
      } else {
        hoveredCell = null;
        hoveredWallCell = null;
        clearPreview();
      }

      updateHoverInfo({
        x: coords.gridX,
        y: coords.gridY,
        isFloor: isFloor,
        isWall: isWall,
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
    hoveredWallCell = null;
    clearPreview();
    updateHoverInfo(null);
  }

  /**
   * Update overlay canvas after maze redraws
   */
  function saveCanvasState() {
    // Update overlay size to match maze canvas (in case it changed)
    updateOverlaySize();
  }

  /**
   * Clear the preview overlay
   */
  function clearPreview() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    animationStartTime = null;
    if (!overlayCanvas) return;
    var ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  /**
   * Draw the preview decoration at the hovered cell or wall highlight
   */
  function drawPreview() {
    // Clear overlay first
    clearPreview();

    if (typeof mazeNodes === 'undefined' || !mazeNodes.matrix) return;
    if (!overlayCanvas) return;

    var ctx = overlayCanvas.getContext('2d');

    // Calculate common isometric parameters
    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var cubeHeight = tileHeight * (mazeNodes.wallHeight || 1);
    var matrixCols = mazeNodes.matrix[0].length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;
    var scale = mazeNodes.displayScale || 1;

    // Draw wall tool highlight (remove = red, add = green)
    if (hoveredWallCell && selectedWallTool) {
      var j = hoveredWallCell.x;
      var i = hoveredWallCell.y;

      var isoX = (j - i) * tileWidth * 0.5 + offsetX;
      var isoY = (j + i) * tileHeight * 0.5 + offsetY;

      // Choose color based on tool
      var fillColor = selectedWallTool === 'remove' ? '#ff0000' : '#00cc00';
      var strokeColor = selectedWallTool === 'remove' ? '#cc0000' : '#009900';

      // Draw a diamond at the base
      ctx.save();
      ctx.scale(scale, scale);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = fillColor;

      // Floor-level rhombus
      ctx.beginPath();
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileWidth * 0.5, isoY + tileHeight * 0.5);
      ctx.lineTo(isoX, isoY + tileHeight);
      ctx.lineTo(isoX - tileWidth * 0.5, isoY + tileHeight * 0.5);
      ctx.closePath();
      ctx.fill();

      // Add a border for visibility
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // For add tool, draw a bouncing downward arrow pointing to center
      if (selectedWallTool === 'add') {
        // Calculate bounce offset using sine wave
        if (!animationStartTime) animationStartTime = Date.now();
        var elapsed = Date.now() - animationStartTime;
        var bounceOffset = Math.sin(elapsed / 150) * tileHeight * 0.15;

        var centerX = isoX;
        var centerY = isoY + tileHeight * 0.5;
        var arrowHeight = tileHeight * 1.6;
        var arrowWidth = tileWidth * 0.3;

        // Apply bounce - arrow moves up and down, tip stays near center
        var arrowTipY = centerY - tileHeight * 0.1 + bounceOffset;

        ctx.globalAlpha = 1.0;

        // Draw arrow path
        ctx.beginPath();
        // Arrow tip at center
        ctx.moveTo(centerX, arrowTipY);
        // Left side of arrowhead
        ctx.lineTo(centerX - arrowWidth, arrowTipY - arrowHeight * 0.35);
        // Left side of shaft
        ctx.lineTo(centerX - arrowWidth * 0.4, arrowTipY - arrowHeight * 0.35);
        // Top left of shaft
        ctx.lineTo(centerX - arrowWidth * 0.4, arrowTipY - arrowHeight);
        // Top right of shaft
        ctx.lineTo(centerX + arrowWidth * 0.4, arrowTipY - arrowHeight);
        // Right side of shaft
        ctx.lineTo(centerX + arrowWidth * 0.4, arrowTipY - arrowHeight * 0.35);
        // Right side of arrowhead
        ctx.lineTo(centerX + arrowWidth, arrowTipY - arrowHeight * 0.35);
        ctx.closePath();

        // Black stroke
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // White fill
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Request next animation frame
        animationFrameId = requestAnimationFrame(function() {
          if (hoveredWallCell && selectedWallTool === 'add') {
            drawPreview();
          }
        });
      }

      ctx.restore();
      return;
    }

    // Draw decoration preview
    if (!hoveredCell || !selectedDecorationTile || !previewImage) {
      return;
    }

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

    // Draw with transparency on overlay canvas
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

    var cellPrefix = 'Cell (' + info.x + ', ' + info.y + '): ';

    // Wall tool mode
    if (selectedWallTool) {
      if (selectedWallTool === 'add') {
        if (info.isWall) {
          el.textContent = cellPrefix + 'Wall (already exists)';
        } else if (info.hasDecoration) {
          el.textContent = cellPrefix + 'Floor with decoration (click to replace with wall)';
        } else {
          el.textContent = cellPrefix + 'Floor (click to add wall)';
        }
      } else if (selectedWallTool === 'remove') {
        if (info.isWall) {
          el.textContent = cellPrefix + 'Wall (click to remove)';
        } else {
          el.textContent = cellPrefix + 'Floor (no wall to remove)';
        }
      }
      return;
    }

    // Decoration tool mode
    if (!info.isFloor) {
      el.textContent = cellPrefix + 'Wall (cannot place decoration)';
    } else if (info.hasDecoration) {
      var filename = info.decorationUrl.split('/').pop();
      var layerInfo = info.decorationLayer ? ' [' + info.decorationLayer + ']' : '';
      el.textContent = cellPrefix + filename + layerInfo + ' (click to remove)';
    } else {
      el.textContent = cellPrefix + 'Empty (place on ' + selectedLayer + ' layer)';
    }
  }

  /**
   * Handle click on the maze canvas
   */
  function handleCanvasClick(e) {
    console.log('handleCanvasClick called, selectedWallTool:', selectedWallTool, 'selectedDecorationTile:', selectedDecorationTile);
    // Check if any tool is selected
    if (!selectedDecorationTile && !selectedWallTool) return;

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

    var key = gridX + ',' + gridY;
    var pixel = parseInt(mazeNodes.matrix[gridY].charAt(gridX), 10);

    // Handle wall tool
    if (selectedWallTool) {
      handleWallEdit(gridX, gridY, pixel, key);
      return;
    }

    // Handle decoration tool
    if (selectedDecorationTile) {
      handleDecorationEdit(gridX, gridY, pixel, key);
    }
  }

  /**
   * Find the actual wall cell accounting for wall height
   * When clicking on the upper part of a wall, the floor-level calculation
   * returns the wrong cell. Only check immediate neighbors "in front".
   */
  function findWallCellAtClick(gridX, gridY) {
    if (!mazeNodes || !mazeNodes.matrix) return null;

    var matrixCols = mazeNodes.matrix[0].length;
    var matrixRows = mazeNodes.matrix.length;

    // Only check immediate neighbors in front (isometric: +x and +y directions)
    // These are the cells whose walls could visually extend up to cover this position
    var neighbors = [
      { x: gridX + 1, y: gridY },     // right in isometric
      { x: gridX, y: gridY + 1 },     // down in isometric
      { x: gridX + 1, y: gridY + 1 }  // diagonal front
    ];

    for (var i = 0; i < neighbors.length; i++) {
      var cell = neighbors[i];
      if (cell.x >= 0 && cell.x < matrixCols && cell.y >= 0 && cell.y < matrixRows) {
        var pixel = parseInt(mazeNodes.matrix[cell.y].charAt(cell.x), 10);
        if (pixel === 1) {
          return { gridX: cell.x, gridY: cell.y };
        }
      }
    }

    return null;
  }

  /**
   * Handle wall add/remove
   */
  function handleWallEdit(gridX, gridY, currentPixel, key) {
    console.log('handleWallEdit called:', { gridX, gridY, currentPixel, key, selectedWallTool });

    // For remove tool, try to find the actual wall cell if we clicked on its upper portion
    if (selectedWallTool === 'remove' && currentPixel !== 1) {
      var wallCell = findWallCellAtClick(gridX, gridY);
      if (wallCell) {
        gridX = wallCell.gridX;
        gridY = wallCell.gridY;
        currentPixel = 1;
        key = gridX + ',' + gridY;
        console.log('Adjusted to wall cell:', { gridX, gridY });
      }
    }

    var isWall = currentPixel === 1;

    if (selectedWallTool === 'add' && !isWall) {
      // Add wall - remove any decoration first
      var existingDecor = mazeNodes.getDecoration(gridX, gridY);
      if (existingDecor) {
        mazeNodes.setDecoration(gridX, gridY, null);
      }

      // Track for undo
      undoStack.push({
        type: 'wall',
        key: key,
        previous: { isWall: false, decoration: existingDecor }
      });

      // Set wall in matrix
      setMatrixCell(gridY, gridX, '1');

    } else if (selectedWallTool === 'remove' && isWall) {
      // Track for undo
      undoStack.push({
        type: 'wall',
        key: key,
        previous: { isWall: true, decoration: null }
      });

      // Remove wall from matrix
      setMatrixCell(gridY, gridX, '0');

    } else {
      // No change needed
      return;
    }

    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();

    // Redraw
    mazeNodes.draw();
    saveCanvasState();
  }

  /**
   * Handle decoration placement
   */
  function handleDecorationEdit(gridX, gridY, pixel, key) {
    // Can only place on floor
    if (pixel !== 0) {
      console.log('Cannot place decoration on wall at (' + gridX + ', ' + gridY + ')');
      return;
    }

    var existing = mazeNodes.getDecoration(gridX, gridY);

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
    undoStack.push({ type: 'decoration', key: key, previous: previousState });
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();

    // Reload decoration images and redraw
    mazeNodes.loadDecorations().then(function() {
      mazeNodes.draw();
      saveCanvasState();
    });
  }

  /**
   * Set a cell in the maze matrix
   */
  function setMatrixCell(row, col, value) {
    if (!mazeNodes.matrix[row]) {
      console.log('setMatrixCell: row not found', row);
      return;
    }
    var rowStr = mazeNodes.matrix[row];
    console.log('setMatrixCell: before', { row, col, value, rowStr });
    mazeNodes.matrix[row] = rowStr.substring(0, col) + value + rowStr.substring(col + 1);
    console.log('setMatrixCell: after', mazeNodes.matrix[row]);
  }

  /**
   * Undo the last placement (decoration or wall)
   */
  function undoLastPlacement() {
    if (undoStack.length === 0) return;
    if (typeof mazeNodes === 'undefined') return;

    var lastAction = undoStack.pop();
    var coords = lastAction.key.split(',').map(Number);
    var gridX = coords[0];
    var gridY = coords[1];

    if (lastAction.type === 'wall') {
      // Undo wall change
      if (lastAction.previous.isWall) {
        setMatrixCell(gridY, gridX, '1');
      } else {
        setMatrixCell(gridY, gridX, '0');
        // Restore decoration if there was one
        if (lastAction.previous.decoration) {
          var d = lastAction.previous.decoration;
          mazeNodes.setDecoration(gridX, gridY, d.tileUrl, d.category, d.layer);
        }
      }
    } else {
      // Undo decoration change
      if (lastAction.previous) {
        mazeNodes.setDecoration(
          gridX, gridY,
          lastAction.previous.tileUrl,
          lastAction.previous.category,
          lastAction.previous.layer
        );
      } else {
        mazeNodes.setDecoration(gridX, gridY, null);
      }
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
    // Clear wall tool when decoration is selected
    selectedWallTool = null;
    updateWallToolSelection();
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
   * Set the selected wall tool
   * @param {string|null} tool - 'add', 'remove', or null to deselect
   */
  function setSelectedWallTool(tool) {
    console.log('setSelectedWallTool called with:', tool);
    selectedWallTool = tool;
    // Clear decoration selection when wall tool is selected
    if (tool) {
      selectedDecorationTile = null;
      previewImage = null;
      previewImageUrl = null;
      hoveredCell = null;
      clearPreview();
      updatePaletteSelection();
    }
    updateWallToolSelection();
    updateCursor();
    console.log('selectedWallTool is now:', selectedWallTool);
  }

  /**
   * Clear the selected wall tool
   */
  function clearSelectedWallTool() {
    selectedWallTool = null;
    updateWallToolSelection();
    updateCursor();
  }

  /**
   * Update wall tool button selection state
   */
  function updateWallToolSelection() {
    var addBtn = document.getElementById('wall-tool-add');
    var removeBtn = document.getElementById('wall-tool-remove');
    if (addBtn) addBtn.classList.toggle('selected', selectedWallTool === 'add');
    if (removeBtn) removeBtn.classList.toggle('selected', selectedWallTool === 'remove');
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
    } else if (selectedWallTool === 'add') {
      canvas.style.cursor = 'cell';
    } else if (selectedWallTool === 'remove') {
      canvas.style.cursor = 'not-allowed';
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
        clearSelectedWallTool();
      });
    }

    // Wall tool buttons
    var wallAddBtn = document.getElementById('wall-tool-add');
    var wallRemoveBtn = document.getElementById('wall-tool-remove');
    console.log('Wall tool buttons found:', { wallAddBtn: !!wallAddBtn, wallRemoveBtn: !!wallRemoveBtn });
    if (wallAddBtn) {
      wallAddBtn.addEventListener('click', function() {
        console.log('Add wall button clicked');
        if (selectedWallTool === 'add') {
          clearSelectedWallTool();
        } else {
          setSelectedWallTool('add');
        }
      });
    }
    if (wallRemoveBtn) {
      wallRemoveBtn.addEventListener('click', function() {
        console.log('Remove wall button clicked');
        if (selectedWallTool === 'remove') {
          clearSelectedWallTool();
        } else {
          setSelectedWallTool('remove');
        }
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
    setSelectedWallTool: setSelectedWallTool,
    clearSelectedWallTool: clearSelectedWallTool,
    getSelectedWallTool: function() { return selectedWallTool; },
    undo: undoLastPlacement,
    getUndoCount: function() { return undoStack.length; },
    saveCanvasState: saveCanvasState,
    DECORATION_CATEGORIES: DECORATION_CATEGORIES
  };

})(typeof self !== 'undefined' ? self : this);
