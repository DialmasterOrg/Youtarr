const express = require('express');
const multer = require('multer');
const {
  renderError,
  XML_CONTENT_TYPE,
  ERROR_SEARCH_UNAVAILABLE,
  SEARCH_UNAVAILABLE_MESSAGE,
  MAX_NZB_BYTES,
  WRONG_KEY_MESSAGE,
  sabnzbdResponses,
} = require('../modules/arrBridge');

const NOT_FOUND = { error: 'Not found' };
// Sonarr and Radarr upload the NZB in a form field called "name".
const UPLOAD_FIELD = 'name';
// This upload is public, so every part of it is bounded: the other form
// fields are short words such as the mode and the category.
const MAX_FORM_FIELDS = 20;
const MAX_FORM_FIELD_BYTES = 1024;

const nzbUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_NZB_BYTES,
    files: 1,
    fields: MAX_FORM_FIELDS,
    fieldSize: MAX_FORM_FIELD_BYTES,
    parts: MAX_FORM_FIELDS + 1,
  },
}).single(UPLOAD_FIELD);

/**
 * Creates the Sonarr/Radarr bridge routes: a Newznab indexer and a SABnzbd
 * download client under /arr. Sonarr and Radarr cannot log in, so these
 * routes take no session: the bridge key in the query string is the only
 * protection, it is checked on every request even with AUTH_ENABLED=false,
 * and the whole namespace answers 404 while the bridge is off.
 * @param {Object} deps - Dependencies
 * @param {Function} deps.arrBridgeLimiter - Rate limiter for the /arr namespace
 * @param {Object} deps.arrBridge - The bridge service (modules/arrBridge)
 * @returns {express.Router}
 */
function createArrBridgeRoutes({ arrBridgeLimiter, arrBridge }) {
  const router = express.Router();

  router.use('/arr', arrBridgeLimiter);
  router.use('/arr', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!arrBridge.isEnabled()) return res.status(404).json(NOT_FOUND);
    return next();
  });

  router.get('/arr/newznab/api', async (req, res) => {
    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const { status, contentType, body } = await arrBridge.newznab.handleApi(req.query, origin);
      return res.status(status).set('Content-Type', contentType).send(body);
    } catch (err) {
      // The query carries the key, so it is never logged.
      req.log.error({ err }, 'Sonarr/Radarr indexer request failed');
      return res.status(200).set('Content-Type', XML_CONTENT_TYPE)
        .send(renderError(ERROR_SEARCH_UNAVAILABLE, SEARCH_UNAVAILABLE_MESSAGE));
    }
  });

  router.get('/arr/newznab/nzb/:file', (req, res) => {
    try {
      const { status, contentType, filename, body } = arrBridge.newznab.handleNzb(req.params.file, req.query);
      if (status !== 200) return res.status(404).json(NOT_FOUND);
      res.attachment(filename);
      return res.set('Content-Type', contentType).send(Buffer.from(body, 'utf8'));
    } catch (err) {
      req.log.error({ err }, 'Sonarr/Radarr NZB request failed');
      return res.status(404).json(NOT_FOUND);
    }
  });

  // Every answer is HTTP 200: Sonarr and Radarr mark the whole download
  // client unavailable on anything else.
  async function answerSabnzbd(req, res, file) {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { status, json } = await arrBridge.sabnzbd.handle({ query: req.query, body, file });
      return res.status(status).json(json);
    } catch (err) {
      req.log.error({ err }, 'Sonarr/Radarr download client request failed');
      return res.status(200).json(sabnzbdResponses.error('Youtarr could not answer the request'));
    }
  }

  router.get('/arr/sabnzbd/api', (req, res) => answerSabnzbd(req, res, undefined));

  router.post('/arr/sabnzbd/api', (req, res) => {
    // Checked before the body is read, so nobody without the key can make
    // the server buffer an upload. Sonarr and Radarr send it in the query.
    if (!arrBridge.isAuthorized(req.query.apikey)) {
      return res.status(200).json(sabnzbdResponses.error(WRONG_KEY_MESSAGE));
    }
    return nzbUpload(req, res, (uploadError) => {
      if (uploadError) return res.status(200).json(sabnzbdResponses.error('Upload rejected'));
      return answerSabnzbd(req, res, req.file);
    });
  });

  // Keep an unknown path from falling through to the SPA.
  router.use('/arr', (_req, res) => res.status(404).json(NOT_FOUND));

  return router;
}

module.exports = createArrBridgeRoutes;
