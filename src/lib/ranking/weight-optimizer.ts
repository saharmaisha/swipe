import { getFeatureDimensionCount } from './vector-scorer';

/**
 * Weight Optimization via Gradient Descent
 *
 * Learns optimal feature weights from user swipe data (saves/skips).
 * Uses binary cross-entropy loss and gradient descent to find weights
 * that maximize ranking accuracy for each user.
 *
 * Mathematical formulation:
 * - Loss: L = -1/N Σ[yi * log(σ(score)) + (1-yi) * log(1 - σ(score))]
 * - Gradient: ∂L/∂wi = 1/N Σ[(σ(score) - yi) * pi * qi]
 * - Update: wi = wi - α * ∂L/∂wi
 *
 * Where:
 * - yi = 1 for save, 0 for skip
 * - score = Σ(wi * pi * qi) (weighted dot product)
 * - σ = sigmoid function
 * - α = learning rate
 */

export interface TrainingExample {
  productFeatures: number[];
  preferenceFeatures: number[];
  label: 1 | 0; // 1 = save, 0 = skip
}

export interface OptimizationResult {
  weights: number[];
  initialLoss: number;
  finalLoss: number;
  iterations: number;
  converged: boolean;
}

export interface OptimizationConfig {
  learningRate: number;
  maxIterations: number;
  convergenceThreshold: number;
  minWeight: number;
  maxWeight: number;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  learningRate: 0.01,
  maxIterations: 100,
  convergenceThreshold: 1e-6,
  minWeight: 0.1,
  maxWeight: 3.0,
};

/**
 * Creates default weights (equal importance for all dimensions).
 */
export function createDefaultWeights(): number[] {
  return new Array(getFeatureDimensionCount()).fill(1);
}

/**
 * Sigmoid activation function.
 * Maps any real number to (0, 1) range.
 */
function sigmoid(x: number): number {
  // Clamp to avoid overflow
  const clampedX = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clampedX));
}

/**
 * Computes weighted dot product of product and preference features.
 */
function weightedDotProduct(
  productFeatures: number[],
  preferenceFeatures: number[],
  weights: number[]
): number {
  let sum = 0;
  for (let i = 0; i < productFeatures.length; i++) {
    sum += productFeatures[i] * preferenceFeatures[i] * weights[i];
  }
  return sum;
}

/**
 * Computes binary cross-entropy loss over all examples.
 * Lower is better.
 */
function computeLoss(
  examples: TrainingExample[],
  weights: number[]
): number {
  let totalLoss = 0;

  for (const example of examples) {
    const score = weightedDotProduct(
      example.productFeatures,
      example.preferenceFeatures,
      weights
    );
    const prediction = sigmoid(score);

    // Binary cross-entropy: -[y*log(p) + (1-y)*log(1-p)]
    // Add small epsilon to avoid log(0)
    const epsilon = 1e-10;
    const loss = example.label === 1
      ? -Math.log(prediction + epsilon)
      : -Math.log(1 - prediction + epsilon);

    totalLoss += loss;
  }

  return totalLoss / examples.length;
}

/**
 * Computes gradients for all weights.
 * Returns array of partial derivatives ∂L/∂wi.
 */
function computeGradients(
  examples: TrainingExample[],
  weights: number[]
): number[] {
  const gradients = new Array(weights.length).fill(0);

  for (const example of examples) {
    const score = weightedDotProduct(
      example.productFeatures,
      example.preferenceFeatures,
      weights
    );
    const prediction = sigmoid(score);
    const error = prediction - example.label;

    // Gradient for each weight: error * product_feature * preference_feature
    for (let i = 0; i < weights.length; i++) {
      gradients[i] += error * example.productFeatures[i] * example.preferenceFeatures[i];
    }
  }

  // Average over all examples
  for (let i = 0; i < gradients.length; i++) {
    gradients[i] /= examples.length;
  }

  return gradients;
}

/**
 * Optimizes feature weights using gradient descent.
 *
 * @param examples - Training data from swipe history
 * @param initialWeights - Starting weights (default: all 1s)
 * @param config - Optimization hyperparameters
 * @returns Optimized weights and training metrics
 */
export function optimizeWeights(
  examples: TrainingExample[],
  initialWeights: number[] = createDefaultWeights(),
  config: Partial<OptimizationConfig> = {}
): OptimizationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Need minimum data to train
  if (examples.length < 10) {
    return {
      weights: initialWeights,
      initialLoss: 0,
      finalLoss: 0,
      iterations: 0,
      converged: false,
    };
  }

  // Validate dimensions match
  const expectedDims = initialWeights.length;
  for (const example of examples) {
    if (
      example.productFeatures.length !== expectedDims ||
      example.preferenceFeatures.length !== expectedDims
    ) {
      throw new Error(
        `Feature dimension mismatch. Expected ${expectedDims}, got product=${example.productFeatures.length}, preference=${example.preferenceFeatures.length}`
      );
    }
  }

  const weights = [...initialWeights];
  const initialLoss = computeLoss(examples, weights);
  let prevLoss = initialLoss;
  let iteration = 0;
  let converged = false;

  for (iteration = 0; iteration < cfg.maxIterations; iteration++) {
    // Compute gradients
    const gradients = computeGradients(examples, weights);

    // Update weights (gradient descent step)
    for (let i = 0; i < weights.length; i++) {
      weights[i] -= cfg.learningRate * gradients[i];
      // Clamp to reasonable range
      weights[i] = Math.max(cfg.minWeight, Math.min(cfg.maxWeight, weights[i]));
    }

    // Check convergence
    const currentLoss = computeLoss(examples, weights);
    if (Math.abs(prevLoss - currentLoss) < cfg.convergenceThreshold) {
      converged = true;
      break;
    }
    prevLoss = currentLoss;
  }

  return {
    weights,
    initialLoss,
    finalLoss: prevLoss,
    iterations: iteration,
    converged,
  };
}

/**
 * Computes accuracy of predictions on a dataset.
 * Useful for evaluating model performance.
 */
export function computeAccuracy(
  examples: TrainingExample[],
  weights: number[]
): number {
  if (examples.length === 0) return 0;

  let correct = 0;

  for (const example of examples) {
    const score = weightedDotProduct(
      example.productFeatures,
      example.preferenceFeatures,
      weights
    );
    const prediction = sigmoid(score) >= 0.5 ? 1 : 0;
    if (prediction === example.label) {
      correct++;
    }
  }

  return correct / examples.length;
}

/**
 * Splits data into training and validation sets.
 * Returns shuffled arrays for cross-validation.
 */
export function splitData(
  examples: TrainingExample[],
  trainRatio: number = 0.8
): { train: TrainingExample[]; validation: TrainingExample[] } {
  // Shuffle
  const shuffled = [...examples].sort(() => Math.random() - 0.5);

  const splitIndex = Math.floor(shuffled.length * trainRatio);

  return {
    train: shuffled.slice(0, splitIndex),
    validation: shuffled.slice(splitIndex),
  };
}
