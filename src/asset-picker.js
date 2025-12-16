// Asset list for tile picker
const TILE_ASSETS = [
  'src/assets/isobricks.png',
  'src/assets/isobricks2.png',
  'src/assets/isobricks3.png',
  'src/assets/isobricks4.png',
  'src/assets/isobrickswall.png',
  'src/assets/isobrickswall2.png',
  'src/assets/isobrickswall3.png',
  'src/assets/isobrickswall4.png',
  'src/assets/isocube.png',
  'src/assets/Isowoodtexture.png',
  'src/assets/Isowoodtexture2.png',
  'src/assets/isorock.png',
  'src/assets/isorock2.png',
  'src/assets/IsoPillar.png',
  'src/assets/IsoPillar2.png',
  'src/assets/isosquare-pillar1.png',
  'src/assets/ISOARCH.png',
  'src/assets/ISOARCH2.png',
  'src/assets/ISOARCHporticullis.png',
  'src/assets/isoDoorWood1.png',
  'src/assets/isoDoorWood2.png',
  'src/assets/isowindow.png',
  'src/assets/isowindow2.png',
  'src/assets/isostair.png',
  'src/assets/isostair2.png',
  'src/assets/isostair3.png',
  'src/assets/isostair4.png',
  'src/assets/isoslope.png',
  'src/assets/isoslope2.png',
  'src/assets/isoslopeback.png',
  'src/assets/isoslopeback2.png',
  'src/assets/isoladder.png',
  'src/assets/isoladder2.png',
  'src/assets/Iso-Pit.png',
  'src/assets/isotree.png',
  'src/assets/isobush.png',
  'src/assets/isowalltorch.png',
  'src/assets/isowalltorch2.png',
  'src/assets/isocandle.png',
  'src/assets/isocandlelit.png',
  'src/assets/isobanner.png',
  'src/assets/isobanner2.png',
  'src/assets/IsoTableRound.png',
  'src/assets/IsoTableSquare.png',
  'src/assets/IsoChair1.png',
  'src/assets/IsoChair2.png',
  'src/assets/IsoChair3.png',
  'src/assets/IsoChair4.png',
  'src/assets/isobed.png',
  'src/assets/isobed2.png',
  'src/assets/isobed3.png',
  'src/assets/isobed4.png',
  'src/assets/isobookcase.png',
  'src/assets/isobookcase2.png',
  'src/assets/isobookcase-back.png',
  'src/assets/isobookcase-back2.png',
  'src/assets/isoempty-bookcase.png',
  'src/assets/isoempty-bookcase2.png',
  'src/assets/isobook.png',
  'src/assets/IsoBarrel.png',
  'src/assets/isoChest.png',
  'src/assets/isoChest2.png',
  'src/assets/isocrate.png',
  'src/assets/isogold.png',
  'src/assets/isoRug.png',
  'src/assets/isoRug2.png',
  'src/assets/isobones.png',
  'src/assets/isobones2.png',
  'src/assets/isolever.png',
  'src/assets/isolever2.png',
];

function initAssetPickers() {
  const pickers = document.querySelectorAll('.asset-picker');

  pickers.forEach(picker => {
    const input = picker.querySelector('input[type="text"]');
    const toggle = picker.querySelector('.picker-toggle');
    const grid = picker.querySelector('.asset-grid');
    const preview = picker.querySelector('.selected-preview');

    // Populate grid with assets
    TILE_ASSETS.forEach(asset => {
      const item = document.createElement('div');
      item.className = 'asset-item';
      item.innerHTML = `<img src="${asset}" alt="${asset.split('/').pop()}" title="${asset.split('/').pop()}">`;
      item.addEventListener('click', () => {
        input.value = asset;
        updatePreview(preview, asset);
        grid.classList.remove('show');
        refreshMazeTileset(); // Live update
      });
      grid.appendChild(item);
    });

    // Toggle grid visibility
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      grid.classList.toggle('show');
    });

    // Update preview on input change
    input.addEventListener('input', () => {
      updatePreview(preview, input.value);
    });

    // Live update on blur (after typing a URL)
    input.addEventListener('change', () => {
      refreshMazeTileset();
    });

    // Close grid when clicking outside
    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) {
        grid.classList.remove('show');
      }
    });

    // Add clear button functionality
    const clearBtn = picker.querySelector('.clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        input.value = '';
        updatePreview(preview, '');
        refreshMazeTileset(); // Live update
      });
    }
  });
}

function updatePreview(previewEl, src) {
  if (src && src.trim()) {
    previewEl.innerHTML = `<img src="${src}" alt="Preview">`;
    previewEl.classList.add('has-image');
  } else {
    previewEl.innerHTML = '';
    previewEl.classList.remove('has-image');
  }
}

