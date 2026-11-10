import { searchPosition } from './engine.js';

self.onmessage = ({ data }) => {
  const { id, revision, position, difficulty, budgetMs, seed } = data || {};
  try {
    const result = searchPosition(position, { difficulty, budgetMs, seed });
    self.postMessage({ id, revision, result });
  } catch (error) {
    self.postMessage({ id, revision, error: error instanceof Error ? error.message : 'The chess engine could not finish this search.' });
  }
};
