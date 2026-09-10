import mongoose from 'mongoose';

/**
 * Compatibilidad de transacciones para MongoDB standalone (sin replica set).
 *
 * El proyecto usa `connection.startSession()` + `session.withTransaction(...)` para
 * registrar/aprobar pagos y otras operaciones. MongoDB standalone no soporta
 * sessions/transacciones y responde:
 *   "Transaction numbers are only allowed on a replica set member or mongos"
 *
 * Este shim detecta (una vez por conexión) si el server soporta transacciones:
 *  - Si NO las soporta, devuelve una "sesión falsa" cuyo withTransaction ejecuta el
 *    callback directamente y cuyos `{ session }` son eliminados de las operaciones
 *    (Mongoose/driver reciben las opciones sin sesión).
 *  - Si SÍ las soporta (replica set), se usa la sesión real y la transacción normal.
 */

const FAKE = Symbol('fakeSession');
let installed = false;

type AnyFn = (...args: unknown[]) => unknown;

const QUERY_METHODS = [
  'create',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'bulkWrite',
  'countDocuments',
  'distinct',
] as const;

function makeFakeSession() {
  return {
    [FAKE]: true,
    inTransaction: () => false,
    startTransaction() {
      /* no-op */
    },
    async commitTransaction() {
      /* no-op */
    },
    async abortTransaction() {
      /* no-op */
    },
    async endSession() {
      /* no-op */
    },
    async withTransaction(fn: AnyFn) {
      return fn();
    },
  };
}

/** Quita `session` (si es la sesión falsa) de las opciones de una query de Mongoose. */
function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      const obj = arg as Record<string | symbol, unknown>;
      const session = obj.session as Record<symbol, unknown> | undefined;
      if (session && session[FAKE]) {
        const clone: Record<string, unknown> = { ...(arg as Record<string, unknown>) };
        delete clone.session;
        return clone;
      }
    }
    return arg;
  });
}

export function installStandaloneTransactions(): void {
  if (installed) return;
  try {
    install();
    installed = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[tx] Shim de transacciones no aplicado:', err instanceof Error ? err.message : err);
  }
}

function install(): void {
  const proto = mongoose.Connection.prototype as unknown as {
    startSession: (...args: unknown[]) => Promise<unknown>;
  };
  const originalStartSession = proto.startSession;
  const modes = new WeakMap<object, 'real' | 'fake'>();

  proto.startSession = async function patchedStartSession(
    this: mongoose.Connection,
    ...args: unknown[]
  ): Promise<unknown> {
    let mode = modes.get(this);
    if (!mode) {
      try {
        const probe = (await originalStartSession.apply(this, args)) as {
          withTransaction: (fn: () => Promise<void>) => Promise<void>;
          endSession: () => Promise<void>;
        };
        try {
          await probe.withTransaction(async () => {
            /* probe sin operaciones */
          });
          mode = 'real';
        } catch {
          mode = 'fake';
        } finally {
          try {
            await probe.endSession();
          } catch {
            /* ignore */
          }
        }
      } catch {
        mode = 'fake';
      }
      modes.set(this, mode);
      // eslint-disable-next-line no-console
      console.log(
        `[tx] MongoDB sessions: ${mode === 'real' ? 'transacciones habilitadas' : 'standalone → ejecutando sin transacciones'}`,
      );
    }

    if (mode === 'real') return originalStartSession.apply(this, args);
    return makeFakeSession() as unknown;
  };

  const Model = mongoose.Model as unknown as Record<string, AnyFn>;
  for (const method of QUERY_METHODS) {
    const original = Model[method];
    if (typeof original !== 'function') continue;
    Model[method] = function patched(this: unknown, ...args: unknown[]) {
      return original.apply(this, sanitizeArgs(args));
    };
  }
}
