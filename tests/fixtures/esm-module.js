// Test ESM module that imports another module with .js extension
import { helper } from './helper.js';

export const testFunction = () => {
  return helper();
};

export default testFunction;
