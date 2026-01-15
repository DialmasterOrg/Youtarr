import type { TestRunnerConfig } from '@storybook/test-runner';

const DEBUG = process.env.STORYBOOK_TEST_RUNNER_DEBUG === '1';

function logLine(line: string) {
  process.stdout.write(`${line}\n`);
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const config: TestRunnerConfig = {
  // Keep defaults; this file exists mainly so we can extend in the future
  // (e.g. set viewport, block analytics, seed localStorage, etc.)
  async preVisit(page, context) {
    // Persist current story title on the page so long-lived listeners can
    // attribute logs correctly across story navigations.
    (page as any).__youtarrStoryTitle = context.title;

    if (!DEBUG) {
      return;
    }

    const key = '__youtarrStorybookTestRunnerDebugListenersAdded';
    if ((page as any)[key]) {
      return;
    }
    (page as any)[key] = true;

    const getTitle = () => (page as any).__youtarrStoryTitle ?? context.title;

    page.on('pageerror', (err) => {
      logLine(`[test-runner] pageerror in "${getTitle()}": ${err?.message || String(err)}`);
      if (err?.stack) {
        logLine(err.stack);
      }
    });

    page.on('console', async (msg) => {
      if (msg.type() !== 'error') {
        return;
      }

      let extra = '';
      try {
        const values = await Promise.all(
          msg.args().map(async (arg) => {
            try {
              // Error objects don't serialize via jsonValue(); extract the useful bits.
              const v = await arg.evaluate((val: any) => {
                if (val instanceof Error) {
                  return {
                    __type: 'Error',
                    name: val.name,
                    message: val.message,
                    stack: val.stack,
                  };
                }
                return val;
              });
              return safeStringify(v);
            } catch {
              return arg.toString();
            }
          })
        );
        if (values.length > 0) {
          extra = `\n  args: ${values.join(' | ')}`;
        }
      } catch {
        // ignore
      }

      const location = msg.location();
      const where = location?.url
        ? ` (${location.url}:${location.lineNumber ?? ''}:${location.columnNumber ?? ''})`
        : '';

      logLine(`[test-runner] console.${msg.type()} in "${getTitle()}": ${msg.text()}${where}${extra}`);
    });

    page.on('requestfailed', (request) => {
      const failure = request.failure();
      logLine(
        `[test-runner] requestfailed in "${getTitle()}": ${request.method()} ${request.url()} ${failure?.errorText || ''}`
      );
    });
  },
};

export default config;
