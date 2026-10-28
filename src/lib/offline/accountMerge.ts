/** Stable namespaces and timestamp rules for account sync and reset tombstones. */
export const learningDatabaseName=(id:string|null)=>id?`mathgpl-academia:account:${id}`:"mathgpl-academia";
export function savedLearningAt(value:any):string {return value?._mmSavedAt??value?.lastAt??value?.at??"1970-01-01T00:00:00.000Z";}
export function importIsNewer(local:any,incoming:{value:any;updated_at:string}):boolean {
 if(local===undefined)return true;
 const remote=Date.parse(incoming.updated_at),current=Date.parse(savedLearningAt(local));
 return Number.isFinite(remote) && remote>current;
}
