/**
 * Jest Test Setup
 * Configures the test environment to support browser globals
 */

// Mock minimal DOM elements needed by source files
global.document = global.document || {};

// Ensure getElementById returns a mock element or null
const originalGetElementById = global.document.getElementById;
global.document.getElementById = jest.fn((id) => {
  // Return null by default, tests can override
  return originalGetElementById ? originalGetElementById.call(global.document, id) : null;
});

// Mock querySelector/querySelectorAll
global.document.querySelector = global.document.querySelector || jest.fn(() => null);
global.document.querySelectorAll = global.document.querySelectorAll || jest.fn(() => []);

// Set up global variables that would normally be set by globals.js
global.maxMaze = 0;
global.maxSolve = 0;
global.maxCanvas = 0;
global.maxCanvasDimension = 0;
global.maxWallsRemove = 300;
