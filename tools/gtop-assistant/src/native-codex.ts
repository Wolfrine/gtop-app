import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {createInterface} from 'node:readline';

type Json = Record<string, any>;
type Pending = {resolve: (value: any) => void; reject: (reason: Error) => void; timer: NodeJS.Timeout};

export class NativeCodex extends EventEmitter {
  private process: ChildProcessWithoutNullStreams;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private closed = false;
  readonly exited: Promise<void>;
  onToolCall?: (params: Json) => Promise<Json> | Json;

  constructor(executable: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    super();
    this.process = spawn(executable, ['app-server', '--stdio', ...args], {
      cwd, env, windowsHide: true, shell: false,
    });
    // The native process may emit private details. Don't forward its raw logs.
    this.process.stderr.resume();
    this.exited = new Promise(resolve => this.process.once('close', () => resolve()));
    const lines = createInterface({input: this.process.stdout, crlfDelay: Infinity});
    lines.on('line', line => {
      try { this.receive(JSON.parse(line)); }
      catch { this.close(); }
    });
    this.process.stdin.on('error', () => this.close());
    this.process.on('error', () => this.close());
    this.process.on('exit', () => this.close());
  }

  private send(value: Json) {
    if (this.closed) throw Error('Native Codex connection closed.');
    this.process.stdin.write(JSON.stringify(value) + '\n');
  }

  private receive(value: Json) {
    if (value.method && value.id !== undefined) {
      if (value.method === 'item/tool/call' && this.onToolCall) {
        void Promise.resolve().then(() => this.onToolCall!(value.params)).then(result => {
          if (!this.closed) this.send({id: value.id, result});
        }).catch(() => {
          if (!this.closed) this.send({id: value.id, result: {success: false, contentItems: [{type: 'inputText', text: 'GT Papers could not accept this artifact.'}]}});
        });
        return;
      }
      // No approval, credential refresh, or interactive attachment
      // requests are delegated to the paired Firebase worker.
      this.send({id: value.id, error: {code: -32601, message: 'This client does not provide that request.'}});
      return;
    }
    if (value.method) {
      this.emit('notification', value.method, value.params);
      return;
    }
    const pending = this.pending.get(value.id);
    if (!pending) return;
    this.pending.delete(value.id);
    clearTimeout(pending.timer);
    if (value.error) {
      pending.reject(Object.assign(Error(String(value.error.message || 'Native Codex rejected the request.')), {
        rpcCode: value.error.code,
      }));
    } else {
      pending.resolve(value.result);
    }
  }

  async initialize() {
    await this.call('initialize', {
      clientInfo: {name: 'gtop_papers', title: 'GT Papers', version: '1.0.0'},
      capabilities: {experimentalApi: true},
    });
    this.send({method: 'initialized'});
  }

  call<T = Json>(method: string, params?: Json, rpcTimeoutMs = 30_000): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      if (this.closed) { reject(Error('Native Codex connection closed.')); return; }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error('Native Codex did not acknowledge ' + method + '.'));
      }, rpcTimeoutMs);
      this.pending.set(id, {resolve, reject, timer});
      try { this.send({id, method, ...(params ? {params} : {})}); }
      catch (error) { this.close(); }
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.process.kill();
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(Error('Native Codex connection closed.'));
    }
    this.pending.clear();
    this.emit('closed');
  }

  get connected() { return !this.closed; }
}
