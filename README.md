# Personal Reflection Map API

A lightweight Node.js/Express API that generates a **Personal Reflection Map** image from 8 percentage values. The visual design is fixed — only the numbers change per request.

---

## Quick Start

```bash
npm install
node index.js
# → API running on http://localhost:3000
```

---

## Endpoint

### `POST /generate-map`

**Query parameter:** `?format=svg` (default) | `?format=png` | `?format=json`

**Request body (JSON):**
```json
{
  "user_objective":      75,
  "user_facts":          60,
  "user_interpretation": 45,
  "user_emotion":        80,
  "other_objective":     50,
  "other_facts":         70,
  "other_interpretation":30,
  "other_emotion":       55
}
```

All 8 fields are required. Values must be numbers between **0 and 100**.

**Responses:**

| Format | Content-Type | Body |
|--------|-------------|------|
| `?format=svg`  | `image/svg+xml`   | Raw SVG markup |
| `?format=png`  | `image/png`       | Binary PNG image |
| `?format=json` | `application/json`| `{ svg, dataUrl, values }` |

---

## Test with curl

```bash
# SVG
curl -X POST http://localhost:3000/generate-map \
  -H "Content-Type: application/json" \
  -d '{"user_objective":75,"user_facts":60,"user_interpretation":45,"user_emotion":80,"other_objective":50,"other_facts":70,"other_interpretation":30,"other_emotion":55}' \
  -o map.svg

# PNG
curl -X POST "http://localhost:3000/generate-map?format=png" \
  -H "Content-Type: application/json" \
  -d '{"user_objective":75,"user_facts":60,"user_interpretation":45,"user_emotion":80,"other_objective":50,"other_facts":70,"other_interpretation":30,"other_emotion":55}' \
  -o map.png
```

---

## Connecting to a Custom GPT Action

1. **Deploy** this API to a public host (Railway, Render, Fly.io, etc.)
2. In your Custom GPT → **Configure** → **Actions** → **Create new action**
3. Import the `openapi.yaml` file (or paste its contents), replacing `YOUR_DOMAIN_HERE` with your server URL
4. Set **Authentication** to `None` (or add an API key — see below)
5. In your GPT system prompt, instruct it to call `generateReflectionMap` and display the result

### Recommended GPT system prompt addition:
```
When you have identified the 8 reflection values, call the generateReflectionMap 
action with ?format=png and display the returned PNG image inline using markdown: 
![Reflection Map](data_url_or_image_url)
```

### Recommended format for Custom GPT
Use `?format=json` — the GPT can then embed the `dataUrl` directly as a Markdown image:
```
![Reflection Map](data:image/png;base64,...)
```

---

## Optional: Add API Key Authentication

In `index.js`, add before the `/generate-map` route:
```js
app.use('/generate-map', (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
});
```

Then in the OpenAPI schema, add to the action's security config:
```yaml
securitySchemes:
  ApiKeyAuth:
    type: apiKey
    in: header
    name: x-api-key
```

---

## Files

| File | Purpose |
|------|---------|
| `index.js` | Express server + OpenAPI schema builder |
| `svgTemplate.js` | SVG generation logic (edit design here) |
| `openapi.yaml` | Standalone OpenAPI 3.0 schema |
| `README.md` | This file |

---

## Deployment (Railway example)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up
# → Get your public URL, update openapi.yaml servers[0].url
```
