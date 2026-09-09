type Environment = Record<string, string | undefined>;

export function browserProjects(value = 'chromium') {
  const names = [...new Set(value.split(',').map((name) => name.trim()))];
  return names.map((name) => {
    if (!['chromium', 'chrome', 'msedge', 'firefox'].includes(name)) {
      throw new Error(`Unknown browser "${name}". Use chromium,chrome,msedge,firefox; requested browsers must be installed.`);
    }
    return {
      name,
      use: {
        browserName: name === 'firefox' ? 'firefox' as const : 'chromium' as const,
        ...(name === 'chrome' || name === 'msedge' ? { channel: name } : {}),
      },
    };
  });
}

export function parsePerformanceConfig(environment: Environment = {}) {
  for (const key of ['PERF_SMOKE', 'PERF_HEADLESS']) {
    if (environment[key] !== undefined && !['true', 'false'].includes(environment[key]!)) {
      throw new Error(`${key} must be true or false.`);
    }
  }
  const smoke = environment.PERF_SMOKE === 'true';
  const holdCount = Number(environment.PERF_HOLD_COUNT ?? 40);
  const durationMs = Number(environment.PERF_DURATION_MS ?? 60_000);
  if (!Number.isSafeInteger(holdCount) || holdCount < 2) {
    throw new Error('PERF_HOLD_COUNT must be an integer >= 2 (mixed real models).');
  }
  if (!Number.isSafeInteger(durationMs) || durationMs < 1_000) {
    throw new Error('PERF_DURATION_MS must be an integer >= 1000.');
  }
  if (!smoke && (holdCount < 40 || durationMs < 60_000)) {
    throw new Error('Certification requires >= 40 holds and >= 60000 ms per phase. Use PERF_SMOKE=true for reduced runs.');
  }
  const projects = browserProjects(environment.PERF_BROWSER ?? 'chromium');
  if (projects.length !== 1) throw new Error('PERF_BROWSER must select exactly one browser; run performance benchmarks sequentially.');
  return { smoke, mode: smoke ? 'smoke' as const : 'certification' as const, holdCount, durationMs,
    headless: environment.PERF_HEADLESS !== 'false', project: projects[0] };
}

export function classifyRenderer(renderer: string | null) {
  if (!renderer || /^(WebKit WebGL|WebGL Renderer|ANGLE)$/i.test(renderer.trim())) return 'unknown';
  if (/swiftshader|llvmpipe|softpipe|software|\bwarp\b|basic render|reference rasterizer|lavapipe/i.test(renderer)) return 'software';
  return /nvidia|geforce|quadro|radeon|\bAMD\b|\bATI\b|intel|apple|adreno|mali|powervr/i.test(renderer)
    ? 'hardware' : 'unknown';
}

// Self-contained so the same function runs in page.evaluate and the server-free probe.
export function readBrowserTelemetry() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-scene-canvas]') ?? document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight, deviceScaleFactor: window.devicePixelRatio },
    screen: { width: screen.width, height: screen.height, availableWidth: screen.availWidth, availableHeight: screen.availHeight },
    visibility: document.visibilityState,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    logicalProcessors: navigator.hardwareConcurrency ?? null,
    deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    longTaskSupported: typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask'),
    webgl: gl ? {
      version: String(gl.getParameter(gl.VERSION)),
      vendor: String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR)),
      renderer: String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
      unmasked: Boolean(debug),
      contextLost: gl.isContextLost(),
    } : null,
  };
}

export function percentile(values: readonly number[], value: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(value / 100 * sorted.length) - 1)];
}

export function summarizeResponsiveness(sample: { longTasks: readonly number[] | null; heartbeatDelays: readonly number[] }) {
  return {
    longTaskAvailability: sample.longTasks === null ? 'unavailable' : 'available',
    longTaskCount: sample.longTasks?.length ?? null,
    maxLongTaskMs: sample.longTasks === null ? null : Math.max(0, ...sample.longTasks),
    maxHeartbeatDelayMs: sample.heartbeatDelays.length ? Math.max(...sample.heartbeatDelays) : null,
    p95HeartbeatDelayMs: percentile(sample.heartbeatDelays, 95),
  };
}

