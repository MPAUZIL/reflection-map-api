/**
 * Personal Reflection Map API
 * POST /generate-map  →  SVG or PNG image
 * POST /generate-map?format=url → returns a public URL to a PNG
 */

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const sharp   = require('sharp');
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const { generateSVG } = require('./svgTemplate');

const app  = express();
const PORT = process.env.PORT || 3000;
const MAPS_DIR = path.join(__dirname, 'public', 'maps');

// Ensure maps directory exists
fs.mkdirSync(MAPS_DIR, { recursive: true });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/maps', express.static(MAPS_DIR));

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
    if (isNaN(n))          errors.push(`Field "${field}" must be a number`);
    else if (n < 0 || n > 100) errors.push(`Field "${field}" must be 0–100, got ${n}`);
    else values[field] = n;
  }
  return { errors, values };
}


// ── /chat proxy endpoint ──────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: system || '',
        messages: messages
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Chat proxy error:', err);
    res.status(500).json({ error: 'Chat proxy failed', message: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    service: 'Personal Reflection Map API',
    version: '1.0.0',
    endpoints: {
      'POST /generate-map':         'Generate map — SVG (default), PNG, JSON, or URL',
      'GET  /openapi.json':         'OpenAPI 3.1.0 schema',
    },
  });
});

app.post('/generate-map', async (req, res) => {
  const { errors, values } = validateBody(req.body);
  if (errors.length > 0)
    return res.status(400).json({ error: 'Validation failed', details: errors });

  const format = (req.query.format || 'svg').toLowerCase();

  try {
    const svg = generateSVG(values);

    // ── url: save PNG to disk, return public URL ──────────────────────────
    if (format === 'url') {
      const id  = crypto.randomBytes(8).toString('hex');
      const filename = `${id}.png`;
      const filepath = path.join(MAPS_DIR, filename);

      await sharp(Buffer.from(svg)).png().toFile(filepath);

      // Clean up files older than 1 hour
      cleanOldMaps();

      const host = `${req.protocol}://${req.get('host')}`;
      const imageUrl = `${host}/maps/${filename}`;

      return res.json({ imageUrl, values });
    }

    // ── png: binary ───────────────────────────────────────────────────────
    if (format === 'png') {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', 'inline; filename="reflection-map.png"');
      return res.send(png);
    }

    // ── json: svg + base64 dataUrl ────────────────────────────────────────
    if (format === 'json') {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      return res.json({ svg, dataUrl: `data:image/png;base64,${png.toString('base64')}`, values });
    }

    // ── svg (default) ─────────────────────────────────────────────────────
    res.set('Content-Type', 'image/svg+xml');
    res.set('Content-Disposition', 'inline; filename="reflection-map.svg"');
    return res.send(svg);

  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: 'Image generation failed', message: err.message });
  }
});

app.get('/openapi.json', (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  res.json(buildOpenAPISchema(`${protocol}://${host}`));
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
function cleanOldMaps() {
  try {
    const files = fs.readdirSync(MAPS_DIR);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const file of files) {
      const fp = path.join(MAPS_DIR, file);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < oneHourAgo) fs.unlinkSync(fp);
    }
  } catch (_) {}
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Reflection Map API running on http://localhost:${PORT}`);
});

// ── OpenAPI schema ────────────────────────────────────────────────────────────
function buildOpenAPISchema(baseUrl) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Personal Reflection Map API',
      version: '1.0.0',
      description: 'Generates a Personal Reflection Map image from 8 percentage values.',
    },
    servers: [{ url: baseUrl, description: 'Production server' }],
    paths: {
      '/generate-map': {
        post: {
          operationId: 'generateReflectionMap',
          summary: 'Generate a Personal Reflection Map image',
          description:
            'Accepts 8 percentage values (0–100). Use ?format=url to get a public image URL ' +
            'that can be displayed directly. Use ?format=svg, ?format=png, or ?format=json for other formats.',
          parameters: [
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['url', 'svg', 'png', 'json'], default: 'url' },
              description: 'Output format. Use "url" to get a displayable image link (recommended for ChatGPT).',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReflectionMapInput' },
                example: {
                  user_objective: 75, user_facts: 60,
                  user_interpretation: 45, user_emotion: 80,
                  other_objective: 50, other_facts: 70,
                  other_interpretation: 30, other_emotion: 55,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReflectionMapUrlResponse' },
                },
                'image/svg+xml': { schema: { type: 'string' } },
                'image/png':     { schema: { type: 'string', format: 'binary' } },
              },
            },
            '400': {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ReflectionMapInput: {
          type: 'object',
          required: REQUIRED_FIELDS,
          properties: Object.fromEntries(REQUIRED_FIELDS.map(f => [
            f, { type: 'number', minimum: 0, maximum: 100 }
          ])),
        },
        ReflectionMapUrlResponse: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string', description: 'Public URL to the generated PNG image' },
            values:   { $ref: '#/components/schemas/ReflectionMapInput' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error:   { type: 'string' },
            details: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

module.exports = app;
