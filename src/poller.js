// Capa de resiliencia sobre la API de uso.
//
// El 429 aparecía por consultar cada 60 s de forma incondicional: el mismo
// token lo usa también Claude Code, así que las peticiones se suman y el
// endpoint acaba limitando. Aquí se resuelve con cuatro medidas:
//
//   1. Ritmo adaptativo: el porcentaje solo se mueve cuando de verdad usas
//      Claude, así que se vigila la actividad local de Claude Code y solo
//      entonces se consulta seguido. En reposo, cada 5 minutos.
//   2. Una sola petición en vuelo (single-flight), nunca solapadas.
//   3. Reintento con espera exponencial y jitter, respetando Retry-After.
//   4. Caché persistente: un fallo transitorio nunca borra el último dato
//      bueno; la interfaz lo marca como "no reciente" en lugar de dar error.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { fetchUsage } = require('./usage');
const store = require('./store');

const IDLE_MS = 5 * 60 * 1000;
const ACTIVE_MS = 90 * 1000;
const PANEL_OPEN_MS = 60 * 1000;
const ACTIVITY_WINDOW_MS = 10 * 60 * 1000;
const MANUAL_FLOOR_MS = 10 * 1000;
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 30 * 60 * 1000;
// Con qué antigüedad se considera que el dato ya no es reciente.
const STALE_FACTOR = 2.5;

const AUTH_ERRORS = new Set(['no-credentials', 'expired']);

class Poller extends EventEmitter {
  constructor() {
    super();
    this.timer = null;
    this.inFlight = null;
    this.failures = 0;
    this.lastAttempt = 0;
    this.lastActivity = 0;
    this.panelOpen = false;
    this.lastError = null;
    this.nextAttemptAt = 0;
    this.watchers = [];
  }

  start() {
    this.watchActivity();
    this.schedule(0);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {}
    }
    this.watchers = [];
  }

  /**
   * Vigila las señales locales de que Claude Code está en uso. Sirve para
   * consultar seguido solo cuando el número puede estar cambiando.
   */
  watchActivity() {
    const targets = [
      { p: path.join(os.homedir(), '.claude', 'projects'), recursive: true },
      { p: path.join(os.homedir(), '.claude', 'history.jsonl'), recursive: false },
    ];
    for (const { p, recursive } of targets) {
      try {
        const w = fs.watch(p, { recursive, persistent: false }, () => {
          this.lastActivity = Date.now();
        });
        w.on('error', () => {});
        this.watchers.push(w);
      } catch {
        // Si no existe o el sistema no soporta el modo recursivo, se sigue
        // con el ritmo en reposo: se pierde reactividad, no correctitud.
      }
    }
  }

  setPanelOpen(open) {
    this.panelOpen = open;
    if (open) this.refresh();
    else this.schedule();
  }

  isActive() {
    return Date.now() - this.lastActivity < ACTIVITY_WINDOW_MS;
  }

  intervalMs() {
    if (this.panelOpen) return PANEL_OPEN_MS;
    return this.isActive() ? ACTIVE_MS : IDLE_MS;
  }

  backoffMs(res) {
    if (res && typeof res.retryAfterMs === 'number' && res.retryAfterMs > 0) {
      return Math.min(res.retryAfterMs, BACKOFF_MAX_MS);
    }
    const raw = Math.min(BACKOFF_BASE_MS * 2 ** (this.failures - 1), BACKOFF_MAX_MS);
    const jitter = 0.8 + Math.random() * 0.4; // ±20 %
    return Math.round(raw * jitter);
  }

  /** Programa el siguiente intento; `delay` explícito o el ritmo que toque. */
  schedule(delay) {
    if (this.timer) clearTimeout(this.timer);
    let ms = typeof delay === 'number' ? delay : this.intervalMs();

    // Si una ventana se reinicia antes del siguiente intento, consultar justo
    // después del reinicio: es el momento en que el número cambia de golpe.
    const snap = store.getCache();
    if (snap && Array.isArray(snap.limits)) {
      const now = Date.now();
      for (const l of snap.limits) {
        if (!l.resetsAt) continue;
        const at = Date.parse(l.resetsAt);
        if (!Number.isFinite(at)) continue;
        const untilReset = at - now + 5000;
        if (untilReset > 0 && untilReset < ms) ms = untilReset;
      }
    }

    this.nextAttemptAt = Date.now() + ms;
    this.timer = setTimeout(() => this.refresh(), ms);
    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Consulta la API. Reutiliza la petición en vuelo si ya hay una.
   * @param {{manual?: boolean}} opts
   */
  refresh(opts = {}) {
    if (this.inFlight) return this.inFlight;

    const since = Date.now() - this.lastAttempt;
    if (opts.manual && since < MANUAL_FLOOR_MS) {
      this.emit('update', this.state());
      return Promise.resolve(this.state());
    }

    this.lastAttempt = Date.now();
    this.inFlight = fetchUsage()
      .then((res) => this.handle(res))
      .catch(() => this.handle({ error: 'parse', retryable: true }))
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  handle(res) {
    if (res.error) {
      this.failures += 1;
      this.lastError = res.error;
      // Un error de autenticación no se arregla reintentando rápido: es el
      // usuario quien debe volver a iniciar sesión en Claude Code.
      const delay = AUTH_ERRORS.has(res.error)
        ? Math.max(this.intervalMs(), 5 * 60 * 1000)
        : this.backoffMs(res);
      this.schedule(delay);
    } else {
      this.failures = 0;
      this.lastError = null;
      store.setCache(res);
      store.addSample(res);
      this.schedule();
    }
    const state = this.state();
    this.emit('update', state);
    return state;
  }

  /** Estado que consume la interfaz. Nunca pierde el último dato bueno. */
  state() {
    const snap = store.getCache();
    const now = Date.now();
    const ageMs = snap ? now - snap.fetchedAt : null;
    const staleAfter = this.intervalMs() * STALE_FACTOR;

    let status;
    if (!snap) status = 'error';
    else if (this.lastError || ageMs > staleAfter) status = 'stale';
    else status = 'ok';

    return {
      status,
      limits: snap ? snap.limits : [],
      spend: snap ? snap.spend : null,
      fetchedAt: snap ? snap.fetchedAt : null,
      ageMs,
      error: this.lastError,
      needsLogin: AUTH_ERRORS.has(this.lastError),
      nextAttemptAt: this.nextAttemptAt,
      history: store.getHistory(),
    };
  }
}

module.exports = { Poller };
