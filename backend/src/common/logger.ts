/**
 * Simple structured logger: one JSON line per message for easy parsing (e.g. by log aggregators).
 */
export function log(level: 'info' | 'warn' | 'error', message: string, context?: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context && { context }),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  info: (msg: string, context?: string, meta?: Record<string, unknown>) => log('info', msg, context, meta),
  warn: (msg: string, context?: string, meta?: Record<string, unknown>) => log('warn', msg, context, meta),
  error: (msg: string, context?: string, meta?: Record<string, unknown>) => log('error', msg, context, meta),
};
