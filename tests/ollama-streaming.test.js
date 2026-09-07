const test = require('node:test');
const assert = require('node:assert/strict');
const { chat } = require('../src/ai/ollama');

const encoder = new TextEncoder();

function frame(content, done = false) {
    return JSON.stringify({ message: { content }, done });
}

async function withStream(parts, run, readError = null) {
    const originalFetch = globalThis.fetch;
    let index = 0;
    let released = false;

    const reader = {
        async read() {
            if (index < parts.length) {
                const part = parts[index++];
                return {
                    done: false,
                    value: typeof part === 'string' ? encoder.encode(part) : part
                };
            }
            if (readError) throw readError;
            return { done: true };
        },
        releaseLock() { released = true; }
    };

    globalThis.fetch = async () => ({
        ok: true,
        body: { getReader: () => reader }
    });

    try {
        await run();
        assert.equal(released, true, 'Debe liberar el lector');
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function expectText(parts, expected, expectedChunks) {
    await withStream(parts, async () => {
        const chunks = [];
        const result = await chat(
            'modelo-de-prueba', [], chunk => chunks.push(chunk),
            undefined, 0.7, 8192
        );
        assert.equal(result, expected);
        assert.deepEqual(chunks, expectedChunks);
    });
}

test('Procesa varias líneas en un bloque, líneas vacías y CRLF', async () => {
    await expectText(
        [`${frame('Hola')}\r\n\n${frame(' mundo')}\n${frame('', true)}\n`],
        'Hola mundo', ['Hola', ' mundo']
    );
});

test('Reconstruye un objeto JSON dividido entre bloques', async () => {
    const line = frame('Hola');
    await expectText(
        [line.slice(0, 16), line.slice(16) + '\n', frame('', true) + '\n'],
        'Hola', ['Hola']
    );
});

test('Conserva tildes y emojis incluso recibiendo un byte por bloque', async () => {
    const bytes = encoder.encode(frame('¡Hola, José! 👋') + '\n');
    await expectText(
        Array.from(bytes, byte => Uint8Array.of(byte)),
        '¡Hola, José! 👋', ['¡Hola, José! 👋']
    );
});

test('Procesa la última línea aunque no tenga salto de línea', async () => {
    await expectText([frame('Final', true)], 'Final', ['Final']);
});

test('Entrega cada fragmento sin esperar a que termine el stream', async () => {
    let delivered = false;
    const parts = [frame('Primero') + '\n'];
    // El segundo bloque solo se consulta después de entregar el primero.
    Object.defineProperty(parts, 1, {
        get() {
            assert.equal(delivered, true);
            return frame('', true) + '\n';
        }
    });
    await withStream(parts, async () => {
        const result = await chat('mock', [], () => { delivered = true; });
        assert.equal(result, 'Primero');
    });
});

test('Propaga errores comunicados por Ollama dentro del stream', async () => {
    await withStream(['{"error":"modelo no disponible"}\n'], async () => {
        await assert.rejects(chat('mock', []), /modelo no disponible/);
    });
});

test('No acepta silenciosamente un JSON truncado', async () => {
    await withStream(['{"message":'], async () => {
        await assert.rejects(chat('mock', []), SyntaxError);
    });
});

test('Conserva AbortError y libera el lector al cancelar', async () => {
    const abortError = new Error('Generación detenida');
    abortError.name = 'AbortError';
    await withStream([], async () => {
        await assert.rejects(chat('mock', []), error => error === abortError);
    }, abortError);
});
