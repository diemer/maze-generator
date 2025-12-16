const fs = require('fs');
const vm = require('vm');

// Load utils.js in a sandboxed context
const utilsCode = fs.readFileSync('./src/utils.js', 'utf8');
const context = {
  document: {
    getElementById: jest.fn(() => null)
  },
  parseInt: parseInt,
  Math: Math
};
vm.createContext(context);
vm.runInContext(utilsCode, context);

describe('Utils', () => {

  describe('isValidHex', () => {
    it('should validate 6-digit hex colors', () => {
      expect(context.isValidHex('#000000')).toBe(true);
      expect(context.isValidHex('#FFFFFF')).toBe(true);
      expect(context.isValidHex('#ff00ff')).toBe(true);
      expect(context.isValidHex('#123abc')).toBe(true);
    });

    it('should validate 3-digit hex colors', () => {
      expect(context.isValidHex('#000')).toBe(true);
      expect(context.isValidHex('#FFF')).toBe(true);
      expect(context.isValidHex('#f0f')).toBe(true);
    });

    it('should reject hex without hash', () => {
      expect(context.isValidHex('000000')).toBe(false);
      expect(context.isValidHex('FFF')).toBe(false);
    });

    it('should reject invalid hex characters', () => {
      expect(context.isValidHex('#GGGGGG')).toBe(false);
      expect(context.isValidHex('#ZZZZZZ')).toBe(false);
    });

    it('should reject wrong length hex', () => {
      expect(context.isValidHex('#12345')).toBe(false);
      expect(context.isValidHex('#1234567')).toBe(false);
      expect(context.isValidHex('#12')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(context.isValidHex(' #000000 ')).toBe(true);
      expect(context.isValidHex('  #FFF  ')).toBe(true);
    });
  });

  describe('replaceAt', () => {
    it('should replace character at specified index', () => {
      expect(context.replaceAt('01111', 0, '1')).toBe('11111');
      expect(context.replaceAt('01111', 1, '0')).toBe('00111');
      expect(context.replaceAt('01111', 4, '0')).toBe('01110');
    });

    it('should replace character in middle of string', () => {
      expect(context.replaceAt('abcde', 2, 'X')).toBe('abXde');
    });

    it('should return original string if index out of bounds', () => {
      expect(context.replaceAt('abc', 10, 'x')).toBe('abc');
      expect(context.replaceAt('abc', 5, 'x')).toBe('abc');
    });

    it('should handle empty string', () => {
      expect(context.replaceAt('', 0, 'x')).toBe('');
    });

    it('should replace last character', () => {
      expect(context.replaceAt('abc', 2, 'X')).toBe('abX');
    });
  });

  describe('stringVal', () => {
    it('should return integer value at index', () => {
      expect(context.stringVal('01234', 0)).toBe(0);
      expect(context.stringVal('01234', 1)).toBe(1);
      expect(context.stringVal('01234', 2)).toBe(2);
      expect(context.stringVal('01234', 4)).toBe(4);
    });

    it('should parse binary-like strings', () => {
      expect(context.stringVal('01111', 0)).toBe(0);
      expect(context.stringVal('01111', 1)).toBe(1);
      expect(context.stringVal('10101', 2)).toBe(1);
    });

    it('should handle single digit strings', () => {
      expect(context.stringVal('5', 0)).toBe(5);
    });
  });

  describe('removeFromArray', () => {
    it('should remove element from array', () => {
      const arr = [1, 2, 3, 4, 5];
      context.removeFromArray(arr, 3);
      expect(arr).toEqual([1, 2, 4, 5]);
    });

    it('should remove first occurrence only', () => {
      const arr = [1, 2, 3, 2, 4];
      context.removeFromArray(arr, 2);
      expect(arr).toEqual([1, 3, 2, 4]);
    });

    it('should do nothing if element not found', () => {
      const arr = [1, 2, 3];
      context.removeFromArray(arr, 5);
      expect(arr).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      const arr = [];
      context.removeFromArray(arr, 1);
      expect(arr).toEqual([]);
    });

    it('should work with string elements', () => {
      const arr = ['a', 'b', 'c'];
      context.removeFromArray(arr, 'b');
      expect(arr).toEqual(['a', 'c']);
    });
  });

  describe('shuffleArray', () => {
    it('should maintain array length', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const originalLength = arr.length;
      context.shuffleArray(arr);
      expect(arr.length).toBe(originalLength);
    });

    it('should contain same elements after shuffle', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr = [...original];
      context.shuffleArray(arr);
      expect(arr.sort((a, b) => a - b)).toEqual(original);
    });

    it('should handle empty array', () => {
      const arr = [];
      context.shuffleArray(arr);
      expect(arr).toEqual([]);
    });

    it('should handle single element array', () => {
      const arr = [1];
      context.shuffleArray(arr);
      expect(arr).toEqual([1]);
    });

    it('should handle two element array', () => {
      const arr = [1, 2];
      context.shuffleArray(arr);
      expect(arr.sort()).toEqual([1, 2]);
    });
  });
});
