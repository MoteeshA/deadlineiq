/**
 * LocalML: A custom lightweight Feedforward Neural Network (Multi-Layer Perceptron)
 * built in pure JavaScript. It runs local, client-side online learning to predict
 * a user's procrastination risk for any given task based on historical completions.
 */

class LightMLP {
  constructor() {
    this.inputSize = 5; // FIX: added task type as 5th feature
    this.hiddenSize = 5;
    this.outputSize = 1;

    // Load weights/biases from localStorage or initialize randomly
    const saved = localStorage.getItem("deadlineiq_local_ml_weights");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // FIX: discard old 4-feature weights, force reinit with 5 features
        if (data.w1 && data.w1.length === 5) {
          this.w1 = data.w1;
          this.b1 = data.b1;
          this.w2 = data.w2;
          this.b2 = data.b2;
          return;
        }
      } catch (e) {
        console.warn("Failed to parse local weights, re-initializing", e);
      }
    }

    // Xavier/Glorot Initialization
    this.w1 = Array.from({ length: this.inputSize }, () =>
      Array.from({ length: this.hiddenSize }, () => (Math.random() - 0.5) * Math.sqrt(2.0 / this.inputSize))
    );
    this.b1 = Array(this.hiddenSize).fill(0.01);

    this.w2 = Array.from({ length: this.hiddenSize }, () =>
      Array.from({ length: this.outputSize }, () => (Math.random() - 0.5) * Math.sqrt(2.0 / this.hiddenSize))
    );
    this.b2 = Array(this.outputSize).fill(0.01);

    // FIX: cold-start pre-training with synthetic examples so new users
    // don't see random risk scores. High priority + high deferrals = high risk.
    this._coldStartTrain();
  }

  _coldStartTrain() {
    const syntheticExamples = [
      // [priority, estHours, deferrals, urgency, typeRisk] → label
      { inputs: [0.9, 0.8, 0.8, 0.9, 0.8], label: 1.0 }, // high risk
      { inputs: [0.9, 0.6, 0.6, 0.8, 0.7], label: 0.9 },
      { inputs: [0.5, 0.5, 0.4, 0.6, 0.5], label: 0.5 }, // medium risk
      { inputs: [0.5, 0.3, 0.2, 0.5, 0.4], label: 0.4 },
      { inputs: [0.1, 0.1, 0.0, 0.1, 0.1], label: 0.1 }, // low risk
      { inputs: [0.1, 0.2, 0.0, 0.2, 0.2], label: 0.15 },
      { inputs: [0.9, 0.9, 1.0, 1.0, 0.9], label: 1.0 }, // overdue + high defers
      { inputs: [0.1, 0.1, 0.0, 0.8, 0.1], label: 0.3 }, // urgent but easy
    ];
    for (let epoch = 0; epoch < 30; epoch++) {
      syntheticExamples.forEach(({ inputs, label }) => {
        this.train(inputs, [label], 0.1);
      });
    }
    this.save();
  }

  // Sigmoid Activation Function
  sigmoid(x) {
    return 1.0 / (1.0 + Math.exp(-Math.max(-20.0, Math.min(20.0, x))));
  }

  // Derivative of Sigmoid
  sigmoidDeriv(y) {
    return y * (1.0 - y);
  }

  // ReLU Activation Function
  relu(x) {
    return Math.max(0.0, x);
  }

  // Derivative of ReLU
  reluDeriv(x) {
    return x > 0.0 ? 1.0 : 0.0;
  }

  save() {
    localStorage.setItem(
      "deadlineiq_local_ml_weights",
      JSON.stringify({ w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 })
    );
  }

  /**
   * Forward Propagation
   * @param {number[]} inputs - input features
   * @returns {{output: number[], hidden: number[], hiddenRaw: number[]}} outputs
   */
  forward(inputs) {
    // Input -> Hidden
    const hiddenRaw = Array(this.hiddenSize).fill(0);
    const hidden = Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.b1[j];
      for (let i = 0; i < this.inputSize; i++) {
        sum += inputs[i] * this.w1[i][j];
      }
      hiddenRaw[j] = sum;
      hidden[j] = this.relu(sum);
    }

    // Hidden -> Output
    const outputRaw = Array(this.outputSize).fill(0);
    const output = Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = this.b2[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.w2[j][k];
      }
      outputRaw[k] = sum;
      output[k] = this.sigmoid(sum);
    }

    return { output, hidden, hiddenRaw };
  }

  /**
   * Backpropagation with Gradient Descent
   * @param {number[]} inputs 
   * @param {number[]} targets 
   * @param {number} lr - learning rate
   */
  train(inputs, targets, lr = 0.1) {
    const { output, hidden, hiddenRaw } = this.forward(inputs);

    // Output layer error gradients
    const outDeltas = Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      const error = targets[k] - output[k];
      outDeltas[k] = error * this.sigmoidDeriv(output[k]);
    }

    // Hidden layer error gradients
    const hiddenDeltas = Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let error = 0;
      for (let k = 0; k < this.outputSize; k++) {
        error += outDeltas[k] * this.w2[j][k];
      }
      hiddenDeltas[j] = error * this.reluDeriv(hiddenRaw[j]);
    }

    // Update weights and biases for Hidden -> Output
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let k = 0; k < this.outputSize; k++) {
        this.w2[j][k] += lr * outDeltas[k] * hidden[j];
      }
    }
    for (let k = 0; k < this.outputSize; k++) {
      this.b2[k] += lr * outDeltas[k];
    }

    // Update weights and biases for Input -> Hidden
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.w1[i][j] += lr * hiddenDeltas[j] * inputs[i];
      }
    }
    for (let j = 0; j < this.hiddenSize; j++) {
      this.b1[j] += lr * hiddenDeltas[j];
    }

    this.save();
  }
}

