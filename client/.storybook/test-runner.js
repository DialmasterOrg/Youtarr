const DEBUG = process.env.STORYBOOK_TEST_RUNNER_DEBUG === '1';

function logLine(line) {
  process.stdout.write(`${line}\n`);
}

function safeStringify(value) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const config = {
  async preVisit(page, context) {
    page.__youtarrStoryTitle = context.title;

    if (!DEBUG) {
      return;
    }

    const key = '__youtarrStorybookTestRunnerDebugListenersAdded';
    if (page[key]) {
      return;
    }
    page[key] = true;

    const getTitle = () => page.__youtarrStoryTitle ?? context.title;

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
              const value = await arg.evaluate((val) => {
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
              return safeStringify(value);
            } catch {
              return arg.toString();
            }
          })
        );
        if (values.length > 0) {
          extra = `\n  args: ${values.join(' | ')}`;
        }
      } catch {
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