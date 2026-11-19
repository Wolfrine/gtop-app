/** No application collection is reachable except through explicit paths in service.mjs. */
export class FirestoreStore {
  constructor(db) { this.db = db; }
  async get(path) { const d = await this.db.doc(path).get(); return d.exists ? d.data() : null; }
  async getSelected(paths,fields){
    if(!paths.length)return [];
    const documents=await this.db.getAll(...paths.map(path=>this.db.doc(path)),{fieldMask:fields});
    return documents.map(doc=>doc.exists?doc.data():null);
  }
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
  async recentSheetWork(ownerPath,states,fields,limit){
    // Legacy sheets store the owner and paper only in the path. All supported
    // paper IDs are ASCII letters, digits, '-' or '_', between these two bounds.
    const parent=ownerPath+'/papers/';
    const result=await this.db.collectionGroup('sheets')
      .where('__name__','>',this.db.doc(parent+'!'))
      .where('__name__','<',this.db.doc(parent+'~'))
      .where('state','in',states)
      .where('updatedAt','>','')
      .orderBy('updatedAt','desc').orderBy('__name__','desc')
      .limit(limit).select(...fields).get();
    return result.docs.flatMap(doc=>{
      const [paperId,collection,id,...rest]=doc.ref.path.slice(parent.length).split('/');
      if(!doc.ref.path.startsWith(parent)||collection!=='sheets'||!id||rest.length)return [];
      return [{...doc.data(),paperId,id}];
    });
  }
  transaction(fn) {
    return this.db.runTransaction(tx => fn({
      get: async path => { const d = await tx.get(this.db.doc(path)); return d.exists ? d.data() : null; },
      getSelected: async (paths,fields) => {
        if(!paths.length)return [];
        const docs=await tx.getAll(...paths.map(path=>this.db.doc(path)),{fieldMask:fields});
        return docs.map(doc=>doc.exists?doc.data():null);
      },
      update: (path, fields) => tx.update(this.db.doc(path), fields),
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
  async getSelected(paths,_fields){return Promise.all(paths.map(path=>this.get(path)));}
  async recentSheetWork(ownerPath,states,_fields,limit){
    const parent=ownerPath+'/papers/';
    return [...this.docs].flatMap(([path,sheet])=>{
      if(!path.startsWith(parent)||!states.includes(sheet.state)||!sheet.updatedAt)return [];
      const [paperId,collection,id,...rest]=path.slice(parent.length).split('/');
      return collection==='sheets'&&id&&!rest.length?[{...sheet,paperId,id,path}]:[];
    }).sort((a,b)=>a.updatedAt>b.updatedAt?-1:a.updatedAt<b.updatedAt?1:a.path>b.path?-1:1).slice(0,limit);
  }
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
        getSelected: (paths,fields) => this.getSelected(paths,fields),
        update: (path, fields) => {
          if(!this.docs.has(path))throw Error('Document unavailable');
          writes.set(path,{...structuredClone(this.docs.get(path)),...structuredClone(fields)});
        },
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