export function certificationBlockers(runtime: ReturnType<typeof readBrowserTelemetry>) {
  const blockers: string[] = [];
  // Windows headed Chromium reports 1.0000000149011612 for requested DPR 1.
  // Preserve that observed value in reports; tolerate only floating-point noise.
  if (runtime.viewport.width !== 1920 || runtime.viewport.height !== 1080
    || !Number.isFinite(runtime.viewport.deviceScaleFactor) || Math.abs(runtime.viewport.deviceScaleFactor - 1) > 1e-6) {
    blockers.push('Actual viewport must be 1920x1080 at deviceScaleFactor 1.');
  }
  if (!runtime.webgl || runtime.webgl.contextLost || !runtime.webgl.unmasked || classifyRenderer(runtime.webgl.renderer) !== 'hardware') {
    blockers.push('A live WebGL context with an identifiable hardware renderer is required; software/unknown is not certifiable.');
  }
  if (!runtime.longTaskSupported) blockers.push('Long-task observation is unavailable; do not interpret this as zero long tasks.');
  if (runtime.visibility !== 'visible') blockers.push('The benchmark page must remain visible.');
  return blockers;
}

export function installInputObservers() {
  const supported = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask');
  let since = performance.now();
  const longTasks: number[] | null = supported ? [] : null;
  const heartbeatDelays: number[] = [];
  const releaseHandlerMs: number[] = [];
  const releaseToFrameMs: number[] = [];
  let hiddenTransitions = document.visibilityState === 'hidden' ? 1 : 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenTransitions += 1; });
  let expected = performance.now() + 50;
  setInterval(() => {
    const now = performance.now();
    heartbeatDelays.push(Math.max(0, now - expected));
    expected = now + 50;
  }, 50);
  const observer = supported ? new PerformanceObserver((list) => {
    longTasks!.push(...list.getEntries().filter((entry) => entry.startTime >= since).map((entry) => entry.duration));
  }) : null;
  observer?.observe({ type: 'longtask' });
  window.addEventListener('pointerup', (event) => {
    if (!event.isTrusted || event.pointerType !== 'mouse' || !window.__ROUTE_SETTER_SCENE__?.dragPreview) return;
    const started = performance.now();
    // Capture-listener microtasks can precede target listeners. Measure at the last
    // bubbling listener instead; the app's synchronous commit runs on the target.
    const finished = () => {
      queueMicrotask(() => releaseHandlerMs.push(performance.now() - started));
      requestAnimationFrame(() => releaseToFrameMs.push(performance.now() - started));
    };
    window.addEventListener('pointerup', finished, { once: true });
  }, { capture: true });
  const snapshot = () => {
    if (observer) longTasks!.push(...observer.takeRecords().filter((entry) => entry.startTime >= since).map((entry) => entry.duration));
    return { longTasks: longTasks === null ? null : [...longTasks], heartbeatDelays: [...heartbeatDelays],
      releaseHandlerMs: [...releaseHandlerMs], releaseToFrameMs: [...releaseToFrameMs], hiddenTransitions };
  };
  window.__CON07__ = {
    snapshot,
    reset: () => {
      const previous = snapshot();
      if (longTasks) longTasks.length = 0;
      heartbeatDelays.length = releaseHandlerMs.length = releaseToFrameMs.length = 0;
      hiddenTransitions = document.visibilityState === 'hidden' ? 1 : 0;
      since = performance.now();
      expected = since + 50;
      return previous;
    },
  };
}

declare global {
  interface Window {
    __CON07__?: {
      snapshot(): { longTasks: number[] | null; heartbeatDelays: number[]; releaseHandlerMs: number[]; releaseToFrameMs: number[]; hiddenTransitions: number };
      reset(): ReturnType<NonNullable<Window['__CON07__']>['snapshot']>;
    };
  }
}
