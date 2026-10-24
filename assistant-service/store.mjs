/** No application collection is reachable except through explicit paths in service.mjs. */
export class FirestoreStore {
  constructor(db) { this.db = db; }
  async get(path) { const d = await this.db.doc(path).get(); return d.exists ? d.data() : null; }
  async list(path, filters = [], limit = 200, options = {}) {
    let query = this.db.collection(path);
    for (const [field, op, value] of filters) query = query.where(field, op, value);
    if(options.orderBy)query=query.orderBy(options.orderBy[0],options.orderBy[1]);
    if(options.startAfter)query=query.startAfter(options.startAfter);
    if(options.select)query=query.select(...options.select);
    const result = await query.limit(limit).get();
    return result.docs.map(d => options.includeId?{...d.data(),id:d.id}:d.data());
  }
  transaction(fn) {
    return this.db.runTransaction(tx => fn({
      get: async path => { const d = await tx.get(this.db.doc(path)); return d.exists ? d.data() : null; },
      set: (path, data) => tx.set(this.db.doc(path), data),
      create: (path, data) => tx.create(this.db.doc(path), data)
    }));
  }
}

/** Serialized transactions model atomic reads/writes for deterministic unit tests. */
export class MemoryStore {
  constructor(seed = {}) { this.docs = new Map(Object.entries(structuredClone(seed))); this.tail = Promise.resolve(); }
  async get(path) { return structuredClone(this.docs.get(path) ?? null); }
  async list(path, filters = [], limit = 200, options = {}) {
    let rows=[...this.docs.entries()].filter(([key, value]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, op, expected]) => op === '==' && value[field] === expected)).map(([key,value])=>structuredClone(options.includeId?{...value,id:key.split('/').at(-1)}:value));
    if(options.orderBy){const [field,direction]=options.orderBy,key=field==='__name__'?'id':field;rows.sort((a,b)=>(field==='__name__'?(a[key]<b[key]?-1:a[key]>b[key]?1:0):String(a[key]).localeCompare(String(b[key])))*(direction==='desc'?-1:1));if(options.startAfter)rows=rows.filter(row=>direction==='desc'?String(row[key])<options.startAfter:String(row[key])>options.startAfter);}
    rows=rows.slice(0,limit);return options.select?rows.map(value=>Object.fromEntries(options.select.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]))):rows;
  }
  transaction(fn) {
    const pending = this.tail.then(async () => {
      const writes = new Map();
      const result = await fn({
        get: path => this.get(path),
        set: (path, value) => writes.set(path, structuredClone(value)),
        create: (path, value) => { if (this.docs.has(path) || writes.has(path)) throw Error('Document already exists'); writes.set(path, structuredClone(value)); }
      });
      for (const [path, value] of writes) this.docs.set(path, value);
      return result;
    });
    this.tail = pending.catch(() => {});
    return pending;
  }
}
