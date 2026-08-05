export class PayloadTooLargeError extends Error {
  constructor() {
    super('La solicitud supera el límite permitido');
    this.name = 'PayloadTooLargeError';
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super('El cuerpo de la solicitud no contiene JSON válido');
    this.name = 'InvalidJsonError';
  }
}

/** Lee un JSON sin permitir que un cliente público agote memoria con el body. */
export async function readLimitedJson<T>(req: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!req.body) throw new InvalidJsonError();

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InvalidJsonError();
  }
}
