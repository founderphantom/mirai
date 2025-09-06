/**
 * Mock implementation of nanoid for testing
 * This avoids ESM import issues with Jest
 */

let counter = 0;

/**
 * Generate a mock nanoid
 * Returns a deterministic ID for testing
 */
function nanoid(size = 21) {
  counter++;
  const id = `test-id-${counter}`.padEnd(size, '0');
  return id.slice(0, size);
}

/**
 * Generate a custom alphabet nanoid mock
 */
function customAlphabet(alphabet, size = 21) {
  return () => {
    counter++;
    return `custom-${counter}`.padEnd(size, '0').slice(0, size);
  };
}

/**
 * Generate a URL-safe nanoid mock
 */
function urlAlphabet() {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
}

/**
 * Reset the counter for testing
 */
function resetCounter() {
  counter = 0;
}

// Export both named and default exports for compatibility
module.exports = {
  nanoid,
  customAlphabet,
  urlAlphabet,
  resetCounter,
};

module.exports.nanoid = nanoid;
module.exports.default = nanoid;