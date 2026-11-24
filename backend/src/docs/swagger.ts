export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Nocturne Health & Telemetry API',
    version: '1.0.0',
    description: 'High-performance biometric, cardio, sleep architecture, and live workout telemetry REST API styled for Obsidian Kinetic.'
  },
  servers: [
    { url: 'http://localhost:4000', description: 'Local Development Server' }
  ],
  paths: {
    '/api/v1/auth/login': {
      post: {
        summary: 'Authenticate user & issue JWT tokens',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'sankalp@nocturne.health' },
                  password: { type: 'string', example: 'nocturne123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Authenticated successfully with tokens' }
        }
      }
    },
    '/api/v1/dashboard/summary': {
      get: {
        summary: 'Retrieve daily biometrics, ring totals, and weekly routine',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', example: '2026-11-20' } }
        ],
        responses: { 200: { description: 'Dashboard summary returned' } }
      }
    },
    '/api/v1/biometrics/log': {
      post: {
        summary: 'Record body weight, height, and fasting calibration',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  weightKg: { type: 'number', example: 69.0 },
                  heightCm: { type: 'number', example: 178.0 },
                  isFasting: { type: 'boolean', example: true },
                  notes: { type: 'string', example: 'Morning measurement' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Biometrics recorded successfully' } }
      }
    },
    '/api/v1/analytics/weight': {
      get: {
        summary: 'Historical weight trends, BMI, and goal delta',
        parameters: [
          { name: 'timeframe', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month', 'year'] } }
        ],
        responses: { 200: { description: 'Weight history and trends' } }
      }
    },
    '/api/v1/analytics/sleep': {
      get: {
        summary: 'Sleep score, readiness, and 4-phase hypnogram',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', example: '2026-11-20' } }
        ],
        responses: { 200: { description: 'Sleep analytics and hypnogram' } }
      }
    },
    '/api/v1/analytics/cardio': {
      get: {
        summary: 'Cardiovascular fitness age, VO2 Max, and 5-Zone HR distribution',
        responses: { 200: { description: 'Cardio metrics and HR zones' } }
      }
    },
    '/api/v1/analytics/cardio/calibrate': {
      post: {
        summary: 'Calibrate Max HR and Zones using Tanaka or Gulati formula',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  age: { type: 'number', example: 28 },
                  restingHr: { type: 'number', example: 54 },
                  method: { type: 'string', enum: ['tanaka', 'gulati', 'custom'] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Recalculated zone bounds preview' } }
      }
    },
    '/api/v1/workouts/config': {
      get: { summary: 'Get current workout targets, dial wheel defaults, and audio coach options' },
      put: { summary: 'Update workout activity and reminder configuration' }
    },
    '/api/v1/workouts/session/start': {
      post: { summary: 'Start live workout session and trigger countdown' }
    },
    '/api/v1/workouts/session/{sessionId}/telemetry': {
      patch: { summary: 'Ingest batched live workout GPS, HR, cadence, and pace telemetry' }
    },
    '/api/v1/workouts/session/{sessionId}/finish': {
      post: { summary: 'Finish workout session (action: save or discard)' }
    },
    '/api/v1/community/challenges': {
      get: { summary: 'Featured community challenges, rivalries, and leaderboards' }
    },
    '/api/v1/user/profile': {
      get: { summary: 'Get user profile, lifetime stats, and biometric goals' },
      patch: { summary: 'Update profile and biometric targets' }
    }
  }
};

export const obsidianSwaggerCss = `
  body {
    background-color: #0c0f0e !important;
    color: #e1e3e1 !important;
    font-family: 'Inter', -apple-system, sans-serif !important;
  }
  .swagger-ui {
    color: #e1e3e1 !important;
  }
  .swagger-ui .topbar {
    background-color: #111413 !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  }
  .swagger-ui .info .title {
    color: #ffffff !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
  }
  .swagger-ui .info p, .swagger-ui .info li {
    color: #bccabb !important;
  }
  .swagger-ui .scheme-container {
    background-color: #191c1b !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
  }
  .swagger-ui .opblock {
    background: #1d201f !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 16px !important;
    margin-bottom: 14px !important;
  }
  .swagger-ui .opblock .opblock-summary-operation-id,
  .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-path__deprecated {
    color: #e1e3e1 !important;
    font-weight: 600 !important;
  }
  .swagger-ui .opblock .opblock-summary-method {
    border-radius: 9999px !important;
    font-weight: 700 !important;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #005e2d !important;
    color: #6bfb9a !important;
  }
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #004d26 !important;
    color: #4ade80 !important;
  }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method,
  .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: #282b29 !important;
    color: #73db9a !important;
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #93000a !important;
    color: #ffb4ab !important;
  }
  .swagger-ui .opblock-body {
    background: #141a18 !important;
    color: #e1e3e1 !important;
  }
  .swagger-ui table thead tr td, .swagger-ui table thead tr th {
    color: #869486 !important;
  }
  .swagger-ui input[type=text], .swagger-ui select {
    background: #111413 !important;
    color: #ffffff !important;
    border: 1px solid #3d4a3e !important;
    border-radius: 8px !important;
  }
  .swagger-ui .btn.execute {
    background-color: #4ade80 !important;
    color: #0c0f0e !important;
    border-radius: 9999px !important;
    font-weight: 700 !important;
  }
`;
