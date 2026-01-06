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

  // Export module
  root.DecorationLibrary = {
    init: initLibraryUI,
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
  };
})(typeof window !== "undefined" ? window : this);
