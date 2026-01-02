/**
 * SVG Optimizer Module
 * Advanced SVG optimization system with pluggable pipeline architecture
 */

export {
  OptimizerPipeline,
  createOptimizerPipeline,
} from './optimizer-pipeline.js';
export {
  OptLevel,
  type OptConfig,
  type OptimizationPlugin,
  type OptimizedNode,
  type OptimizedTree,
  type OptimizationStage,
  type OptimizationResult,
  getDefaultOptConfig,
} from './types.js';
export {
  basicCleaningStage,
  removeXMLDeclaration,
  removeDoctype,
  removeComments,
  normalizeWhitespace,
  removeMetadata,
  convertToCamelCase,
  removeXMLNamespaces,
  removeInlineStyles,
  shortenColors,
  removeEmptyContainers,
  removeHiddenElements,
  roundFloats,
  sortAttributes,
} from './basic-cleaner.js';

// Tree-based optimizations
export {
  type SVGNode,
  parseSVG,
  traverseTree,
  findNodesByTag,
  findNodeById,
  getAllIds,
  removeNode,
  replaceNode,
  cloneNode,
} from './svg-tree-parser.js';
export {
  type SerializerOptions,
  serializeNode,
  serializeSVG,
  serializeSVGPretty,
  serializeSVGMinified,
  calculateReduction,
} from './tree-serializer.js';
export {
  treeOptimizationStage,
  treeRemoveUnusedDefsStage,
  treeCollapseGroupsStage,
  treeMoveAttributesToParentStage,
  treeRemoveHiddenEmptyStage,
} from './tree-stages.js';
export {
  removeUnusedDefs,
  removeUnusedDefsStage,
} from './remove-unused-defs.js';
export {
  collapseUselessGroups,
  collapseUselessGroupsStage,
} from './collapse-useless-groups.js';
export {
  moveAttributesToParent,
  moveAttributesToParentStage,
} from './move-attrs-to-parent.js';
export {
  removeHiddenAndEmptyElements,
  removeHiddenAndEmptyElementsStage,
} from './remove-hidden-empty.js';
