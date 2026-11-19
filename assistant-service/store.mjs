/** No application collection is reachable except through explicit paths in service.mjs. */
export class FirestoreStore {
  constructor(db) { this.db = db; }
  async get(path) { const d = await this.db.doc(path).get(); return d.exists ? d.data() : null; }
  async list(path, filters = [], limit = 200, options = {}) {
    let query = this.db.collection(path);
    for (const [field, op, value] of filters) query = query.where(field, op, value);
    if(options.orderBy)query=query.orderBy(options.orderBy[0],options.orderBy[1]);
    if(options.startAfter)query=query.startAfter(options.startAfter);
    if(options.orderById)query=query.orderBy('__name__',options.orderBy[1]);
    if(options.cursorValues)query=query.startAfter(...options.cursorValues);
    if(options.select)query=query.select(...options.select);
    const result = await query.limit(limit).get();
    return result.docs.map(d => options.includeId?{...d.data(),id:d.id}:d.data());
  }
  transaction(fn) {
    return this.db.runTransaction(tx => fn({
      get: async path => { const d = await tx.get(this.db.doc(path)); return d.exists ? d.data() : null; },
      set: (path, data) => tx.set(this.db.doc(path), data),
      create: (path, data) => tx.create(this.db.doc(path), data),
      delete: path => tx.delete(this.db.doc(path))
    }));
  }
}

/** Serialized transactions model atomic reads/writes for deterministic unit tests. */
export class MemoryStore {
  constructor(seed = {}) { this.docs = new Map(Object.entries(structuredClone(seed))); this.tail = Promise.resolve(); }
  async get(path) { return structuredClone(this.docs.get(path) ?? null); }
  async list(path, filters = [], limit = 200, options = {}) {
    const matches=(value,[field,op,arg])=>{
      if(op==='==')return value[field]===arg;
      if(op==='in')return arg.includes(value[field]);
      if(op==='>=')return value[field]>=arg;
      if(op==='<')return value[field]<arg;
      throw Error('Unsupported query operator: '+op);
    };
    let rows=[...this.docs.entries()].filter(([key,value])=>key.startsWith(path+'/')&&
      key.split('/').length===path.split('/').length+1&&filters.every(filter=>matches(value,filter)))
      .map(([key,value])=>({id:key.split('/').at(-1),value:structuredClone(value)}));
    const compare=(a,b)=>a<b?-1:a>b?1:0;
    if(options.orderBy){
      const [field,direction]=options.orderBy,sign=direction==='desc'?-1:1;
      const orderValue=row=>field==='__name__'?row.id:row.value[field];
      rows.sort((a,b)=>sign*(compare(orderValue(a),orderValue(b))||compare(a.id,b.id)));
      if(options.startAfter)rows=rows.filter(row=>sign*compare(orderValue(row),options.startAfter)>0);
      if(options.cursorValues){
        const [at,id]=options.cursorValues;
        rows=rows.filter(row=>sign*(compare(orderValue(row),at)||compare(row.id,id))>0);
      }
    }
    return rows.slice(0,limit).map(({id,value})=>{
      if(options.select){
        const projected={};
        for(const path of options.select){
          const keys=path.split('.'),source=keys.reduce((node,key)=>node?.[key],value);
          if(source===undefined)continue;
          let target=projected;
          for(const key of keys.slice(0,-1))target=target[key]??={};
          target[keys.at(-1)]=source;
        }
        value=projected;
      }
      return options.includeId?{...value,id}:value;
    });
  }
  transaction(fn) {
    const pending = this.tail.then(async () => {
      const writes = new Map();
      const result = await fn({
        get: path => this.get(path),
        set: (path, value) => writes.set(path, structuredClone(value)),
        create: (path, value) => { if (this.docs.has(path) || writes.has(path)) throw Error('Document already exists'); writes.set(path, structuredClone(value)); },
        delete: path => writes.set(path, undefined)
      });
      for (const [path, value] of writes) {
        if(value===undefined)this.docs.delete(path);else this.docs.set(path,value);
      }
      return result;
    });
    this.tail = pending.catch(() => {});
    return pending;
  }
}
