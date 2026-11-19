import { app } from '../../src/app';

export async function request(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const method = options.method || 'GET';
  const headers = new Headers(options.headers);

  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const req = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: bodyStr,
  });

  const res = await app.handle(req);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: res.status,
    headers: res.headers,
    body: json,
    ok: res.ok,
  };
}
