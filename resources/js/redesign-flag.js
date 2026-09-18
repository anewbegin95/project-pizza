(function createRedesignFlagBootstrap(globalScope) {
  'use strict';

  const DEFAULT_ENV_BY_HOSTNAME = {
    development: ['localhost', '127.0.0.1'],
    staging: ['staging.nycsliceoflife.com'],
    production: ['nycsliceoflife.com', 'www.nycsliceoflife.com'],
  };

  const DEFAULT_REDESIGN_BY_ENV = {
    development: false,
    staging: false,
    production: false,
  };

  function normalizeBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return null;
  }

  function normalizeOverride(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (['on', 'true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['off', 'false', '0', 'no'].includes(normalized)) {
      return false;
    }
    return null;
  }

  function resolveEnvironment(hostname, config) {
    const explicitEnv = typeof config.env === 'string' ? config.env.trim().toLowerCase() : '';
    if (explicitEnv) {
      return explicitEnv;
    }

    const envByHostname = config.envByHostname || DEFAULT_ENV_BY_HOSTNAME;
    for (const [environment, hostnames] of Object.entries(envByHostname)) {
      if (Array.isArray(hostnames) && hostnames.includes(hostname)) {
        return environment;
      }
    }
    return 'production';
  }

  function getSearchParams(locationLike) {
    if (!locationLike || typeof locationLike.href !== 'string') {
      return new URLSearchParams();
    }
    try {
      return new URL(locationLike.href).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }

  function resolveRedesignState(locationLike, config = {}) {
    const hostname = (locationLike && locationLike.hostname ? locationLike.hostname : '').toLowerCase();
    const environment = resolveEnvironment(hostname, config);
    const redesignByEnv = config.redesignByEnv
      && typeof config.redesignByEnv === 'object'
      && !Array.isArray(config.redesignByEnv)
      ? config.redesignByEnv
      : DEFAULT_REDESIGN_BY_ENV;
    const configuredEnabled = normalizeBoolean(config.enabled);
    const defaultEnabled = normalizeBoolean(
      environment in redesignByEnv ? redesignByEnv[environment] : null
    );
    const searchParams = getSearchParams(locationLike);
    const overrideEnabled = normalizeOverride(searchParams.get('redesign'));

    const enabled = overrideEnabled !== null
      ? overrideEnabled
      : configuredEnabled !== null
        ? configuredEnabled
        : defaultEnabled !== null
          ? defaultEnabled
          : false;
    const source = overrideEnabled !== null
      ? 'url-override'
      : configuredEnabled !== null
        ? 'config'
        : 'environment-default';

    return { enabled, environment, source };
  }

  function applyRedesignState(documentLike, state) {
    if (!documentLike || !documentLike.documentElement) {
      return;
    }

    const root = documentLike.documentElement;
    root.setAttribute('data-env', state.environment);
    if (state.enabled) {
      root.setAttribute('data-redesign', 'on');
    } else {
      root.removeAttribute('data-redesign');
    }

    if (documentLike.body) {
      documentLike.body.classList.toggle('redesign-enabled', state.enabled);
    }
  }

  function initRedesignFlag(scope = globalScope) {
    const config = (scope.REDESIGN_CONFIG && typeof scope.REDESIGN_CONFIG === 'object')
      ? scope.REDESIGN_CONFIG
      : {};
    const state = resolveRedesignState(scope.location, config);

    applyRedesignState(scope.document, state);

    if (scope.document && !scope.document.body) {
      const applyWhenBodyReady = () => {
        if (scope.document && scope.document.body) {
          applyRedesignState(scope.document, state);
        }
      };

      if (scope.document.readyState === 'loading') {
        scope.document.addEventListener('DOMContentLoaded', applyWhenBodyReady, { once: true });
      } else {
        applyWhenBodyReady();
      }
    }

    scope.REDESIGN_FLAG = state;
    scope.REDESIGN_FLAG.isEnabled = () => state.enabled;
    return state;
  }

  const api = {
    DEFAULT_ENV_BY_HOSTNAME,
    DEFAULT_REDESIGN_BY_ENV,
    resolveEnvironment,
    resolveRedesignState,
    applyRedesignState,
    initRedesignFlag,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.redesignFlag = api;
    initRedesignFlag(window);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
