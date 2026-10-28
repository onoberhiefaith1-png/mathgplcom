import {describe,it,expect} from "vitest";
import {learningDatabaseName,importIsNewer} from "../accountMerge";
describe("account progress isolation and conflict handling",()=>{
 it("keeps anonymous and different signed-in accounts in different databases",()=>expect(new Set([null,"studentA","studentB"].map(learningDatabaseName)).size).toBe(3));
 it("restores an absent record from another device",()=>expect(importIsNewer(undefined,{value:{},updated_at:"2026-10-27T10:00:00Z"})).toBe(true));
 it("does not overwrite newer local work with an older remote snapshot",()=>expect(importIsNewer({_mmSavedAt:"2026-10-27T11:00:00Z"},{value:{},updated_at:"2026-10-27T10:00:00Z"})).toBe(false));
 it("a reset tombstone blocks a previously saved run from resurrecting",()=>expect(importIsNewer({_mmDeleted:true,_mmSavedAt:"2026-10-27T11:00:00Z"},{value:{working:"old"},updated_at:"2026-10-27T10:00:00Z"})).toBe(false));
 it("a newer reset on another device replaces the old run",()=>expect(importIsNewer({_mmSavedAt:"2026-10-27T10:00:00Z"},{value:{_mmDeleted:true},updated_at:"2026-10-27T11:00:00Z"})).toBe(true));
 it("equal snapshots do not trigger another write or a sync loop",()=>expect(importIsNewer({at:"2026-10-27T10:00:00Z"},{value:{},updated_at:"2026-10-27T10:00:00Z"})).toBe(false));
});
