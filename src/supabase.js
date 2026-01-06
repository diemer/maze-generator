/**
 * Supabase client initialization and helper functions
 */
(function (root) {
  "use strict";

  // Supabase configuration
  var SUPABASE_URL = "https://ohkvzvgfngybebiwgbjy.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oa3Z6dmdmbmd5YmViaXdnYmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MjA0NzIsImV4cCI6MjA1NDA5NjQ3Mn0.m9wiqvReUzfwJA4gBVd-qXyMa_72K6kNgYh0uvTf0oE";

  var supabase = null;

  /**
   * Initialize the Supabase client
   * Must be called after the Supabase CDN script is loaded
   */
  function initSupabase() {
    if (typeof root.supabase === "undefined") {
      console.error("Supabase CDN not loaded");
      return null;
    }
    supabase = root.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }

  /**
   * Get the Supabase client instance
   */
  function getClient() {
    if (!supabase) {
      return initSupabase();
    }
    return supabase;
  }

  // ============================================
  // Authentication Functions
  // ============================================

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function signIn(email, password) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.auth.signInWithPassword({
      email: email,
      password: password,
    });
  }

  /**
   * Sign out the current user
   * @returns {Promise<{error: Object}>}
   */
  async function signOut() {
    var client = getClient();
    if (!client) return { error: { message: "Supabase not initialized" } };

    return await client.auth.signOut();
  }

  /**
   * Get the current session
   * @returns {Promise<{data: {session: Object}, error: Object}>}
   */
  async function getSession() {
    var client = getClient();
    if (!client) return { data: { session: null }, error: { message: "Supabase not initialized" } };

    return await client.auth.getSession();
  }

  /**
   * Get the current user
   * @returns {Promise<{data: {user: Object}, error: Object}>}
   */
  async function getUser() {
    var client = getClient();
    if (!client) return { data: { user: null }, error: { message: "Supabase not initialized" } };

    return await client.auth.getUser();
  }

  /**
   * Subscribe to auth state changes
   * @param {Function} callback - Called with (event, session) on auth changes
   * @returns {Object} - Subscription object with unsubscribe method
   */
  function onAuthStateChange(callback) {
    var client = getClient();
    if (!client) return { data: { subscription: { unsubscribe: function() {} } } };

    return client.auth.onAuthStateChange(callback);
  }

  // ============================================
  // Border Functions
  // ============================================

  /**
   * Upload a border image to Supabase storage
   * @param {File|Blob} file - The image file to upload
   * @param {string} name - Display name for the border
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function uploadBorder(file, name) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Generate unique filename
    var ext = file.name ? file.name.split(".").pop() : "png";
    var filename = "border_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9) + "." + ext;

    // Upload to storage
    var uploadResult = await client.storage.from("maze-borders").upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadResult.error) {
      return { data: null, error: uploadResult.error };
    }

    // Get public URL
    var urlResult = client.storage.from("maze-borders").getPublicUrl(filename);
    var publicUrl = urlResult.data.publicUrl;

    // Get image dimensions
    var dimensions = await getImageDimensions(file);

    // Insert record into borders table
    var insertResult = await client.from("maze_borders").insert({
      name: name || filename,
      image_url: publicUrl,
      width: dimensions.width,
      height: dimensions.height,
    }).select().single();

    if (insertResult.error) {
      // Clean up uploaded file if db insert fails
      await client.storage.from("maze-borders").remove([filename]);
      return { data: null, error: insertResult.error };
    }

    return { data: insertResult.data, error: null };
  }

  /**
   * Get all borders
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function getBorders() {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.from("maze_borders").select("*").order("created_at", { ascending: false });
  }

  /**
   * Delete a border by ID
   * @param {string} id - Border UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function deleteBorder(id) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Get border to find the storage path
    var borderResult = await client.from("maze_borders").select("image_url").eq("id", id).single();
    if (borderResult.error) {
      return { data: null, error: borderResult.error };
    }

    // Extract filename from URL
    var url = borderResult.data.image_url;
    var filename = url.split("/").pop();

    // Delete from storage
    await client.storage.from("maze-borders").remove([filename]);

    // Delete from database
    return await client.from("maze_borders").delete().eq("id", id);
  }

  // ============================================
  // Decoration Functions
  // ============================================

  /**
   * Upload a custom decoration image to Supabase storage
   * @param {File|Blob} file - The image file to upload
   * @param {string} name - Display name for the decoration
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function uploadDecoration(file, name) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Generate unique filename
    var ext = file.name ? file.name.split(".").pop() : "png";
    var filename = "decoration_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9) + "." + ext;

    // Upload to storage
    var uploadResult = await client.storage.from("maze-decorations").upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadResult.error) {
      return { data: null, error: uploadResult.error };
    }

    // Get public URL
    var urlResult = client.storage.from("maze-decorations").getPublicUrl(filename);
    var publicUrl = urlResult.data.publicUrl;

    // Get image dimensions
    var dimensions = await getImageDimensions(file);

    // Insert record into decorations table
    var insertResult = await client.from("maze_decorations").insert({
      name: name || filename,
      image_url: publicUrl,
      width: dimensions.width,
      height: dimensions.height,
    }).select().single();

    if (insertResult.error) {
      // Clean up uploaded file if db insert fails
      await client.storage.from("maze-decorations").remove([filename]);
      return { data: null, error: insertResult.error };
    }

    return { data: insertResult.data, error: null };
  }

  /**
   * Get all decorations
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function getDecorations() {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.from("maze_decorations").select("*").order("created_at", { ascending: false });
  }

  /**
   * Delete a decoration by ID
   * @param {string} id - Decoration UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function deleteDecoration(id) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Get decoration to find the storage path
    var decorationResult = await client.from("maze_decorations").select("image_url").eq("id", id).single();
    if (decorationResult.error) {
      return { data: null, error: decorationResult.error };
    }

    // Extract filename from URL
    var url = decorationResult.data.image_url;
    var filename = url.split("/").pop();

    // Delete from storage
    await client.storage.from("maze-decorations").remove([filename]);

    // Delete from database
    return await client.from("maze_decorations").delete().eq("id", id);
  }

  // ============================================
  // Project Functions
  // ============================================

  /**
   * Create a new project
   * @param {string} name - Project name
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function createProject(name) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.from("maze_projects").insert({ name: name }).select().single();
  }

  /**
   * Get all projects
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function getProjects() {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.from("maze_projects").select("*").order("created_at", { ascending: false });
  }

  /**
   * Get a project by ID with its maps and borders
   * @param {string} id - Project UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function getProject(id) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_projects")
      .select(
        `
        *,
        maze_maps (*),
        maze_project_borders (
          border_id,
          maze_borders (*)
        )
      `
      )
      .eq("id", id)
      .single();
  }

  /**
   * Delete a project and all its maps
   * @param {string} id - Project UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function deleteProject(id) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Maps will be deleted via cascade, but we need to clean up thumbnails
    var mapsResult = await client.from("maze_maps").select("thumbnail_url").eq("project_id", id);
    if (mapsResult.data) {
      var filenames = mapsResult.data
        .filter(function (m) {
          return m.thumbnail_url;
        })
        .map(function (m) {
          return m.thumbnail_url.split("/").pop();
        });
      if (filenames.length > 0) {
        await client.storage.from("maze-thumbnails").remove(filenames);
      }
    }

    return await client.from("maze_projects").delete().eq("id", id);
  }

  /**
   * Update a project
   * @param {string} id - Project UUID
   * @param {Object} updates - Fields to update (e.g., { name: "New Name" })
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function updateProject(id, updates) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.from("maze_projects").update(updates).eq("id", id).select().single();
  }

  /**
   * Get all maps for a project
   * @param {string} projectId - Project UUID
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function getMapsForProject(projectId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_maps")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
  }

  /**
   * Get a single map by ID
   * @param {string} id - Map UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function getMap(id) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client.from("maze_maps").select("*").eq("id", id).single();
  }

  // ============================================
  // Map Functions
  // ============================================

  /**
   * Create a new map in a project
   * @param {string} projectId - Project UUID
   * @param {string} name - Map name
   * @param {string} mazeJson - Serialized maze data
   * @param {Blob} thumbnail - Optional thumbnail image
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function createMap(projectId, name, mazeJson, thumbnail) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    var thumbnailUrl = null;

    // Upload thumbnail if provided
    if (thumbnail) {
      var filename = "thumb_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9) + ".png";
      var uploadResult = await client.storage.from("maze-thumbnails").upload(filename, thumbnail, {
        cacheControl: "3600",
        upsert: false,
      });
      if (!uploadResult.error) {
        var urlResult = client.storage.from("maze-thumbnails").getPublicUrl(filename);
        thumbnailUrl = urlResult.data.publicUrl;
      }
    }

    return await client
      .from("maze_maps")
      .insert({
        project_id: projectId,
        name: name,
        maze_json: mazeJson,
        thumbnail_url: thumbnailUrl,
      })
      .select()
      .single();
  }

  /**
   * Update a map
   * @param {string} id - Map UUID
   * @param {Object} updates - Fields to update
   * @param {Blob} thumbnail - Optional new thumbnail image
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function updateMap(id, updates, thumbnail) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Handle thumbnail upload if provided
    if (thumbnail) {
      // First, delete old thumbnail if exists
      var mapResult = await client.from("maze_maps").select("thumbnail_url").eq("id", id).single();
      if (mapResult.data && mapResult.data.thumbnail_url) {
        var oldFilename = mapResult.data.thumbnail_url.split("/").pop();
        await client.storage.from("maze-thumbnails").remove([oldFilename]);
      }

      // Upload new thumbnail
      var filename = "thumb_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9) + ".png";
      var uploadResult = await client.storage.from("maze-thumbnails").upload(filename, thumbnail, {
        cacheControl: "3600",
        upsert: false,
      });
      if (!uploadResult.error) {
        var urlResult = client.storage.from("maze-thumbnails").getPublicUrl(filename);
        updates.thumbnail_url = urlResult.data.publicUrl;
      }
    }

    return await client.from("maze_maps").update(updates).eq("id", id).select().single();
  }

  /**
   * Delete a map
   * @param {string} id - Map UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function deleteMap(id) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Get map to find thumbnail
    var mapResult = await client.from("maze_maps").select("thumbnail_url").eq("id", id).single();
    if (mapResult.data && mapResult.data.thumbnail_url) {
      var filename = mapResult.data.thumbnail_url.split("/").pop();
      await client.storage.from("maze-thumbnails").remove([filename]);
    }

    return await client.from("maze_maps").delete().eq("id", id);
  }

  // ============================================
  // Project Border Association Functions
  // ============================================

  /**
   * Add a border to a project
   * @param {string} projectId - Project UUID
   * @param {string} borderId - Border UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function addProjectBorder(projectId, borderId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_project_borders")
      .insert({
        project_id: projectId,
        border_id: borderId,
      })
      .select()
      .single();
  }

  /**
   * Remove a border from a project
   * @param {string} projectId - Project UUID
   * @param {string} borderId - Border UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function removeProjectBorder(projectId, borderId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_project_borders")
      .delete()
      .eq("project_id", projectId)
      .eq("border_id", borderId);
  }

  /**
   * Get all borders for a project
   * @param {string} projectId - Project UUID
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function getProjectBorders(projectId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_project_borders")
      .select(
        `
        border_id,
        maze_borders (*)
      `
      )
      .eq("project_id", projectId);
  }

  // ============================================
  // User State
  // ============================================

  /**
   * Get user state (current project, current map)
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function getUserState() {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    var userResult = await getUser();
    var user = userResult?.data?.user;
    if (!user) return { data: null, error: { message: "Not authenticated" } };

    return await client
      .from("maze_user_state")
      .select("*")
      .eq("user_id", user.id)
      .single();
  }

  /**
   * Set user state (upsert)
   * @param {Object} state - { current_project_id, current_map_id }
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function setUserState(state) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    var userResult = await getUser();
    var user = userResult?.data?.user;
    if (!user) return { data: null, error: { message: "Not authenticated" } };

    var upsertData = {
      user_id: user.id,
      current_project_id: state.current_project_id || null,
      current_map_id: state.current_map_id || null
    };

    return await client
      .from("maze_user_state")
      .upsert(upsertData, { onConflict: "user_id" })
      .select()
      .single();
  }

  // ============================================
  // Border Settings Functions
  // ============================================

  /**
   * Get border settings for a project
   * @param {string} projectId - Project UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function getBorderSettings(projectId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_project_border_settings")
      .select("*")
      .eq("project_id", projectId)
      .single();
  }

  /**
   * Save border settings for a project (upsert)
   * @param {string} projectId - Project UUID
   * @param {Object} settings - Border settings
   * @param {number} settings.margin_sixteenths - Margin in 1/16" increments
   * @param {string} settings.assignment_mode - 'random' or 'single'
   * @param {string} settings.single_border_id - Border ID for single mode
   * @param {string[]} settings.selected_border_ids - Array of selected border IDs
   * @param {Object} settings.assignments - Map of { mapId: borderId }
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function saveBorderSettings(projectId, settings) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    var upsertData = {
      project_id: projectId,
      margin_sixteenths: settings.margin_sixteenths || 8,
      assignment_mode: settings.assignment_mode || 'random',
      single_border_id: settings.single_border_id || null,
      selected_border_ids: settings.selected_border_ids || [],
      assignments: settings.assignments || {}
    };

    return await client
      .from("maze_project_border_settings")
      .upsert(upsertData, { onConflict: "project_id" })
      .select()
      .single();
  }

  // ============================================
  // Border Groups Functions
  // ============================================

  /**
   * Get all border groups for a project
   * @param {string} projectId - Project UUID
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function getBorderGroups(projectId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_border_groups")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
  }

  /**
   * Create a new border group
   * @param {string} projectId - Project UUID
   * @param {string} name - Group name
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function createBorderGroup(projectId, name) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // Get current max sort_order
    var existing = await client
      .from("maze_border_groups")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    var nextOrder = existing.data && existing.data.length > 0
      ? existing.data[0].sort_order + 1
      : 0;

    return await client
      .from("maze_border_groups")
      .insert({
        project_id: projectId,
        name: name,
        sort_order: nextOrder
      })
      .select()
      .single();
  }

  /**
   * Update a border group
   * @param {string} groupId - Group UUID
   * @param {Object} updates - Fields to update (name, border_ids, map_ids, assignments, sort_order)
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function updateBorderGroup(groupId, updates) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_border_groups")
      .update(updates)
      .eq("id", groupId)
      .select()
      .single();
  }

  /**
   * Delete a border group
   * @param {string} groupId - Group UUID
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async function deleteBorderGroup(groupId) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    return await client
      .from("maze_border_groups")
      .delete()
      .eq("id", groupId);
  }

  /**
   * Save all border groups for a project (bulk upsert)
   * @param {string} projectId - Project UUID
   * @param {Array} groups - Array of group objects
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async function saveBorderGroups(projectId, groups) {
    var client = getClient();
    if (!client) return { data: null, error: { message: "Supabase not initialized" } };

    // First delete all existing groups for this project
    await client
      .from("maze_border_groups")
      .delete()
      .eq("project_id", projectId);

    // If no groups to save, we're done
    if (!groups || groups.length === 0) {
      return { data: [], error: null };
    }

    // Insert all groups with project_id
    var groupsToInsert = groups.map(function(group, index) {
      return {
        id: group.id || undefined, // Let DB generate if not provided
        project_id: projectId,
        name: group.name,
        border_ids: group.border_ids || group.borderIds || [],
        map_ids: group.map_ids || group.mapIds || [],
        assignments: group.assignments || {},
        sort_order: index
      };
    });

    return await client
      .from("maze_border_groups")
      .insert(groupsToInsert)
      .select();
  }

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Get image dimensions from a File or Blob
   * @param {File|Blob} file
   * @returns {Promise<{width: number, height: number}>}
   */
  function getImageDimensions(file) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () {
        resolve({ width: 0, height: 0 });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  // Export module
  root.SupabaseClient = {
    init: initSupabase,
    getClient: getClient,
    // Auth
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    getUser: getUser,
    onAuthStateChange: onAuthStateChange,
    // Borders
    uploadBorder: uploadBorder,
    getBorders: getBorders,
    deleteBorder: deleteBorder,
    // Decorations
    uploadDecoration: uploadDecoration,
    getDecorations: getDecorations,
    deleteDecoration: deleteDecoration,
    // Projects
    createProject: createProject,
    getProjects: getProjects,
    getProject: getProject,
    updateProject: updateProject,
    deleteProject: deleteProject,
    // Maps
    createMap: createMap,
    getMap: getMap,
    getMapsForProject: getMapsForProject,
    updateMap: updateMap,
    deleteMap: deleteMap,
    // Project Borders
    addProjectBorder: addProjectBorder,
    removeProjectBorder: removeProjectBorder,
    getProjectBorders: getProjectBorders,
    // User State
    getUserState: getUserState,
    setUserState: setUserState,
    // Border Settings
    getBorderSettings: getBorderSettings,
    saveBorderSettings: saveBorderSettings,
    // Border Groups
    getBorderGroups: getBorderGroups,
    createBorderGroup: createBorderGroup,
    updateBorderGroup: updateBorderGroup,
    deleteBorderGroup: deleteBorderGroup,
    saveBorderGroups: saveBorderGroups,
  };
})(typeof window !== "undefined" ? window : this);
