/**
 * Tile Placement Interaction Module
 * Handles canvas click events for placing decorative tiles
 */

(function (root) {
  "use strict";

  // Currently selected decoration tile URL and layer
  var selectedDecorationTile = null;
  var selectedLayer = localStorage.getItem("decorationLayer") || "floor"; // 'floor' (under walls) or 'overlay' (above walls)

  // Wall tool mode: 'add', 'remove', or null (decoration mode)
  var selectedWallTool = null;

  // Floor tool mode: 'clear' or null
  var selectedFloorTool = null;

  // Decoration eraser mode
  var decorationEraserMode = false;

  // Selected grid decoration for manipulation
  var selectedGridDecoration = null; // { gridX, gridY, decoration }

  // Undo stack for placements (decorations and walls)
  // Each entry: { type: 'decoration'|'wall', key: "x,y", previous: ... }
  var undoStack = [];
  var MAX_UNDO_STACK = 50;

  // Decoration categories with available tiles and their default layers
  var DECORATION_CATEGORIES = {
    furniture: {
      layer: "floor", // Furniture goes under walls
      tiles: [
        "src/assets/isoChest.png",
        "src/assets/isoChest2.png",
        "src/assets/IsoTableRound.png",
        "src/assets/IsoTableSquare.png",
        "src/assets/IsoChair1.png",
        "src/assets/IsoChair2.png",
        "src/assets/isobed.png",
        "src/assets/isopebbles.png",
        "src/assets/isocrack.png",
        "src/assets/isobookcase.png",
        "src/assets/IsoBarrel.png",
        "src/assets/isocrate.png",
      ],
    },
    lighting: {
      layer: "overlay", // Lighting effects go on top
      tiles: [
        "src/assets/isowalltorch.png",
        "src/assets/isowalltorch2.png",
        "src/assets/isocandle.png",
        "src/assets/isocandlelit.png",
      ],
    },
    walls: {
      layer: "overlay", // Wall decorations go on top
      tiles: [
        "src/assets/arch-with-bricks-left.png",
        "src/assets/arch-with-bricks-right.png",
      ],
    },
    hazards: {
      layer: "floor", // Hazards on floor
      tiles: [
        "src/assets/Iso-Pit.png",
        "src/assets/isobones.png",
        "src/assets/isobones2.png",
      ],
    },
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

  // Free-form decoration mode (for custom decorations from library)
  var freeFormMode = false;
  // Force free-form mode for all decorations (user toggle)
  var forceFreeFormMode = localStorage.getItem("forceFreeFormMode") === "true";

  // Helper to check if a decoration is a custom one (data URL) vs built-in (file path)
  function isCustomDecoration(tileUrl) {
    return tileUrl && tileUrl.startsWith("data:");
  }

  // Selected free-form decoration (for dragging/editing)
  var selectedFreeForm = null; // { id, decoration }

  // Dragging state
  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragOffsetX = 0;
  var dragOffsetY = 0;
  var dragStartPos = null; // { x, y } for undo

  // Free-form hover position for preview
  var freeFormHoverPos = null; // { screenX, screenY }

  // Preview decoration data (rendered by maze as part of normal draw cycle)
  // When set, the maze will render this as a transparent preview during its draw()
  var previewDecoration = null; // { canvasX, canvasY, scale, baseWidth, baseHeight, tileUrl, layer }

  // Floating preview element (CSS-positioned, follows mouse)
  var floatingPreview = null;
  var floatingPreviewImg = null;
  var placementScaleControl = null;
  var placementScaleSlider = null;
  var placementScaleValue = null;

  // Current placement scale (adjustable before placing)
  // Default to 0.04 for a reasonable starting size (500px * 0.04 * 5 = 100px)
  var placementScale = 0.04;

  // Clipping options for free-form decorations (isometric clipping)
  var clipBottomLeft = false;
  var clipBottomRight = false;

  // Clip adjustment mode state
  var clipAdjustMode = null; // null, 'left', 'right', or 'both'
  var clipAdjustStartOffsetLeft = 0;
  var clipAdjustStartOffsetRight = 0;
  var clipPreviewOffsetLeft = 0;
  var clipPreviewOffsetRight = 0;
  var clipPreviewOffsetY = 0; // Y offset for 'both' mode (shifts anchor up/down)

  /**
   * Initialize tile placement functionality
   */
  function initTilePlacement() {
    var canvas = document.getElementById("maze");
    if (!canvas) return;

    // Create overlay canvas for preview (still used for grid-snapped decorations)
    createOverlayCanvas();

    // Initialize floating preview elements for free-form mode
    initFloatingPreview();

    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseleave", handleCanvasMouseLeave);
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("mouseup", handleCanvasMouseUp);

    // Escape key to exit placement mode
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        if (selectedDecorationTile || selectedWallTool || selectedFloorTool) {
          clearSelectedDecoration();
          clearSelectedWallTool();
          clearSelectedFloorTool();
          // Redraw to clear any preview
          if (typeof mazeNodes !== "undefined" && mazeNodes) {
            mazeNodes.draw();
          }
        }
      }
    });

    // Initialize decoration palette UI
    initDecorationPalette();

    // Initialize export/import buttons
    initExportImport();

    // Update floating controls position on scroll/resize
    window.addEventListener("scroll", positionFreeFormControls);
    window.addEventListener("resize", positionFreeFormControls);
  }

  /**
   * Initialize floating preview element and placement scale controls
   */
  function initFloatingPreview() {
    floatingPreview = document.getElementById("freeform-preview");
    if (floatingPreview) {
      floatingPreviewImg = floatingPreview.querySelector("img");
    }

    placementScaleControl = document.getElementById("placement-scale-control");
    placementScaleSlider = document.getElementById("placement-scale");
    placementScaleValue = document.getElementById("placement-scale-value");

    if (placementScaleSlider) {
      placementScaleSlider.addEventListener("input", function () {
        placementScale = parseFloat(placementScaleSlider.value);
        if (placementScaleValue) {
          placementScaleValue.textContent = placementScale.toFixed(2) + "x";
        }
        // Update floating preview size
        updateFloatingPreviewSize();
      });
    }

    // Clip toggle buttons
    var clipLeftBtn = document.getElementById("clip-bottom-left");
    var clipRightBtn = document.getElementById("clip-bottom-right");

    if (clipLeftBtn) {
      clipLeftBtn.addEventListener("click", function () {
        // If a decoration is selected, update it; otherwise update state for new placements
        if (selectedFreeForm && mazeNodes) {
          var newValue = !selectedFreeForm.decoration.clipBottomLeft;
          mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, { clipBottomLeft: newValue });
          selectedFreeForm.decoration.clipBottomLeft = newValue;
          clipLeftBtn.classList.toggle("active", newValue);
        } else {
          clipBottomLeft = !clipBottomLeft;
          clipLeftBtn.classList.toggle("active", clipBottomLeft);
        }
        // Trigger redraw to update preview/decoration
        if (typeof mazeNodes !== "undefined" && mazeNodes) {
          mazeNodes.draw();
        }
      });
    }

    if (clipRightBtn) {
      clipRightBtn.addEventListener("click", function () {
        // If a decoration is selected, update it; otherwise update state for new placements
        if (selectedFreeForm && mazeNodes) {
          var newValue = !selectedFreeForm.decoration.clipBottomRight;
          mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, { clipBottomRight: newValue });
          selectedFreeForm.decoration.clipBottomRight = newValue;
          clipRightBtn.classList.toggle("active", newValue);
        } else {
          clipBottomRight = !clipBottomRight;
          clipRightBtn.classList.toggle("active", clipBottomRight);
        }
        // Trigger redraw to update preview/decoration
        if (typeof mazeNodes !== "undefined" && mazeNodes) {
          mazeNodes.draw();
        }
      });
    }

    // Freeform clip toggle buttons (for editing placed decorations)
    var freeformClipLeftBtn = document.getElementById("freeform-clip-left");
    var freeformClipRightBtn = document.getElementById("freeform-clip-right");

    if (freeformClipLeftBtn) {
      freeformClipLeftBtn.addEventListener("click", function () {
        if (selectedFreeForm && mazeNodes) {
          var hint = document.getElementById("clip-adjust-hint");
          // If already clipped, turn off immediately
          if (selectedFreeForm.decoration.clipBottomLeft) {
            mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, { clipBottomLeft: false, clipOffsetLeft: 0 });
            selectedFreeForm.decoration.clipBottomLeft = false;
            selectedFreeForm.decoration.clipOffsetLeft = 0;
            freeformClipLeftBtn.classList.remove("active", "adjusting");
            if (hint) hint.style.display = "none";
            clipAdjustMode = null;
            mazeNodes.draw();
          } else {
            // Enter clip adjust mode
            enterClipAdjustMode('left');
          }
        }
      });
    }

    if (freeformClipRightBtn) {
      freeformClipRightBtn.addEventListener("click", function () {
        if (selectedFreeForm && mazeNodes) {
          var hint = document.getElementById("clip-adjust-hint");
          // If already clipped, turn off immediately
          if (selectedFreeForm.decoration.clipBottomRight) {
            mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, { clipBottomRight: false, clipOffsetRight: 0 });
            selectedFreeForm.decoration.clipBottomRight = false;
            selectedFreeForm.decoration.clipOffsetRight = 0;
            freeformClipRightBtn.classList.remove("active", "adjusting");
            if (hint) hint.style.display = "none";
            clipAdjustMode = null;
            mazeNodes.draw();
          } else {
            // Enter clip adjust mode
            enterClipAdjustMode('right');
          }
        }
      });
    }

    // Keyboard handler for clip adjust mode
    document.addEventListener("keydown", handleClipAdjustKeydown);
  }

  /**
   * Cancel clip adjustment mode without applying changes
   */
  function cancelClipAdjustMode() {
    if (!clipAdjustMode) return;

    var hint = document.getElementById("clip-adjust-hint");
    var btn = document.getElementById(clipAdjustMode === 'left' ? "freeform-clip-left" : "freeform-clip-right");

    // Just clear the UI state - no clip was applied yet
    if (btn) btn.classList.remove("active", "adjusting");
    if (hint) hint.style.display = "none";
    clipAdjustMode = null;

    if (mazeNodes) mazeNodes.draw();
  }

  /**
   * Enter clip adjustment mode
   */
  function enterClipAdjustMode(side) {
    if (!selectedFreeForm || !mazeNodes) return;

    var btnLeft = document.getElementById("freeform-clip-left");
    var btnRight = document.getElementById("freeform-clip-right");
    var hint = document.getElementById("clip-adjust-hint");

    // If already in adjust mode and clicking the other button, switch to 'both'
    if (clipAdjustMode && clipAdjustMode !== 'both' && clipAdjustMode !== side) {
      clipAdjustMode = 'both';
      // Initialize both preview offsets
      clipAdjustStartOffsetLeft = selectedFreeForm.decoration.clipOffsetLeft || 0;
      clipAdjustStartOffsetRight = selectedFreeForm.decoration.clipOffsetRight || 0;
      clipPreviewOffsetLeft = clipAdjustStartOffsetLeft;
      clipPreviewOffsetRight = clipAdjustStartOffsetRight;
      // Both buttons active and adjusting
      if (btnLeft) btnLeft.classList.add("active", "adjusting");
      if (btnRight) btnRight.classList.add("active", "adjusting");
      if (hint) hint.style.display = "inline";
      mazeNodes.draw();
      return;
    }

    clipAdjustMode = side;
    clipAdjustStartOffsetLeft = selectedFreeForm.decoration.clipOffsetLeft || 0;
    clipAdjustStartOffsetRight = selectedFreeForm.decoration.clipOffsetRight || 0;
    if (side === 'left') {
      clipPreviewOffsetLeft = clipAdjustStartOffsetLeft;
    } else {
      clipPreviewOffsetRight = clipAdjustStartOffsetRight;
    }

    // Update button state
    var btn = document.getElementById(side === 'left' ? "freeform-clip-left" : "freeform-clip-right");
    if (btn) btn.classList.add("active", "adjusting");

    // Show hint
    if (hint) hint.style.display = "inline";

    mazeNodes.draw();
  }

  /**
   * Handle keydown for clip adjust mode
   */
  function handleClipAdjustKeydown(e) {
    if (!clipAdjustMode || !selectedFreeForm || !mazeNodes) return;

    var hint = document.getElementById("clip-adjust-hint");
    var btnLeft = document.getElementById("freeform-clip-left");
    var btnRight = document.getElementById("freeform-clip-right");

    if (e.key === "Enter") {
      // Confirm clip - apply the preview offset(s)
      var updates = {};
      if (clipAdjustMode === 'left' || clipAdjustMode === 'both') {
        updates.clipBottomLeft = true;
        updates.clipOffsetLeft = clipPreviewOffsetLeft;
        selectedFreeForm.decoration.clipBottomLeft = true;
        selectedFreeForm.decoration.clipOffsetLeft = clipPreviewOffsetLeft;
      }
      if (clipAdjustMode === 'right' || clipAdjustMode === 'both') {
        updates.clipBottomRight = true;
        updates.clipOffsetRight = clipPreviewOffsetRight;
        selectedFreeForm.decoration.clipBottomRight = true;
        selectedFreeForm.decoration.clipOffsetRight = clipPreviewOffsetRight;
      }
      if (clipAdjustMode === 'both') {
        updates.clipOffsetY = clipPreviewOffsetY;
        selectedFreeForm.decoration.clipOffsetY = clipPreviewOffsetY;
      }
      mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, updates);

      if (btnLeft) btnLeft.classList.remove("adjusting");
      if (btnRight) btnRight.classList.remove("adjusting");
      if (hint) hint.style.display = "none";
      clipAdjustMode = null;
      mazeNodes.draw();
      e.preventDefault();
    } else if (e.key === "Escape") {
      // Cancel clip adjustment - just clear preview state
      if (btnLeft) btnLeft.classList.remove("active", "adjusting");
      if (btnRight) btnRight.classList.remove("active", "adjusting");
      if (hint) hint.style.display = "none";
      clipAdjustMode = null;
      mazeNodes.draw();
      e.preventDefault();
    }
  }

  /**
   * Show/hide floating preview and placement scale control
   */
  function showFloatingPreview(show) {
    if (floatingPreview) {
      floatingPreview.style.display = show ? "block" : "none";
    }
    if (placementScaleControl) {
      placementScaleControl.style.display = show ? "flex" : "none";
    }
  }

  /**
   * Update the floating preview image and size
   */
  function updateFloatingPreviewImage(imageUrl) {
    if (!floatingPreviewImg) return;

    if (imageUrl && previewImage) {
      floatingPreviewImg.src = imageUrl;
      updateFloatingPreviewSize();
    }
  }

  /**
   * Update floating preview size based on current placement scale and display scale
   */
  function updateFloatingPreviewSize() {
    if (!floatingPreviewImg || !previewImage) return;

    var imgWidth = previewImage.naturalWidth || previewImage.width;
    var imgHeight = previewImage.naturalHeight || previewImage.height;

    // Calculate the visual size on screen
    // The placed decoration renders at: imgWidth * placementScale * displayScale (internal canvas pixels)
    // Then scaled down by cssToInternalRatio for CSS pixels on screen
    var mazeCanvas = document.getElementById("maze");
    if (!mazeCanvas) return;

    var rect = mazeCanvas.getBoundingClientRect();
    // Get displayScale from mazeNodes global, with fallback
    var displayScale = (typeof mazeNodes !== 'undefined' && mazeNodes && mazeNodes.displayScale) ? mazeNodes.displayScale : 1;
    var cssToInternalRatio = mazeCanvas.width / rect.width;

    // Visual CSS size = internal size / cssToInternalRatio
    var visualWidth = (imgWidth * placementScale * displayScale) / cssToInternalRatio;
    var visualHeight = (imgHeight * placementScale * displayScale) / cssToInternalRatio;

    floatingPreviewImg.style.width = visualWidth + "px";
    floatingPreviewImg.style.height = visualHeight + "px";
  }

  /**
   * Position the floating preview at mouse cursor
   */
  function positionFloatingPreview(clientX, clientY) {
    if (!floatingPreview || !floatingPreviewImg) return;

    // Get current visual size
    var width = parseFloat(floatingPreviewImg.style.width) || 64;
    var height = parseFloat(floatingPreviewImg.style.height) || 64;

    // Center horizontally, anchor at bottom (click point is where decoration base will be)
    var left = clientX - width / 2;
    var top = clientY - height;

    floatingPreview.style.left = left + "px";
    floatingPreview.style.top = top + "px";
  }

  /**
   * Create or update the overlay canvas for preview
   */
  function createOverlayCanvas() {
    var mazeCanvas = document.getElementById("maze");
    if (!mazeCanvas) return;

    // Remove existing overlay if any
    if (overlayCanvas && overlayCanvas.parentNode) {
      overlayCanvas.parentNode.removeChild(overlayCanvas);
    }

    // Create new overlay canvas
    overlayCanvas = document.createElement("canvas");
    overlayCanvas.id = "maze-preview-overlay";
    overlayCanvas.style.position = "absolute";
    overlayCanvas.style.pointerEvents = "none"; // Let clicks pass through
    overlayCanvas.style.left = mazeCanvas.offsetLeft + "px";
    overlayCanvas.style.top = mazeCanvas.offsetTop + "px";

    // Insert after maze canvas
    mazeCanvas.parentNode.insertBefore(overlayCanvas, mazeCanvas.nextSibling);

    // Match size
    updateOverlaySize();
  }

  /**
   * Update overlay canvas size to match maze canvas
   */
  function updateOverlaySize() {
    var mazeCanvas = document.getElementById("maze");
    if (!mazeCanvas || !overlayCanvas) return;

    // Match internal pixel dimensions
    overlayCanvas.width = mazeCanvas.width;
    overlayCanvas.height = mazeCanvas.height;

    // IMPORTANT: Also match CSS display size to ensure visual alignment
    var rect = mazeCanvas.getBoundingClientRect();
    overlayCanvas.style.width = rect.width + "px";
    overlayCanvas.style.height = rect.height + "px";
    overlayCanvas.style.left = mazeCanvas.offsetLeft + "px";
    overlayCanvas.style.top = mazeCanvas.offsetTop + "px";
  }

  /**
   * Handle mouse move on the maze canvas
   */
  function handleCanvasMouseMove(e) {
    var canvas = e.target;
    var rect = canvas.getBoundingClientRect();

    // Use CSS pixels (consistent with placement)
    var screenX = e.clientX - rect.left;
    var screenY = e.clientY - rect.top;

    // Handle clip adjustment mode - just update preview offset, don't apply
    if (clipAdjustMode && selectedFreeForm && mazeNodes) {
      var displayScale = mazeNodes.displayScale || 1;

      // Calculate offset based on mouse position relative to decoration anchor
      var decLogicalX = selectedFreeForm.decoration.logicalX || 0;
      var decLogicalY = selectedFreeForm.decoration.logicalY || 0;
      var decScreenX = decLogicalX * displayScale;
      var decScreenY = decLogicalY * displayScale;

      // Offset is mouse distance from decoration anchor (in logical units)
      var offsetLogicalX = (screenX - decScreenX) / displayScale;
      var offsetLogicalY = (screenY - decScreenY) / displayScale;

      if (clipAdjustMode === 'both') {
        // In 'both' mode, V moves as a whole with the mouse
        // Both anchors share the same X offset, Y offset shifts the anchor point
        clipPreviewOffsetLeft = offsetLogicalX;
        clipPreviewOffsetRight = offsetLogicalX;
        clipPreviewOffsetY = offsetLogicalY;
      } else if (clipAdjustMode === 'left') {
        clipPreviewOffsetLeft = offsetLogicalX;
        clipPreviewOffsetY = 0;
      } else {
        clipPreviewOffsetRight = offsetLogicalX;
        clipPreviewOffsetY = 0;
      }

      // Redraw to show preview line
      mazeNodes.draw();
      return;
    }

    // Handle free-form decoration dragging
    if (isDragging && selectedFreeForm && mazeNodes) {
      // Convert screen coords to logical coords (consistent with placement)
      var displayScale = mazeNodes.displayScale || 1;
      var mouseLogicalX = screenX / displayScale;
      var mouseLogicalY = screenY / displayScale;
      var newLogicalX = mouseLogicalX - dragOffsetX;
      var newLogicalY = mouseLogicalY - dragOffsetY;

      mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, { logicalX: newLogicalX, logicalY: newLogicalY });
      selectedFreeForm.decoration.logicalX = newLogicalX;
      selectedFreeForm.decoration.logicalY = newLogicalY;
      clearPreview(); // Clear overlay to avoid ghosting
      mazeNodes.draw();
      // Update floating controls position
      positionFreeFormControls();
      return;
    }

    // Handle free-form preview (custom decorations that don't snap to grid)
    // Set preview data and let maze render it during its draw cycle
    if (freeFormMode && selectedDecorationTile && previewImage && mazeNodes) {
      freeFormHoverPos = { screenX: screenX, screenY: screenY };
      hoveredCell = null;
      hoveredWallCell = null;
      // Hide floating preview, use maze canvas instead
      if (floatingPreview) {
        floatingPreview.style.display = "none";
      }

      // Convert screen coordinates to logical coordinates (consistent with placement)
      var displayScale = mazeNodes.displayScale || 1;
      var logicalX = screenX / displayScale;
      var logicalY = screenY / displayScale;

      var imgWidth = previewImage.naturalWidth || previewImage.width || 64;
      var imgHeight = previewImage.naturalHeight || previewImage.height || 64;

      // Calculate scale: for built-in decorations with forced free-form mode,
      // use tile-based scale to match grid-snapped size
      var previewScale;
      if (forceFreeFormMode && !isCustomDecoration(selectedDecorationTile)) {
        var tileWidth = mazeNodes.wallSize || 10;
        previewScale = tileWidth / imgWidth;
      } else {
        previewScale = placementScale;
      }

      // Set preview decoration data - maze will render this during its draw()
      // Store logical coordinates - drawing will multiply by displayScale
      previewDecoration = {
        logicalX: logicalX,
        logicalY: logicalY,
        scale: previewScale,
        baseWidth: imgWidth,
        baseHeight: imgHeight,
        tileUrl: selectedDecorationTile,
        layer: selectedLayer,
        clipBottomLeft: clipBottomLeft,
        clipBottomRight: clipBottomRight
      };

      // Ensure image is in cache for maze to use
      if (!mazeNodes.decorationImages[selectedDecorationTile]) {
        mazeNodes.decorationImages[selectedDecorationTile] = previewImage;
      }

      // Clear overlay (no longer used for free-form preview)
      clearPreview();

      // Trigger maze redraw which will include the preview
      mazeNodes.draw();
      return;
    }

    // Need either decoration, wall, floor tool, or eraser selected
    if (!selectedDecorationTile && !selectedWallTool && !selectedFloorTool && !decorationEraserMode) {
      hoveredCell = null;
      freeFormHoverPos = null;
      clearPreview();
      updateHoverInfo(null);
      return;
    }

    if (
      typeof mazeNodes === "undefined" ||
      !mazeNodes.matrix ||
      !mazeNodes.matrix.length
    ) {
      return;
    }

    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var matrixCols = mazeNodes.matrix[0].length;
    var matrixRows = mazeNodes.matrix.length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;
    var scale = mazeNodes.displayScale;

    var coords = IsoGeometry.screenToGrid(
      screenX,
      screenY,
      tileWidth,
      tileHeight,
      offsetX,
      offsetY,
      scale,
    );

    if (
      coords.gridX >= 0 &&
      coords.gridX < matrixCols &&
      coords.gridY >= 0 &&
      coords.gridY < matrixRows
    ) {
      var pixel = parseInt(
        mazeNodes.matrix[coords.gridY].charAt(coords.gridX),
        10,
      );
      var isFloor = pixel === 0;
      var isWall = pixel === 1;
      var decoration = mazeNodes.getDecoration(coords.gridX, coords.gridY);

      // Only draw decoration preview (not for wall tool)
      if (selectedDecorationTile) {
        var newHoveredCell = isFloor
          ? { x: coords.gridX, y: coords.gridY }
          : null;

        // Only redraw if hovered cell changed
        if (
          !hoveredCell ||
          !newHoveredCell ||
          hoveredCell.x !== newHoveredCell.x ||
          hoveredCell.y !== newHoveredCell.y
        ) {
          hoveredCell = newHoveredCell;
          hoveredWallCell = null;
          drawPreview();
        }
      } else if (selectedWallTool === "remove") {
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
        if (
          !hoveredWallCell ||
          !wallToRemove ||
          hoveredWallCell.x !== wallToRemove.x ||
          hoveredWallCell.y !== wallToRemove.y
        ) {
          hoveredWallCell = wallToRemove;
          hoveredCell = null;
          drawPreview();
        }
      } else if (selectedWallTool === "add") {
        // Track which floor cell would become a wall
        var floorToAdd = isFloor ? { x: coords.gridX, y: coords.gridY } : null;

        // Only redraw if hovered cell changed
        if (
          !hoveredWallCell ||
          !floorToAdd ||
          hoveredWallCell.x !== floorToAdd.x ||
          hoveredWallCell.y !== floorToAdd.y
        ) {
          hoveredWallCell = floorToAdd;
          hoveredCell = null;
          drawPreview();
        }
      } else if (selectedFloorTool === "clear") {
        // Track which floor cell would be cleared
        var floorToClear = isFloor ? { x: coords.gridX, y: coords.gridY } : null;

        // Only redraw if hovered cell changed
        if (
          !hoveredWallCell ||
          !floorToClear ||
          hoveredWallCell.x !== floorToClear.x ||
          hoveredWallCell.y !== floorToClear.y
        ) {
          hoveredWallCell = floorToClear;
          hoveredCell = null;
          drawPreview();
        }
      } else if (decorationEraserMode) {
        // Track which floor cell would have decoration erased
        var cellToErase = isFloor ? { x: coords.gridX, y: coords.gridY } : null;

        // Only redraw if hovered cell changed
        if (
          !hoveredWallCell ||
          !cellToErase ||
          hoveredWallCell.x !== cellToErase.x ||
          hoveredWallCell.y !== cellToErase.y
        ) {
          hoveredWallCell = cellToErase;
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
        decorationLayer: decoration ? decoration.layer : null,
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
    freeFormHoverPos = null;
    previewDecoration = null; // Clear preview decoration
    clearPreview();
    updateHoverInfo(null);
    // Hide floating preview when mouse leaves canvas
    if (floatingPreview) {
      floatingPreview.style.display = "none";
    }
    // Redraw maze without preview
    if (typeof mazeNodes !== "undefined" && mazeNodes) {
      mazeNodes.draw();
    }
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
    var ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  /**
   * Draw the preview decoration at the hovered cell or wall highlight
   */
  function drawPreview() {
    // Clear overlay first
    clearPreview();

    if (typeof mazeNodes === "undefined" || !mazeNodes.matrix) return;
    if (!overlayCanvas) return;

    var ctx = overlayCanvas.getContext("2d");

    // Calculate common isometric parameters
    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var cubeHeight = tileHeight * (mazeNodes.wallHeight || 1);
    var matrixCols = mazeNodes.matrix[0].length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;
    var scale = mazeNodes.displayScale || 1;

    // Draw wall tool or floor tool highlight
    if (hoveredWallCell && (selectedWallTool || selectedFloorTool || decorationEraserMode)) {
      var j = hoveredWallCell.x;
      var i = hoveredWallCell.y;

      var isoX = (j - i) * tileWidth * 0.5 + offsetX;
      var isoY = (j + i) * tileHeight * 0.5 + offsetY;

      // Choose color based on tool
      var fillColor;
      var strokeColor;
      if (decorationEraserMode) {
        fillColor = "#ff6b6b";
        strokeColor = "#ff5252";
      } else if (selectedFloorTool === "clear") {
        fillColor = "#888888";
        strokeColor = "#555555";
      } else if (selectedWallTool === "remove") {
        fillColor = "#ff0000";
        strokeColor = "#cc0000";
      } else {
        fillColor = "#00cc00";
        strokeColor = "#009900";
      }

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
      if (selectedWallTool === "add") {
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
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.stroke();

        // White fill
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Request next animation frame
        animationFrameId = requestAnimationFrame(function () {
          if (hoveredWallCell && selectedWallTool === "add") {
            drawPreview();
          }
        });
      }

      ctx.restore();
      return;
    }

    // Note: Free-form decoration preview is now handled by the floating CSS element
    // (floatingPreview) instead of canvas drawing. See positionFloatingPreview().

    // Draw grid-snapped decoration preview
    if (!hoveredCell || !selectedDecorationTile || !previewImage) {
      return;
    }

    var j = hoveredCell.x;
    var i = hoveredCell.y;

    var isoX = (j - i) * tileWidth * 0.5 + offsetX;
    var isoY = (j + i) * tileHeight * 0.5 + offsetY;

    var tightPadding = mazeNodes.tightSpacing
      ? (mazeNodes.strokeWidth || 2) * 0.5
      : 0;
    var tileAspect = previewImage.naturalHeight / previewImage.naturalWidth;
    var drawWidth = tileWidth + tightPadding * 2;
    var drawHeight = drawWidth * tileAspect;
    var drawX = isoX - drawWidth * 0.5;
    var floorBottomY = isoY + tileHeight + cubeHeight;
    var drawY = floorBottomY - drawHeight;

    // Draw with transparency on overlay canvas
    ctx.globalAlpha = 0.6;
    ctx.drawImage(
      previewImage,
      drawX * scale,
      drawY * scale,
      drawWidth * scale,
      drawHeight * scale,
    );
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
    img.onload = function () {
      previewImage = img;
      // Redraw preview if we're hovering
      if (hoveredCell) {
        drawPreview();
      }
      // Update floating preview for free-form mode
      if (freeFormMode) {
        updateFloatingPreviewImage(tileUrl);
      }
    };
    img.src = tileUrl;
  }

  /**
   * Update the hover info display
   */
  function updateHoverInfo(info) {
    var el = document.getElementById("hover-info");
    if (!el) return;

    if (!info) {
      el.textContent = "";
      return;
    }

    var cellPrefix = "Cell (" + info.x + ", " + info.y + "): ";

    // Wall tool mode
    if (selectedWallTool) {
      if (selectedWallTool === "add") {
        if (info.isWall) {
          el.textContent = cellPrefix + "Wall (already exists)";
        } else if (info.hasDecoration) {
          el.textContent =
            cellPrefix + "Floor with decoration (click to replace with wall)";
        } else {
          el.textContent = cellPrefix + "Floor (click to add wall)";
        }
      } else if (selectedWallTool === "remove") {
        if (info.isWall) {
          el.textContent = cellPrefix + "Wall (click to remove)";
        } else {
          el.textContent = cellPrefix + "Floor (no wall to remove)";
        }
      }
      return;
    }

    // Floor tool mode
    if (selectedFloorTool === "clear") {
      if (info.isWall) {
        el.textContent = cellPrefix + "Wall (cannot clear)";
      } else {
        var isBlank =
          mazeNodes.isFloorBlank && mazeNodes.isFloorBlank(info.x, info.y);
        if (isBlank) {
          el.textContent = cellPrefix + "Blank floor (click to restore)";
        } else {
          el.textContent = cellPrefix + "Floor (click to clear)";
        }
      }
      return;
    }

    // Decoration tool mode
    if (!info.isFloor) {
      el.textContent = cellPrefix + "Wall (cannot place decoration)";
    } else if (info.hasDecoration) {
      var filename = info.decorationUrl.split("/").pop();
      var layerInfo = info.decorationLayer
        ? " [" + info.decorationLayer + "]"
        : "";
      el.textContent = cellPrefix + filename + layerInfo + " (click to remove)";
    } else {
      el.textContent =
        cellPrefix + "Empty (place on " + selectedLayer + " layer)";
    }
  }

  /**
   * Handle click on the maze canvas
   */
  function handleCanvasClick(e) {
    // If we just finished dragging, don't process click
    if (isDragging) return;

    // Check if maze exists
    if (
      typeof mazeNodes === "undefined" ||
      !mazeNodes.matrix ||
      !mazeNodes.matrix.length
    ) {
      return;
    }

    var canvas = e.target;
    var rect = canvas.getBoundingClientRect();
    var screenX = e.clientX - rect.left;
    var screenY = e.clientY - rect.top;

    // Handle free-form placement (custom decorations)
    if (freeFormMode && selectedDecorationTile) {
      handleFreeFormPlacement(screenX, screenY, canvas);
      return;
    }

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
      screenX,
      screenY,
      tileWidth,
      tileHeight,
      offsetX,
      offsetY,
      scale,
    );
    var gridX = coords.gridX;
    var gridY = coords.gridY;

    // Validate bounds
    if (gridX < 0 || gridX >= matrixCols || gridY < 0 || gridY >= matrixRows) {
      // Clicked outside grid - deselect grid decoration if any
      if (selectedGridDecoration) {
        selectedGridDecoration = null;
        showGridDecorationControls(false);
      }
      return;
    }

    var key = gridX + "," + gridY;
    var pixel = parseInt(mazeNodes.matrix[gridY].charAt(gridX), 10);

    // Handle wall tool
    if (selectedWallTool) {
      handleWallEdit(gridX, gridY, pixel, key);
      return;
    }

    // Handle floor tool
    if (selectedFloorTool) {
      handleFloorEdit(gridX, gridY, pixel, key);
      return;
    }

    // Handle decoration eraser
    if (decorationEraserMode) {
      handleDecorationErase(gridX, gridY, pixel, key);
      return;
    }

    // Handle decoration tool
    if (selectedDecorationTile) {
      handleDecorationEdit(gridX, gridY, pixel, key);
      return;
    }

    // No tool active - check for grid decoration selection
    // Check clicked cell and cells "behind" it in isometric space
    var cellsToCheck = [
      { x: gridX, y: gridY },
      { x: gridX, y: gridY + 1 },
      { x: gridX - 1, y: gridY + 1 },
      { x: gridX + 1, y: gridY + 1 },
    ];

    var foundDecoration = null;
    var foundGridX = gridX;
    var foundGridY = gridY;

    for (var i = 0; i < cellsToCheck.length; i++) {
      var cell = cellsToCheck[i];
      var decoration = mazeNodes.getDecoration(cell.x, cell.y);
      if (decoration) {
        foundDecoration = decoration;
        foundGridX = cell.x;
        foundGridY = cell.y;
        break;
      }
    }

    if (foundDecoration) {
      // Select the grid decoration
      selectedGridDecoration = {
        gridX: foundGridX,
        gridY: foundGridY,
        decoration: foundDecoration
      };
      showGridDecorationControls(true);
      positionGridDecorationControls(foundGridX, foundGridY);
    } else {
      // Clicked empty cell - deselect
      if (selectedGridDecoration) {
        selectedGridDecoration = null;
        showGridDecorationControls(false);
      }
    }
  }

  /**
   * Find the actual wall cell accounting for wall height
   * When clicking on the upper part of a wall, the floor-level calculation
   * returns the wrong cell. Only check immediate neighbors "in front".
   */
  /**
   * Handle free-form decoration placement (not grid-snapped)
   */
  function handleFreeFormPlacement(screenX, screenY, canvas) {
    if (!mazeNodes || !selectedDecorationTile) return;

    // Convert screen coordinates to logical coordinates (consistent with grid decorations)
    var displayScale = mazeNodes.displayScale || 1;
    var logicalX = screenX / displayScale;
    var logicalY = screenY / displayScale;

    // Get image dimensions for baseWidth/baseHeight
    var baseWidth = 64;
    var baseHeight = 64;
    if (previewImage) {
      baseWidth = previewImage.naturalWidth || previewImage.width || 64;
      baseHeight = previewImage.naturalHeight || previewImage.height || 64;
    }

    // Calculate scale: for built-in decorations with forced free-form mode,
    // use tile-based scale to match grid-snapped size
    var decorScale;
    if (forceFreeFormMode && !isCustomDecoration(selectedDecorationTile)) {
      // Match grid-snapped sizing: drawWidth = tileWidth, so scale = tileWidth / imgWidth
      var tileWidth = mazeNodes.wallSize || 10;
      decorScale = tileWidth / baseWidth;
    } else {
      // Custom decorations use the user-controlled placement scale
      decorScale = placementScale;
    }

    // Create the free-form decoration - store logical coordinates
    // Drawing will multiply by displayScale (consistent with grid decorations)
    var decoration = {
      tileUrl: selectedDecorationTile,
      layer: selectedLayer,
      logicalX: logicalX,
      logicalY: logicalY,
      scale: decorScale,
      baseWidth: baseWidth,
      baseHeight: baseHeight,
      clipBottomLeft: clipBottomLeft,
      clipBottomRight: clipBottomRight
    };

    // Ensure image is in the decoration images cache
    if (!mazeNodes.decorationImages[selectedDecorationTile] && previewImage) {
      mazeNodes.decorationImages[selectedDecorationTile] = previewImage;
    }

    var id = mazeNodes.addFreeFormDecoration(decoration);

    // Add to undo stack
    undoStack.push({
      type: 'freeform-add',
      id: id
    });
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();

    // Clear preview decoration (we just placed it)
    previewDecoration = null;

    // Exit placement mode after placing
    clearSelectedDecoration();

    // Redraw
    mazeNodes.draw();
  }

  /**
   * Get the current preview decoration data (for maze to render)
   */
  function getPreviewDecoration() {
    return previewDecoration;
  }

  /**
   * Handle mousedown for free-form decoration dragging
   */
  function handleCanvasMouseDown(e) {
    if (!mazeNodes) return;

    // If in clip adjust mode, click confirms (same as Enter)
    if (clipAdjustMode && selectedFreeForm) {
      var updates = {};
      if (clipAdjustMode === 'left' || clipAdjustMode === 'both') {
        updates.clipBottomLeft = true;
        updates.clipOffsetLeft = clipPreviewOffsetLeft;
        selectedFreeForm.decoration.clipBottomLeft = true;
        selectedFreeForm.decoration.clipOffsetLeft = clipPreviewOffsetLeft;
      }
      if (clipAdjustMode === 'right' || clipAdjustMode === 'both') {
        updates.clipBottomRight = true;
        updates.clipOffsetRight = clipPreviewOffsetRight;
        selectedFreeForm.decoration.clipBottomRight = true;
        selectedFreeForm.decoration.clipOffsetRight = clipPreviewOffsetRight;
      }
      if (clipAdjustMode === 'both') {
        updates.clipOffsetY = clipPreviewOffsetY;
        selectedFreeForm.decoration.clipOffsetY = clipPreviewOffsetY;
      }
      mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, updates);

      var btnLeft = document.getElementById("freeform-clip-left");
      var btnRight = document.getElementById("freeform-clip-right");
      var hint = document.getElementById("clip-adjust-hint");
      if (btnLeft) btnLeft.classList.remove("adjusting");
      if (btnRight) btnRight.classList.remove("adjusting");
      if (hint) hint.style.display = "none";
      clipAdjustMode = null;
      mazeNodes.draw();
      e.preventDefault();
      return;
    }

    var canvas = e.target;
    var rect = canvas.getBoundingClientRect();

    // Use CSS pixels (consistent with placement which stores screenX/displayScale as logical)
    var screenX = e.clientX - rect.left;
    var screenY = e.clientY - rect.top;
    var displayScale = mazeNodes.displayScale || 1;

    // Check if clicking on a free-form decoration
    var hit = mazeNodes.getFreeFormDecorationAt(screenX, screenY, displayScale);

    if (hit) {
      selectedFreeForm = hit;
      isDragging = true;
      dragStartX = screenX;
      dragStartY = screenY;

      // Get logical coordinates (support both old and new format)
      var decLogicalX = hit.decoration.logicalX !== undefined
        ? hit.decoration.logicalX
        : (hit.decoration.canvasX / displayScale);
      var decLogicalY = hit.decoration.logicalY !== undefined
        ? hit.decoration.logicalY
        : (hit.decoration.canvasY / displayScale);

      // Store starting position for undo (in logical coords)
      dragStartPos = { logicalX: decLogicalX, logicalY: decLogicalY };

      // Calculate offset in logical coordinates
      var clickLogicalX = screenX / displayScale;
      var clickLogicalY = screenY / displayScale;
      dragOffsetX = clickLogicalX - decLogicalX;
      dragOffsetY = clickLogicalY - decLogicalY;

      showFreeFormControls(true);
      e.preventDefault();
    } else {
      // Clicked elsewhere - deselect
      if (selectedFreeForm && !selectedDecorationTile) {
        cancelClipAdjustMode();
        selectedFreeForm = null;
        showFreeFormControls(false);
      }
    }
  }

  /**
   * Handle mouseup for free-form decoration dragging
   */
  function handleCanvasMouseUp(e) {
    if (isDragging && selectedFreeForm && dragStartPos && mazeNodes) {
      // Check if actually moved (using logical coords)
      var dec = mazeNodes.getFreeFormDecoration(selectedFreeForm.id);
      var displayScale = mazeNodes.displayScale || 1;
      var currentLogicalX = dec.logicalX !== undefined ? dec.logicalX : (dec.canvasX / displayScale);
      var currentLogicalY = dec.logicalY !== undefined ? dec.logicalY : (dec.canvasY / displayScale);

      if (dec && (currentLogicalX !== dragStartPos.logicalX || currentLogicalY !== dragStartPos.logicalY)) {
        // Add to undo stack (using logical coords)
        undoStack.push({
          type: 'freeform-move',
          id: selectedFreeForm.id,
          previousLogicalX: dragStartPos.logicalX,
          previousLogicalY: dragStartPos.logicalY
        });
        if (undoStack.length > MAX_UNDO_STACK) {
          undoStack.shift();
        }
        updateUndoButton();
      }
    }
    isDragging = false;
    dragStartPos = null;
  }

  /**
   * Show/hide free-form decoration controls and position below selected decoration
   */
  function showFreeFormControls(show) {
    var controls = document.getElementById('freeform-controls');
    if (controls) {
      controls.style.display = show ? 'block' : 'none';

      if (show && selectedFreeForm) {
        var scaleSlider = document.getElementById('freeform-scale');
        var scaleValue = document.getElementById('freeform-scale-value');
        if (scaleSlider && selectedFreeForm.decoration) {
          scaleSlider.value = selectedFreeForm.decoration.scale || 1;
          if (scaleValue) {
            scaleValue.textContent = (selectedFreeForm.decoration.scale || 1).toFixed(2) + 'x';
          }
        }

        // Sync clip toggle buttons to selected decoration's state
        var freeformClipLeftBtn = document.getElementById("freeform-clip-left");
        var freeformClipRightBtn = document.getElementById("freeform-clip-right");
        if (freeformClipLeftBtn && selectedFreeForm.decoration) {
          freeformClipLeftBtn.classList.toggle("active", !!selectedFreeForm.decoration.clipBottomLeft);
        }
        if (freeformClipRightBtn && selectedFreeForm.decoration) {
          freeformClipRightBtn.classList.toggle("active", !!selectedFreeForm.decoration.clipBottomRight);
        }

        // Position controls below the selected decoration
        positionFreeFormControls();
      }
    }
  }

  /**
   * Position free-form controls below the selected decoration
   */
  function positionFreeFormControls() {
    var controls = document.getElementById('freeform-controls');
    if (!controls || !selectedFreeForm || !mazeNodes) return;
    if (controls.style.display === 'none') return;

    var canvas = document.getElementById("maze");
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var displayScale = mazeNodes.displayScale || 1;
    var dec = selectedFreeForm.decoration;

    // Get decoration's logical coordinates (anchor is at bottom-center)
    var logicalX = dec.logicalX !== undefined ? dec.logicalX : 0;
    var logicalY = dec.logicalY !== undefined ? dec.logicalY : 0;

    // Convert to screen coordinates relative to canvas
    var screenX = logicalX * displayScale;
    var screenY = logicalY * displayScale;

    // For position: fixed, use viewport coordinates (rect already gives viewport coords)
    var fixedX = rect.left + screenX;
    var fixedY = rect.top + screenY + 10; // 10px below anchor

    // Get controls dimensions for boundary checking
    var controlsRect = controls.getBoundingClientRect();
    var controlsWidth = controlsRect.width;
    var controlsHeight = controlsRect.height;

    // Constrain to viewport (with some padding)
    var padding = 10;
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;

    // Since transform: translateX(-50%) centers the element, adjust X for that
    var minX = controlsWidth / 2 + padding;
    var maxX = viewportWidth - controlsWidth / 2 - padding;
    fixedX = Math.max(minX, Math.min(maxX, fixedX));

    // Constrain Y to keep controls visible
    var maxY = viewportHeight - controlsHeight - padding;
    if (fixedY > maxY) {
      // Position above the decoration instead
      fixedY = rect.top + screenY - controlsHeight - 10;
    }
    fixedY = Math.max(padding, fixedY);

    controls.style.left = fixedX + 'px';
    controls.style.top = fixedY + 'px';
  }

  /**
   * Show or hide grid decoration controls
   */
  function showGridDecorationControls(show) {
    var controls = document.getElementById('grid-decoration-controls');
    if (controls) {
      controls.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Position grid decoration controls below the selected cell
   */
  function positionGridDecorationControls(gridX, gridY) {
    var controls = document.getElementById('grid-decoration-controls');
    if (!controls || !mazeNodes) return;
    if (controls.style.display === 'none') return;

    var canvas = document.getElementById("maze");
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var displayScale = mazeNodes.displayScale || 1;
    var tileWidth = mazeNodes.wallSize;
    var tileHeight = mazeNodes.wallSize * mazeNodes.isoRatio;
    var matrixCols = mazeNodes.matrix[0].length;
    var offsetX = matrixCols * tileWidth * 0.5;
    var offsetY = tileHeight;

    // Convert grid to isometric coordinates (center of tile)
    var isoCoords = IsoGeometry.projectToIso(
      gridX + 0.5, gridY + 0.5,
      tileWidth, tileHeight,
      offsetX, offsetY
    );

    // Apply display scale to get screen coordinates
    var screenX = isoCoords.isoX * displayScale;
    var screenY = isoCoords.isoY * displayScale;

    // Position below the tile
    var fixedX = rect.left + screenX;
    var fixedY = rect.top + screenY + (tileHeight * displayScale * 0.5) + 10;

    // Get controls dimensions for boundary checking
    var controlsRect = controls.getBoundingClientRect();
    var controlsWidth = controlsRect.width || 80;
    var controlsHeight = controlsRect.height || 40;

    // Constrain to viewport
    var padding = 10;
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;

    var minX = controlsWidth / 2 + padding;
    var maxX = viewportWidth - controlsWidth / 2 - padding;
    fixedX = Math.max(minX, Math.min(maxX, fixedX));

    var maxY = viewportHeight - controlsHeight - padding;
    if (fixedY > maxY) {
      fixedY = rect.top + screenY - controlsHeight - 10;
    }
    fixedY = Math.max(padding, fixedY);

    controls.style.left = fixedX + 'px';
    controls.style.top = fixedY + 'px';
  }

  /**
   * Delete the selected grid decoration
   */
  function deleteSelectedGridDecoration() {
    if (!selectedGridDecoration || !mazeNodes) return;

    var gridX = selectedGridDecoration.gridX;
    var gridY = selectedGridDecoration.gridY;
    var key = gridX + "," + gridY;
    var existing = selectedGridDecoration.decoration;

    // Store previous state for undo
    var previousState = {
      tileUrl: existing.tileUrl,
      category: existing.category,
      layer: existing.layer,
    };

    // Remove the decoration
    mazeNodes.setDecoration(gridX, gridY, null);

    // Track in undo stack
    undoStack.push({ type: "decoration", key: key, previous: previousState });
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();

    // Clear selection
    selectedGridDecoration = null;
    showGridDecorationControls(false);

    // Reload and redraw
    mazeNodes.loadDecorations().then(function () {
      mazeNodes.draw();
      saveCanvasState();
    });
  }

  function findWallCellAtClick(gridX, gridY) {
    if (!mazeNodes || !mazeNodes.matrix) return null;

    var matrixCols = mazeNodes.matrix[0].length;
    var matrixRows = mazeNodes.matrix.length;

    // Only check immediate neighbors in front (isometric: +x and +y directions)
    // These are the cells whose walls could visually extend up to cover this position
    var neighbors = [
      { x: gridX + 1, y: gridY }, // right in isometric
      { x: gridX, y: gridY + 1 }, // down in isometric
      { x: gridX + 1, y: gridY + 1 }, // diagonal front
    ];

    for (var i = 0; i < neighbors.length; i++) {
      var cell = neighbors[i];
      if (
        cell.x >= 0 &&
        cell.x < matrixCols &&
        cell.y >= 0 &&
        cell.y < matrixRows
      ) {
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
    // For remove tool, try to find the actual wall cell if we clicked on its upper portion
    if (selectedWallTool === "remove" && currentPixel !== 1) {
      var wallCell = findWallCellAtClick(gridX, gridY);
      if (wallCell) {
        gridX = wallCell.gridX;
        gridY = wallCell.gridY;
        currentPixel = 1;
        key = gridX + "," + gridY;
      }
    }

    var isWall = currentPixel === 1;

    if (selectedWallTool === "add" && !isWall) {
      // Add wall - remove any decoration first
      var existingDecor = mazeNodes.getDecoration(gridX, gridY);
      if (existingDecor) {
        mazeNodes.setDecoration(gridX, gridY, null);
      }

      // Track for undo
      undoStack.push({
        type: "wall",
        key: key,
        previous: { isWall: false, decoration: existingDecor },
      });

      // Set wall in matrix
      setMatrixCell(gridY, gridX, "1");
    } else if (selectedWallTool === "remove" && isWall) {
      // Track for undo
      undoStack.push({
        type: "wall",
        key: key,
        previous: { isWall: true, decoration: null },
      });

      // Remove wall from matrix
      setMatrixCell(gridY, gridX, "0");
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
   * Handle floor clear/restore
   */
  function handleFloorEdit(gridX, gridY, currentPixel, key) {
    // Can only clear floor tiles (not walls)
    if (currentPixel !== 0) {
      return;
    }

    if (selectedFloorTool === "clear") {
      // Check if already blank
      var isBlank = mazeNodes.isFloorBlank && mazeNodes.isFloorBlank(gridX, gridY);

      // Track for undo
      undoStack.push({
        type: "floor",
        key: key,
        previous: { isBlank: isBlank },
      });

      if (isBlank) {
        // Toggle: restore the floor
        mazeNodes.setFloorBlank(gridX, gridY, false);
      } else {
        // Clear the floor (make it blank)
        mazeNodes.setFloorBlank(gridX, gridY, true);
      }

      if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift();
      }
      updateUndoButton();

      // Redraw
      mazeNodes.draw();
      saveCanvasState();
    }
  }

  /**
   * Handle decoration placement
   */
  function handleDecorationEdit(gridX, gridY, pixel, key) {
    // Can only place on floor
    if (pixel !== 0) {
      return;
    }

    var existing = mazeNodes.getDecoration(gridX, gridY);

    // Store previous state for undo
    var previousState = existing
      ? {
          tileUrl: existing.tileUrl,
          category: existing.category,
          layer: existing.layer,
        }
      : null;

    if (existing && existing.tileUrl === selectedDecorationTile) {
      // Same tile - remove it (toggle off)
      mazeNodes.setDecoration(gridX, gridY, null);
    } else {
      // Place new decoration with user-selected layer
      mazeNodes.setDecoration(
        gridX,
        gridY,
        selectedDecorationTile,
        "misc",
        selectedLayer,
      );
    }

    // Track in undo stack
    undoStack.push({ type: "decoration", key: key, previous: previousState });
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();

    // Reload decoration images and redraw
    mazeNodes.loadDecorations().then(function () {
      mazeNodes.draw();
      saveCanvasState();
    });
  }

  /**
   * Handle decoration eraser - remove decoration at grid position
   */
  function handleDecorationErase(gridX, gridY, pixel, key) {
    // Check clicked cell and cells "behind" it in isometric space
    // Decorations extend upward visually, so clicking on them may register
    // as a cell in front of where they're actually anchored
    var cellsToCheck = [
      { x: gridX, y: gridY },
      { x: gridX, y: gridY + 1 },      // directly behind
      { x: gridX - 1, y: gridY + 1 },  // behind-left
      { x: gridX + 1, y: gridY + 1 },  // behind-right
    ];

    var found = null;
    var foundKey = null;

    for (var i = 0; i < cellsToCheck.length; i++) {
      var cell = cellsToCheck[i];
      var cellPixel = mazeNodes.matrix[cell.y]
        ? parseInt(mazeNodes.matrix[cell.y].charAt(cell.x), 10)
        : 1;

      // Skip wall cells
      if (cellPixel !== 0) continue;

      var decoration = mazeNodes.getDecoration(cell.x, cell.y);
      if (decoration) {
        found = decoration;
        foundKey = cell.x + "," + cell.y;
        gridX = cell.x;
        gridY = cell.y;
        break;
      }
    }

    // Nothing to erase
    if (!found) {
      return;
    }

    var existing = found;
    key = foundKey;

    // Store previous state for undo
    var previousState = {
      tileUrl: existing.tileUrl,
      category: existing.category,
      layer: existing.layer,
    };

    // Remove the decoration
    mazeNodes.setDecoration(gridX, gridY, null);

    // Track in undo stack
    undoStack.push({ type: "decoration", key: key, previous: previousState });
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    updateUndoButton();

    // Reload decoration images and redraw
    mazeNodes.loadDecorations().then(function () {
      mazeNodes.draw();
      saveCanvasState();
    });
  }

  /**
   * Set a cell in the maze matrix
   */
  function setMatrixCell(row, col, value) {
    if (!mazeNodes.matrix[row]) {
      return;
    }
    var rowStr = mazeNodes.matrix[row];
    mazeNodes.matrix[row] =
      rowStr.substring(0, col) + value + rowStr.substring(col + 1);
  }

  /**
   * Undo the last placement (decoration or wall)
   */
  function undoLastPlacement() {
    if (undoStack.length === 0) return;
    if (typeof mazeNodes === "undefined") return;

    var lastAction = undoStack.pop();

    // Handle free-form undo operations
    if (lastAction.type === "freeform-add") {
      mazeNodes.removeFreeFormDecoration(lastAction.id);
      if (selectedFreeForm && selectedFreeForm.id === lastAction.id) {
        selectedFreeForm = null;
        showFreeFormControls(false);
      }
      updateUndoButton();
      mazeNodes.draw();
      return;
    }

    if (lastAction.type === "freeform-move") {
      // Support both old (canvasX/Y) and new (logicalX/Y) undo formats
      var updates = {};
      if (lastAction.previousLogicalX !== undefined) {
        updates.logicalX = lastAction.previousLogicalX;
        updates.logicalY = lastAction.previousLogicalY;
      } else {
        updates.canvasX = lastAction.previousCanvasX;
        updates.canvasY = lastAction.previousCanvasY;
      }
      mazeNodes.updateFreeFormDecoration(lastAction.id, updates);
      updateUndoButton();
      mazeNodes.draw();
      return;
    }

    if (lastAction.type === "freeform-delete") {
      // Restore the deleted decoration
      mazeNodes.freeFormDecorations[lastAction.id] = lastAction.decoration;
      updateUndoButton();
      mazeNodes.loadDecorations().then(function () {
        mazeNodes.draw();
      });
      return;
    }

    if (lastAction.type === "freeform-scale") {
      mazeNodes.updateFreeFormDecoration(lastAction.id, {
        scale: lastAction.previousScale
      });
      if (selectedFreeForm && selectedFreeForm.id === lastAction.id) {
        showFreeFormControls(true);
      }
      updateUndoButton();
      mazeNodes.draw();
      return;
    }

    // Handle grid-based undo operations
    var coords = lastAction.key.split(",").map(Number);
    var gridX = coords[0];
    var gridY = coords[1];

    if (lastAction.type === "wall") {
      // Undo wall change
      if (lastAction.previous.isWall) {
        setMatrixCell(gridY, gridX, "1");
      } else {
        setMatrixCell(gridY, gridX, "0");
        // Restore decoration if there was one
        if (lastAction.previous.decoration) {
          var d = lastAction.previous.decoration;
          mazeNodes.setDecoration(gridX, gridY, d.tileUrl, d.category, d.layer);
        }
      }
    } else if (lastAction.type === "floor") {
      // Undo floor blank/restore
      if (lastAction.previous.isBlank) {
        mazeNodes.setFloorBlank(gridX, gridY, true);
      } else {
        mazeNodes.setFloorBlank(gridX, gridY, false);
      }
    } else {
      // Undo decoration change
      if (lastAction.previous) {
        mazeNodes.setDecoration(
          gridX,
          gridY,
          lastAction.previous.tileUrl,
          lastAction.previous.category,
          lastAction.previous.layer,
        );
      } else {
        mazeNodes.setDecoration(gridX, gridY, null);
      }
    }

    updateUndoButton();

    mazeNodes.loadDecorations().then(function () {
      mazeNodes.draw();
      saveCanvasState(); // Save for preview overlay
    });
  }

  /**
   * Update undo button state
   */
  function updateUndoButton() {
    var btn = document.getElementById("undo-decoration");
    if (btn) {
      btn.disabled = undoStack.length === 0;
      btn.textContent =
        "Undo" + (undoStack.length > 0 ? " (" + undoStack.length + ")" : "");
    }
  }

  /**
   * Set the currently selected decoration tile
   */
  function setSelectedDecoration(tileUrl) {
    selectedDecorationTile = tileUrl;
    // Clear other tools when decoration is selected
    selectedWallTool = null;
    selectedFloorTool = null;
    decorationEraserMode = false;
    selectedGridDecoration = null;
    showGridDecorationControls(false);
    // Use free-form mode if forced by user toggle, otherwise default to grid snap
    // (decoration-library will override to true for custom decorations)
    freeFormMode = forceFreeFormMode;
    selectedFreeForm = null;
    updateToolSelection();
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
    freeFormHoverPos = null;
    freeFormMode = false;
    previewDecoration = null;

    // Cancel any active clip adjustment
    cancelClipAdjustMode();

    // Reset clipping state for placement mode
    clipBottomLeft = false;
    clipBottomRight = false;
    var clipLeftBtn = document.getElementById("clip-bottom-left");
    var clipRightBtn = document.getElementById("clip-bottom-right");
    if (clipLeftBtn) clipLeftBtn.classList.remove("active");
    if (clipRightBtn) clipRightBtn.classList.remove("active");

    clearPreview();
    showFloatingPreview(false);
    updatePaletteSelection();
    updateCursor();
    // Restore cursor
    var mazeCanvas = document.getElementById("maze");
    if (mazeCanvas) {
      mazeCanvas.classList.remove("freeform-placement-mode");
    }
  }

  /**
   * Set free-form mode (for custom decorations that don't snap to grid)
   */
  function setFreeFormMode(enabled) {
    freeFormMode = enabled;
    var mazeCanvas = document.getElementById("maze");

    if (enabled) {
      // Show placement scale control when entering free-form mode
      showFloatingPreview(false); // We use canvas preview now
      if (placementScaleControl) {
        placementScaleControl.style.display = "flex";
      }
      // Hide cursor on maze canvas
      if (mazeCanvas) {
        mazeCanvas.classList.add("freeform-placement-mode");
      }
    } else {
      selectedFreeForm = null;
      showFreeFormControls(false);
      showFloatingPreview(false);
      // Show cursor again
      if (mazeCanvas) {
        mazeCanvas.classList.remove("freeform-placement-mode");
      }
    }
  }

  /**
   * Get current free-form mode state
   */
  function getFreeFormMode() {
    return freeFormMode;
  }

  /**
   * Delete the currently selected free-form decoration
   */
  function deleteSelectedFreeForm() {
    if (!selectedFreeForm || !mazeNodes) return;

    var decoration = mazeNodes.getFreeFormDecoration(selectedFreeForm.id);
    if (decoration) {
      // Add to undo stack
      undoStack.push({
        type: 'freeform-delete',
        id: selectedFreeForm.id,
        decoration: JSON.parse(JSON.stringify(decoration))
      });
      if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift();
      }
      updateUndoButton();

      mazeNodes.removeFreeFormDecoration(selectedFreeForm.id);
      selectedFreeForm = null;
      showFreeFormControls(false);
      mazeNodes.draw();
    }
  }

  /**
   * Scale the currently selected free-form decoration
   */
  function scaleFreeForm(newScale) {
    if (!selectedFreeForm || !mazeNodes) return;

    var decoration = mazeNodes.getFreeFormDecoration(selectedFreeForm.id);
    if (decoration) {
      var previousScale = decoration.scale || 1;

      // Add to undo stack
      undoStack.push({
        type: 'freeform-scale',
        id: selectedFreeForm.id,
        previousScale: previousScale
      });
      if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift();
      }
      updateUndoButton();

      mazeNodes.updateFreeFormDecoration(selectedFreeForm.id, { scale: newScale });
      mazeNodes.draw();
    }
  }

  /**
   * Bring selected free-form decoration to front
   */
  function bringFreeFormToFront() {
    if (!selectedFreeForm || !mazeNodes) return;
    mazeNodes.bringFreeFormToFront(selectedFreeForm.id);
    mazeNodes.draw();
  }

  /**
   * Send selected free-form decoration to back
   */
  function sendFreeFormToBack() {
    if (!selectedFreeForm || !mazeNodes) return;
    mazeNodes.sendFreeFormToBack(selectedFreeForm.id);
    mazeNodes.draw();
  }

  /**
   * Set the selected wall tool
   * @param {string|null} tool - 'add', 'remove', or null to deselect
   */
  function setSelectedWallTool(tool) {
    selectedWallTool = tool;
    // Clear other tools when wall tool is selected
    if (tool) {
      selectedFloorTool = null;
      selectedDecorationTile = null;
      decorationEraserMode = false;
      selectedGridDecoration = null;
      showGridDecorationControls(false);
      previewImage = null;
      previewImageUrl = null;
      hoveredCell = null;
      clearPreview();
      updatePaletteSelection();
    }
    updateToolSelection();
    updateCursor();
  }

  /**
   * Clear the selected wall tool
   */
  function clearSelectedWallTool() {
    selectedWallTool = null;
    updateToolSelection();
    updateCursor();
  }

  /**
   * Set the selected floor tool
   * @param {string|null} tool - 'clear' or null to deselect
   */
  function setSelectedFloorTool(tool) {
    selectedFloorTool = tool;
    // Clear other tools when floor tool is selected
    if (tool) {
      selectedWallTool = null;
      selectedDecorationTile = null;
      decorationEraserMode = false;
      selectedGridDecoration = null;
      showGridDecorationControls(false);
      previewImage = null;
      previewImageUrl = null;
      hoveredCell = null;
      clearPreview();
      updatePaletteSelection();
    }
    updateToolSelection();
    updateCursor();
  }

  /**
   * Clear the selected floor tool
   */
  function clearSelectedFloorTool() {
    selectedFloorTool = null;
    updateToolSelection();
    updateCursor();
  }

  /**
   * Set decoration eraser mode
   * @param {boolean} enabled - Whether eraser mode is active
   */
  function setDecorationEraserMode(enabled) {
    decorationEraserMode = enabled;
    // Clear other tools when eraser is enabled
    if (enabled) {
      selectedWallTool = null;
      selectedFloorTool = null;
      selectedDecorationTile = null;
      selectedGridDecoration = null;
      showGridDecorationControls(false);
      previewImage = null;
      previewImageUrl = null;
      hoveredCell = null;
      clearPreview();
      updatePaletteSelection();
    }
    updateToolSelection();
    updateCursor();
  }

  /**
   * Clear decoration eraser mode
   */
  function clearDecorationEraserMode() {
    decorationEraserMode = false;
    updateToolSelection();
    updateCursor();
  }

  /**
   * Update tool button selection state (wall and floor tools)
   */
  function updateToolSelection() {
    var addBtn = document.getElementById("wall-tool-add");
    var removeBtn = document.getElementById("wall-tool-remove");
    var clearFloorBtn = document.getElementById("floor-tool-clear");
    var decorationEraserBtn = document.getElementById("decoration-eraser");
    if (addBtn) addBtn.classList.toggle("selected", selectedWallTool === "add");
    if (removeBtn)
      removeBtn.classList.toggle("selected", selectedWallTool === "remove");
    if (clearFloorBtn)
      clearFloorBtn.classList.toggle("selected", selectedFloorTool === "clear");
    if (decorationEraserBtn)
      decorationEraserBtn.classList.toggle("selected", decorationEraserMode);
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
    var canvas = document.getElementById("maze");
    if (!canvas) return;

    if (selectedDecorationTile) {
      canvas.style.cursor = "crosshair";
    } else if (selectedWallTool === "add") {
      canvas.style.cursor = "cell";
    } else if (selectedWallTool === "remove") {
      canvas.style.cursor = "not-allowed";
    } else if (selectedFloorTool === "clear") {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "default";
    }
  }

  /**
   * Update visual selection state in palette
   */
  function updatePaletteSelection() {
    // Update built-in palette items
    var items = document.querySelectorAll(".palette-item");
    items.forEach(function (item) {
      var isSelected = item.dataset.tile === selectedDecorationTile;
      item.classList.toggle("selected", isSelected);
    });

    // Also update custom decoration items
    var customItems = document.querySelectorAll(".custom-decoration-item");
    customItems.forEach(function (item) {
      item.classList.remove("selected");
    });
  }

  /**
   * Set the selected layer
   */
  function setSelectedLayer(layer) {
    selectedLayer = layer;
    localStorage.setItem("decorationLayer", layer);
    updateLayerToggle();
  }

  /**
   * Update layer toggle UI to reflect current selection
   */
  function updateLayerToggle() {
    var floorRadio = document.getElementById("layer-floor");
    var overlayRadio = document.getElementById("layer-overlay");
    if (floorRadio) floorRadio.checked = selectedLayer === "floor";
    if (overlayRadio) overlayRadio.checked = selectedLayer === "overlay";
  }

  /**
   * Initialize the decoration palette UI
   */
  function initDecorationPalette() {
    Object.entries(DECORATION_CATEGORIES).forEach(function (entry) {
      var category = entry[0];
      var categoryData = entry[1];
      var tiles = categoryData.tiles;
      var categoryLayer = categoryData.layer;

      var container = document.querySelector(
        '.palette-category[data-category="' + category + '"] .palette-items',
      );
      if (!container) return;

      tiles.forEach(function (tileUrl) {
        // Map tile to its default layer (for reference only)
        tileLayerMap[tileUrl] = categoryLayer;

        var item = document.createElement("div");
        item.className = "palette-item";
        item.dataset.tile = tileUrl;
        item.dataset.layer = categoryLayer;
        item.title = tileUrl.split("/").pop();

        var img = document.createElement("img");
        img.src = tileUrl;
        img.alt = tileUrl.split("/").pop();
        item.appendChild(img);

        item.addEventListener("click", function () {
          // Toggle behavior: if same tile is selected, deselect it
          if (selectedDecorationTile === tileUrl) {
            clearSelectedDecoration();
          } else {
            setSelectedDecoration(tileUrl);
          }
          // Don't automatically change layer - user controls it with the toggle
        });

        container.appendChild(item);
      });
    });

    // Layer toggle radio buttons
    var floorRadio = document.getElementById("layer-floor");
    var overlayRadio = document.getElementById("layer-overlay");
    if (floorRadio) {
      floorRadio.addEventListener("change", function () {
        if (this.checked) setSelectedLayer("floor");
      });
    }
    if (overlayRadio) {
      overlayRadio.addEventListener("change", function () {
        if (this.checked) setSelectedLayer("overlay");
      });
    }
    // Initialize radio buttons to match loaded preference
    updateLayerToggle();

    // Free placement toggle checkbox
    var freePlacementToggle = document.getElementById("free-placement-toggle");
    if (freePlacementToggle) {
      freePlacementToggle.checked = forceFreeFormMode;
      freePlacementToggle.addEventListener("change", function () {
        forceFreeFormMode = this.checked;
        localStorage.setItem("forceFreeFormMode", forceFreeFormMode);
        // Update current mode if a decoration is selected
        if (selectedDecorationTile) {
          freeFormMode = forceFreeFormMode;
        }
      });
    }

    // Clear all decorations button
    var clearBtn = document.getElementById("clear-decorations");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (typeof mazeNodes !== "undefined" && mazeNodes.clearDecorations) {
          mazeNodes.clearDecorations();
          undoStack = []; // Clear undo stack
          updateUndoButton();
          mazeNodes.draw();
        }
      });
    }

    // Undo button
    var undoBtn = document.getElementById("undo-decoration");
    if (undoBtn) {
      undoBtn.addEventListener("click", undoLastPlacement);
      updateUndoButton();
    }

    // Deselect tool button
    var deselectBtn = document.getElementById("deselect-tool");
    if (deselectBtn) {
      deselectBtn.addEventListener("click", function () {
        clearSelectedDecoration();
        clearSelectedWallTool();
        clearSelectedFloorTool();
      });
    }

    // Wall tool buttons
    var wallAddBtn = document.getElementById("wall-tool-add");
    var wallRemoveBtn = document.getElementById("wall-tool-remove");
    if (wallAddBtn) {
      wallAddBtn.addEventListener("click", function () {
        if (selectedWallTool === "add") {
          clearSelectedWallTool();
        } else {
          setSelectedWallTool("add");
        }
      });
    }
    if (wallRemoveBtn) {
      wallRemoveBtn.addEventListener("click", function () {
        if (selectedWallTool === "remove") {
          clearSelectedWallTool();
        } else {
          setSelectedWallTool("remove");
        }
      });
    }

    // Floor tool button
    var floorClearBtn = document.getElementById("floor-tool-clear");
    if (floorClearBtn) {
      floorClearBtn.addEventListener("click", function () {
        if (selectedFloorTool === "clear") {
          clearSelectedFloorTool();
        } else {
          setSelectedFloorTool("clear");
        }
      });
    }

    // Decoration eraser button
    var decorationEraserBtn = document.getElementById("decoration-eraser");
    if (decorationEraserBtn) {
      decorationEraserBtn.addEventListener("click", function () {
        if (decorationEraserMode) {
          clearDecorationEraserMode();
        } else {
          setDecorationEraserMode(true);
        }
      });
    }
  }

  /**
   * Initialize export/import functionality
   */
  function initExportImport() {
    var exportBtn = document.getElementById("export-decorations");
    var importBtn = document.getElementById("import-decorations");

    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (typeof mazeNodes === "undefined" || !mazeNodes.exportMaze) {
          alert("No maze generated yet");
          return;
        }

        var json = mazeNodes.exportMaze();
        var decorationCount = Object.keys(mazeNodes.decorations || {}).length;
        var blankCount = Object.keys(mazeNodes.blankFloorTiles || {}).length;
        var rows = (mazeNodes.matrix || []).length;

        // Copy to clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(json).then(function () {
            alert(
              "Maze exported to clipboard!\n" +
                rows + " rows, " +
                decorationCount + " decoration(s), " +
                blankCount + " cleared floor(s)"
            );
          });
        } else {
          // Fallback for older browsers
          prompt("Copy this JSON:", json);
        }
      });
    }

    if (importBtn) {
      importBtn.addEventListener("click", function () {
        if (typeof mazeNodes === "undefined" || !mazeNodes.importMaze) {
          alert("No maze generated yet");
          return;
        }

        var json = prompt("Paste maze JSON:");
        if (!json) return;

        if (mazeNodes.importMaze(json)) {
          mazeNodes.loadDecorations().then(function () {
            mazeNodes.draw();
            saveCanvasState();
            var decorationCount = Object.keys(mazeNodes.decorations || {}).length;
            var rows = (mazeNodes.matrix || []).length;
            alert(
              "Maze imported!\n" +
                rows + " rows, " +
                decorationCount + " decoration(s)"
            );
          });
        } else {
          alert("Failed to parse JSON. Please check the format.");
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
    getSelectedLayer: function () {
      return selectedLayer;
    },
    setSelectedWallTool: setSelectedWallTool,
    clearSelectedWallTool: clearSelectedWallTool,
    getSelectedWallTool: function () {
      return selectedWallTool;
    },
    setSelectedFloorTool: setSelectedFloorTool,
    clearSelectedFloorTool: clearSelectedFloorTool,
    getSelectedFloorTool: function () {
      return selectedFloorTool;
    },
    setDecorationEraserMode: setDecorationEraserMode,
    clearDecorationEraserMode: clearDecorationEraserMode,
    getDecorationEraserMode: function () {
      return decorationEraserMode;
    },
    undo: undoLastPlacement,
    getUndoCount: function () {
      return undoStack.length;
    },
    saveCanvasState: saveCanvasState,
    DECORATION_CATEGORIES: DECORATION_CATEGORIES,
    // Free-form decoration functions
    setFreeFormMode: setFreeFormMode,
    getFreeFormMode: getFreeFormMode,
    deleteSelectedFreeForm: deleteSelectedFreeForm,
    scaleFreeForm: scaleFreeForm,
    bringFreeFormToFront: bringFreeFormToFront,
    sendFreeFormToBack: sendFreeFormToBack,
    // Grid decoration selection
    deleteSelectedGridDecoration: deleteSelectedGridDecoration,
    // Preview decoration (for maze to render during draw cycle)
    getPreviewDecoration: getPreviewDecoration,
    // Clip preview state (for maze to render preview line)
    getClipPreview: function () {
      if (!clipAdjustMode || !selectedFreeForm) return null;
      return {
        mode: clipAdjustMode,
        offsetLeft: clipPreviewOffsetLeft,
        offsetRight: clipPreviewOffsetRight,
        offsetY: clipPreviewOffsetY,
        decoration: selectedFreeForm.decoration
      };
    },
  };
})(typeof self !== "undefined" ? self : this);
