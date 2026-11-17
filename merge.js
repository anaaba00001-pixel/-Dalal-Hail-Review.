(function(root){
 'use strict';
 const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 function same(a,b){
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a),bk=Object.keys(b);
  return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
 }
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const identity=v=>object(v)&&typeof v.id==='string'?'id:'+v.id:Array.isArray(v)&&v.length>=32&&v[31]?'place:'+JSON.stringify([v[30],v[31]]):typeof v==='string'?'text:'+v:null;
 function merge(base,local,remote,path=''){
  if(same(local,base))return copy(remote);
  if(same(remote,base)||same(local,remote))return copy(local);
  if(object(local)&&object(remote)&&(object(base)||base===undefined)){
   const out={};
   for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){
    if(['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid data key');
    const value=merge(base?.[key],local[key],remote[key],path+'/'+key);
    if(value!==undefined)out[key]=value;
   }
   return out;
  }
  if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
   const all=[...base,...local,...remote];
   if(all.every(v=>identity(v)!==null)&&[base,local,remote].every(a=>new Set(a.map(identity)).size===a.length)){
    const maps=[base,local,remote].map(a=>new Map(a.map(v=>[identity(v),v])));
    const order=[...new Set([...remote.map(identity),...local.map(identity),...base.map(identity)])];
    const out=[];
    for(const id of order){const v=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),path+'/'+id);if(v!==undefined)out.push(v);}
    return out;
   }
   // Place records are fixed-column rows, so separate fields can merge independently.
   if([base,local,remote].every(a=>a.length>=32)&&same(base[31],local[31])&&same(base[31],remote[31])){
    return Array.from({length:Math.max(base.length,local.length,remote.length)},(_,i)=>merge(base[i],local[i],remote[i],path+'/'+i)??null);
   }
  }
  const error=new Error('Concurrent edit: '+path);error.conflict=true;throw error;
 }
 const api={merge,same,copy};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.DalalMerge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
