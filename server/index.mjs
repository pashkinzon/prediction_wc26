import http from 'node:http';
import { syncWorldCupMatches } from './footballDataSync.mjs';

const PORT = Number(process.env.PORT || 3001);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

function isAuthorized(request) {
  const configuredToken = process.env.SYNC_ADMIN_TOKEN;
  if (!configuredToken) return false;

  const headerToken = request.headers['x-sync-token'];
  return headerToken === configuredToken;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  if (url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/sync/world-cup') {
    if (!isAuthorized(request)) {
      sendJson(response, 401, {
        ok: false,
        error: 'Missing or invalid X-Sync-Token.',
      });
      return;
    }

    if (!['GET', 'POST'].includes(request.method || '')) {
      sendJson(response, 405, {
        ok: false,
        error: 'Use GET or POST for this endpoint.',
      });
      return;
    }

    try {
      const result = await syncWorldCupMatches();
      sendJson(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        error: error.message || 'Could not sync World Cup matches.',
        throttleHeaders: error.throttleHeaders,
      });
    }
    return;
  }

  sendJson(response, 404, {
    ok: false,
    error: 'Not found.',
  });
});

server.listen(PORT, () => {
  console.log(`World Cup sync service listening on port ${PORT}`);
});
