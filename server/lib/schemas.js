/* ==========================================================
   Request body schemas.

   Fastify validates against these before a handler runs, so a malformed or
   oversized payload is rejected at the edge rather than part-way through a
   database write. Every string has a maximum length: unbounded text from the
   network is how a JSON body becomes a denial-of-service.

   These are deliberately not `additionalProperties: false`. The quiz posts
   its whole result object, which carries presentational fields the server
   has no use for; handlers read named fields explicitly rather than
   spreading the body, so extra keys are inert.
   ========================================================== */

const RISK_LEVELS = ["Low Risk", "Moderate Risk", "High Risk"];

const habit = {
  type: "object",
  properties: {
    topic: { type: "string", maxLength: 120 },
    score: { type: "number" },
    feedback: { type: "string", maxLength: 600 },
  },
};

const saveResultBody = {
  type: "object",
  required: ["score", "riskLevel", "badge", "recommendations", "achievements", "report"],
  properties: {
    clientId: { type: "string", maxLength: 64 },
    score: { type: "integer", minimum: 0, maximum: 100 },
    riskLevel: { type: "string", enum: RISK_LEVELS },
    badge: {
      type: "object",
      required: ["name", "icon"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 80 },
        icon: { type: "string", minLength: 1, maxLength: 16 },
        message: { type: "string", maxLength: 400 },
      },
    },
    categoryScores: { type: "object" },
    educationScores: { type: "object" },
    curriculumScores: { type: "object" },
    strongestHabit: habit,
    weakestHabit: habit,
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 40,
      items: { type: "string", minLength: 1, maxLength: 600 },
    },
    report: {
      type: "array",
      minItems: 1,
      maxItems: 40,
      items: {
        type: "object",
        properties: {
          category: { type: "string", maxLength: 120 },
          score: { type: "number" },
          explanation: { type: "string", maxLength: 1200 },
        },
      },
    },
    achievements: {
      type: "array",
      minItems: 1,
      maxItems: 60,
      items: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: 120 },
          icon: { type: "string", maxLength: 16 },
          description: { type: "string", maxLength: 400 },
          unlocked: { type: "boolean" },
        },
      },
    },
  },
};

const explorerEventBody = {
  type: "object",
  required: ["type", "age"],
  properties: {
    type: { type: "string", enum: ["age_lookup", "tooth_interaction"] },
    age: { type: "integer", minimum: 5, maximum: 18 },
    toothId: { type: "string", maxLength: 40 },
    toothName: { type: "string", maxLength: 120 },
    status: { type: "string", maxLength: 40 },
  },
};

const engagementEventBody = {
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string", minLength: 1, maxLength: 60 },
    section: { type: "string", maxLength: 80 },
    detail: { type: "string", maxLength: 300 },
    value: {}, // boolean, number, or string depending on the event
  },
};

const commentBody = {
  type: "object",
  required: ["name", "comment"],
  properties: {
    name: { type: "string", minLength: 2, maxLength: 40 },
    comment: { type: "string", minLength: 10, maxLength: 280 },
  },
};

const moderateCommentBody = {
  type: "object",
  required: ["id", "action"],
  properties: {
    id: { type: "string", format: "uuid" },
    action: { type: "string", enum: ["approve", "reject"] },
  },
};

const clientIdQuery = {
  type: "object",
  required: ["clientId"],
  properties: {
    clientId: { type: "string", minLength: 1, maxLength: 64 },
  },
};

module.exports = {
  RISK_LEVELS,
  saveResultBody,
  explorerEventBody,
  engagementEventBody,
  commentBody,
  moderateCommentBody,
  clientIdQuery,
};