// Refresh the maze display with new tileset without regenerating paths
function refreshMazeTileset() {
  if (typeof mazeNodes === 'undefined' || !mazeNodes.matrix || !mazeNodes.matrix.length) {
    return; // No maze generated yet
  }

  // Build tileset from current input values
  const tileWallLeft = document.getElementById('tile-wall-left');
  const tileWallRight = document.getElementById('tile-wall-right');
  const tilePathway = document.getElementById('tile-pathway');
  const tileStart = document.getElementById('tile-start');
  const tileEnd = document.getElementById('tile-end');
  const showStrokeCheckbox = document.getElementById('show-stroke');

  const wallLeftUrl = tileWallLeft ? tileWallLeft.value.trim() : '';
  const wallRightUrl = tileWallRight ? tileWallRight.value.trim() : '';
  const pathwayUrl = tilePathway ? tilePathway.value.trim() : '';
  const startUrl = tileStart ? tileStart.value.trim() : '';
  const endUrl = tileEnd ? tileEnd.value.trim() : '';

  // Update tileset on existing maze
  let tileset = null;
  if (wallLeftUrl || wallRightUrl || pathwayUrl || startUrl || endUrl) {
    tileset = {};
    if (wallLeftUrl) tileset.wallLeft = wallLeftUrl;
    if (wallRightUrl) tileset.wallRight = wallRightUrl;
    if (pathwayUrl) tileset.pathway = pathwayUrl;
    if (startUrl) tileset.start = startUrl;
    if (endUrl) tileset.end = endUrl;
  }

  const wallHeightInput = document.getElementById('wall-height');
  const strokeWidthInput = document.getElementById('stroke-width');
  const wallBgColorInput = document.getElementById('wall-bg-color');
  const strokeTopCheckbox = document.getElementById('stroke-top');
  const strokeBottomCheckbox = document.getElementById('stroke-bottom');
  const strokeCornersCheckbox = document.getElementById('stroke-corners');
  const strokeWallCornersCheckbox = document.getElementById('stroke-wall-corners');
  const debugStrokeColorsCheckbox = document.getElementById('debug-stroke-colors');
  const debugTestPatternCheckbox = document.getElementById('debug-test-pattern');

  mazeNodes.tileset = tileset;
  mazeNodes.tileImages = {}; // Clear cached images
  mazeNodes.showStroke = showStrokeCheckbox ? showStrokeCheckbox.checked : true;
  mazeNodes.strokeTop = strokeTopCheckbox ? strokeTopCheckbox.checked : true;
  mazeNodes.strokeBottom = strokeBottomCheckbox ? strokeBottomCheckbox.checked : true;
  mazeNodes.strokeCorners = strokeCornersCheckbox ? strokeCornersCheckbox.checked : true;
  mazeNodes.strokeWallCorners = strokeWallCornersCheckbox ? strokeWallCornersCheckbox.checked : false;
  mazeNodes.debugStrokeColors = debugStrokeColorsCheckbox ? debugStrokeColorsCheckbox.checked : false;
  mazeNodes.debugTestPattern = debugTestPatternCheckbox ? debugTestPatternCheckbox.checked : false;
  mazeNodes.wallHeight = wallHeightInput ? parseFloat(wallHeightInput.value) || 1.0 : 1.0;
  mazeNodes.strokeWidth = strokeWidthInput ? parseFloat(strokeWidthInput.value) || 2 : 2;
  mazeNodes.wallBgColor = wallBgColorInput ? wallBgColorInput.value.trim() : '';

  // Reload tileset and redraw
  mazeNodes.loadTileset().then(function() {
    mazeNodes.draw();
  });
}

// Initialize stroke toggle listeners
function initStrokeToggle() {
  const strokeCheckboxes = [
    'show-stroke',
    'stroke-top',
    'stroke-bottom',
    'stroke-corners',
    'stroke-wall-corners',
    'debug-stroke-colors'
  ];
  strokeCheckboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', refreshMazeTileset);
    }
  });
}

// Initialize wall background color listener
function initWallBgColor() {
  const wallBgColorInput = document.getElementById('wall-bg-color');
  if (wallBgColorInput) {
    wallBgColorInput.addEventListener('change', function() {
      // Update color sample preview
      const colorSample = wallBgColorInput.parentNode.querySelector('.color-sample');
      if (colorSample) {
        colorSample.style.backgroundColor = wallBgColorInput.value.trim() || 'transparent';
      }
      refreshMazeTileset();
    });
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
  initAssetPickers();
  initStrokeToggle();
  initWallBgColor();
});