// Single singleton instance
const localNetwork = new LightMLP();

/**
 * Prepares task inputs normalized between [0, 1]
 */
function extractTaskFeatures(task) {
  // 1. Priority normalization
  let priorityVal = 0.5;
  if (task.priority === "high") priorityVal = 0.9;
  if (task.priority === "low") priorityVal = 0.1;

  // 2. Est Hours normalization (cap at 15h)
  const estHours = task.estimatedHours || 2;
  const estHoursNorm = Math.min(1.0, estHours / 15.0);

  // 3. Deferrals normalization (cap at 5)
  const deferrals = task.deferralCount || 0;
  const deferralsNorm = Math.min(1.0, deferrals / 5.0);

  // 4. Hours remaining until deadline
  let timeNorm = 0.5;
  if (task.deadline) {
    const dl = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
    const hoursRemaining = (dl.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining <= 0) {
      timeNorm = 1.0;
    } else {
      timeNorm = Math.max(0.0, 1.0 - (hoursRemaining / 168.0));
    }
  }

  // 5. FIX: Task type risk score — creative/writing tasks have higher procrastination risk
  // Load user's trigger categories from forensic cache to personalize this
  const type = (task.type || "General").toLowerCase();
  // Base type risk map
  const typeRiskMap = {
    writing: 0.75, presentations: 0.8, programming: 0.6,
    learning: 0.5, admin: 0.3, research: 0.35, general: 0.4, event: 0.45
  };
  let typeRisk = typeRiskMap[type] ?? 0.4;
  // Personalize: boost risk if this type is a known trigger category for this user
  try {
    const cachedPatternRaw = localStorage.getItem(
      Object.keys(localStorage).find(k => k.startsWith("deadlineiq_pattern_")) || ""
    );
    if (cachedPatternRaw) {
      const cachedPattern = JSON.parse(cachedPatternRaw);
      const triggers = (cachedPattern.triggerCategories || []).map(c => c.toLowerCase());
      if (triggers.some(t => type.includes(t) || t.includes(type))) {
        typeRisk = Math.min(1.0, typeRisk + 0.2); // boost if known trigger
      }
    }
  } catch (e) {
    console.warn(e);
  }

  return [priorityVal, estHoursNorm, deferralsNorm, timeNorm, typeRisk];
}

/**
 * Predicts the procrastination risk score of a task (percentage 0 - 100)
 */
export function predictProcrastinationRisk(task) {
  if (task.status === "completed") return 0;
  const inputs = extractTaskFeatures(task);
  const result = localNetwork.forward(inputs);
  return Math.round(result.output[0] * 100);
}

/**
 * Trains the local neural network on user actions in real-time
 * @param {object} task - target task
 * @param {boolean} wasDeferred - true if deferred/procrastinated, false if finished on time
 */
export function trainLocalModel(task, wasDeferred) {
  const inputs = extractTaskFeatures(task);
  const target = [wasDeferred ? 1.0 : 0.0];
  // Train model online over 10 quick epochs for faster convergence
  for (let epoch = 0; epoch < 10; epoch++) {
    localNetwork.train(inputs, target, 0.15);
  }
}
