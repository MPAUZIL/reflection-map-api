/**
 * Personal Reflection Map API
 * POST /generate-map  →  SVG or PNG image
 *
 * Query params:
 *   ?format=svg   (default) — returns SVG text  (Content-Type: image/svg+xml)
 *   ?format=png           — returns PNG binary  (Content-Type: image/png)
 *   ?format=json          — returns JSON { svg: "...", dataUrl: "data:image/svg+xml,..." }
 */

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const sharp   = require('sharp');
const { generateSVG } = require('./svgTemplate');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// ── Validation helper ─────────────────────────────────────────────────────────
const REQUIRED_FIELDS = [
  'user_objective', 'user_facts', 'user_interpretation', 'user_emotion',
  'other_objective', 'other_facts', 'other_interpretation', 'other_emotion',
];

function validateBody(body) {
  const errors = [];
  const values = {};

  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    const n = parseFloat(body[field]);
    if (isNaN(n)) {
      errors.push(`Field "${field}" must be a number, got: ${body[field]}`);
    } else if (n < 0 || n > 100) {
      errors.push(`Field "${field}" must be between 0 and 100, got: ${n}`);
    } else {
      values[field] = n;
    }
  }

  return { errors, values };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'Personal Reflection Map API',
    version: '1.0.0',
    endpoints: {
      'POST /generate-map': 'Generate map image',
      'GET  /openapi.json': 'OpenAPI 3.0 schema',
    },
  });
});

// Main endpoint
app.post('/generate-map', async (req, res) => {
  const { errors, values } = validateBody(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const format = (req.query.format || 'svg').toLowerCase();

  try {
    const svg = generateSVG(values);

    if (format === 'png') {
      const png = await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9 })
        .toBuffer();

      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', 'inline; filename="reflection-map.png"');
      return res.send(png);
    }

    if (format === 'json') {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
      return res.json({
        svg,
        dataUrl,
        values,
      });
    }

    // Default: SVG
    res.set('Content-Type', 'image/svg+xml');
    res.set('Content-Disposition', 'inline; filename="reflection-map.svg"');
    return res.send(svg);

  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: 'Image generation failed', message: err.message });
  }
});

// OpenAPI schema endpoint
app.get('/openapi.json', (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const schema = buildOpenAPISchema(host);
  res.json(schema);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Reflection Map API running on http://localhost:${PORT}`);
  console.log(`   POST /generate-map?format=svg|png|json`);
  console.log(`   GET  /openapi.json`);
});

// ── OpenAPI schema builder ────────────────────────────────────────────────────
function buildOpenAPISchema(host) {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Personal Reflection Map API',
      version: '1.0.0',
      description:
        'Generates a Personal Reflection Map SVG or PNG from 8 percentage values ' +
        'representing two perspectives (user and other) across four dimensions: ' +
        'Objective, Facts, Interpretation, and Emotion.',
    },
    servers: [{ url: `https://${host}`, description: 'Production server' }],
    paths: {
      '/generate-map': {
        post: {
          operationId: 'generateReflectionMap',
          summary: 'Generate a Personal Reflection Map image',
          description:
            'Accepts 8 percentage values (0–100) and returns a visual map image. ' +
            'Use ?format=svg for an SVG string, ?format=png for a binary PNG, or ' +
            '?format=json for a JSON object containing both the SVG and a base64 PNG data URL.',
          parameters: [
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['svg', 'png', 'json'], default: 'svg' },
              description: 'Output format. Defaults to svg.',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReflectionMapInput' },
                example: {
                  user_objective: 75,
                  user_facts: 60,
                  user_interpretation: 45,
                  user_emotion: 80,
                  other_objective: 50,
                  other_facts: 70,
                  other_interpretation: 30,
                  other_emotion: 55,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Success — returns the map in the requested format.',
              content: {
                'image/svg+xml': {
                  schema: { type: 'string', description: 'SVG image markup' },
                },
                'image/png': {
                  schema: { type: 'string', format: 'binary', description: 'PNG binary' },
                },
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReflectionMapJsonResponse' },
                },
              },
            },
            '400': {
              description: 'Validation error — one or more fields are missing or out of range.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '500': {
              description: 'Server error during image generation.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ReflectionMapInput: {
          type: 'object',
          required: [
            'user_objective', 'user_facts', 'user_interpretation', 'user_emotion',
            'other_objective', 'other_facts', 'other_interpretation', 'other_emotion',
          ],
          properties: {
            user_objective:      { type: 'number', minimum: 0, maximum: 100, description: "User's objective dimension (0–100)" },
            user_facts:          { type: 'number', minimum: 0, maximum: 100, description: "User's facts dimension (0–100)" },
            user_interpretation: { type: 'number', minimum: 0, maximum: 100, description: "User's interpretation dimension (0–100)" },
            user_emotion:        { type: 'number', minimum: 0, maximum: 100, description: "User's emotion dimension (0–100)" },
            other_objective:     { type: 'number', minimum: 0, maximum: 100, description: "Other's objective dimension (0–100)" },
            other_facts:         { type: 'number', minimum: 0, maximum: 100, description: "Other's facts dimension (0–100)" },
            other_interpretation:{ type: 'number', minimum: 0, maximum: 100, description: "Other's interpretation dimension (0–100)" },
            other_emotion:       { type: 'number', minimum: 0, maximum: 100, description: "Other's emotion dimension (0–100)" },
          },
        },
        ReflectionMapJsonResponse: {
          type: 'object',
          properties: {
            svg:     { type: 'string', description: 'Full SVG markup string' },
            dataUrl: { type: 'string', description: 'Base64 PNG data URL (data:image/png;base64,...)' },
            values:  { $ref: '#/components/schemas/ReflectionMapInput' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error:   { type: 'string' },
            details: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' },
          },
        },
      },
    },
  };
}

module.exports = app; // for testing
