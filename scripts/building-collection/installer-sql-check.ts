// Throwaway-Postgres check of the ten-building installer (PGlite, in memory).
// Not part of CI and not a dependency of the app. Run from a scratch folder:
//   (cd /tmp/x && bun add @electric-sql/pglite)
//   NODE_PATH=/tmp/x/node_modules bun scripts/building-collection/installer-sql-check.ts
// The tables are minimal stand-ins with the real columns and constraints the
// installer writes; it proves: admin-only, atomic rollback, idempotent retry,
// one Public entry per building, existing/active buildings untouched.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { BUILDING_COLLECTION, collectionBlueprint } from "../../src/lib/building/collection.ts";

const db = new PGlite();
const q = (s: string, p: unknown[] = []) => db.query(s, p);
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create type public.app_role as enum ('platform_owner','co_admin','teacher');
create table public.user_roles (user_id uuid, role public.app_role);
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create table public.buildings (id uuid primary key default gen_random_uuid(), org_id uuid, owner_id uuid not null references auth.users(id), name text not null default 'My Building', source_building_id uuid references public.buildings(id) on delete set null, environment jsonb not null default '{}', is_active boolean not null default false, exterior_config jsonb not null default '{}'::jsonb, thumbnail_url text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.building_walkways (id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade, parent_id uuid references public.building_walkways(id) on delete cascade, direction text not null default 'forward' check (direction in ('forward','left','right')), length real not null default 12, position integer not null default 0, name text not null default 'Hallway', end_label text, junction_at numeric not null default 0.5, surface_overrides jsonb not null default '{}');
create table public.building_doors (id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade, walkway_id uuid not null references public.building_walkways(id) on delete cascade, position_along real not null default 0.5 check (position_along >= 0 and position_along <= 1), design jsonb not null default '{}', content_kind text, content_id uuid, title_override text, created_by uuid references auth.users(id));
create table public.building_classrooms (id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade, door_id uuid not null unique references public.building_doors(id) on delete cascade, name text not null, kind text not null default 'classroom' check (kind in ('classroom','teaching_hall','auditorium')), surface_overrides jsonb not null default '{}', position integer not null default 0);
create table public.building_room_screens (id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade, classroom_id uuid not null unique references public.building_classrooms(id) on delete cascade, video_path text);
create table public.building_frames (id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade, walkway_id uuid references public.building_walkways(id), classroom_id uuid references public.building_classrooms(id), wall text not null default 'leftWall' check (wall in ('leftWall','rightWall','endWall')), design text not null default 'courses', name text not null default 'New frame', offset_along double precision not null default 0.5, offset_y double precision not null default 2.1, width double precision not null default 1.6, kind text not null default 'frame', height_ratio numeric not null default 0.66, constraint one_place check ((walkway_id is not null and classroom_id is null) or (walkway_id is null and classroom_id is not null)));
create table public.building_gallery_categories (id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, position double precision default 0);
insert into public.building_gallery_categories (slug,name) values ('modern','M'),('school','S'),('ancient','A'),('futuristic','F'),('science','Sc');
create table public.building_gallery_entries (id uuid primary key default gen_random_uuid(), kind text not null default 'official' check (kind in ('official','community')), name text not null, description text, category_slug text not null references public.building_gallery_categories(slug), template_building_id uuid not null references public.buildings(id) on delete cascade, publisher_id uuid not null, published boolean not null default true, published_at timestamptz default now(), exterior_config jsonb, exterior_thumbnail text);
`);
await db.exec(readFileSync(new URL("../../supabase/migrations/20261118120000_ten_building_collection.sql", import.meta.url), "utf8"));

const ADMIN = "11111111-1111-1111-1111-111111111111", ADMIN2 = "22222222-2222-2222-2222-222222222222", TEACHER = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users values ('${ADMIN}'),('${ADMIN2}'),('${TEACHER}');
insert into public.user_roles values ('${ADMIN}','platform_owner'),('${ADMIN2}','co_admin'),('${TEACHER}','teacher');
insert into public.buildings (id, owner_id, name, is_active, environment, exterior_config) values ('aaaaaaaa-0000-0000-0000-000000000001','${ADMIN}','Existing active',true,'{"x":1}','{"y":2}');`);

const templates = JSON.stringify(BUILDING_COLLECTION.map((t) => collectionBlueprint(t)));
const counts = async () => {
  const r = await q(`select (select count(*) from buildings) b, (select count(*) from building_walkways) w, (select count(*) from building_doors) d, (select count(*) from building_classrooms) c, (select count(*) from building_room_screens) s, (select count(*) from building_frames) f, (select count(*) from building_gallery_entries) e`);
  return Object.fromEntries(Object.entries(r.rows[0] as object).map(([k, v]) => [k, Number(v)]));
};
const as = async (uid: string | null, fn: () => Promise<unknown>) => {
  await q(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
  try { return await fn(); } finally { await q(`select set_config('request.jwt.claim.sub', '', false)`); }
};
const install = () => q(`select public.install_building_collection($1::jsonb) r`, [templates]);
const log = (k: string, v: unknown) => console.log(k.padEnd(38), JSON.stringify(v));

log("baseline", await counts());
try { await as(TEACHER, install); log("teacher install", "UNEXPECTED SUCCESS"); } catch (e) { log("teacher install rejected", (e as { code?: string; message: string }).code + " " + (e as Error).message); }
try { await as(null, install); log("anonymous install", "UNEXPECTED SUCCESS"); } catch (e) { log("no-session install rejected", (e as Error).message); }
const first = (await as(ADMIN, install)) as { rows: { r: { created: boolean; published: boolean; templateCreated: boolean }[] }[] };
const r1 = first.rows[0].r;
log("admin install #1 created/published", [r1.filter((x) => x.created).length, r1.filter((x) => x.templateCreated).length, r1.filter((x) => x.published).length]);
log("counts after #1", await counts());
const second = (await as(ADMIN, install)) as typeof first;
const r2 = second.rows[0].r;
log("admin install #2 (retry) created/published", [r2.filter((x) => x.created).length, r2.filter((x) => x.templateCreated).length, r2.filter((x) => x.published).length]);
log("same ids on retry", JSON.stringify(r1) === JSON.stringify(r2.map((x, i) => ({ ...x, created: r1[i].created, templateCreated: r1[i].templateCreated, published: r1[i].published }))));
log("counts after #2", await counts());
const third = (await as(ADMIN2, install)) as typeof first;
const r3 = third.rows[0].r;
log("second admin install created/published", [r3.filter((x) => x.created).length, r3.filter((x) => x.templateCreated).length, r3.filter((x) => x.published).length]);
log("counts after second admin", await counts());

// Atomicity: one broken blueprint (room on an unknown hallway) rolls back all ten.
const bad = JSON.parse(templates); bad[9].rooms = bad[9].rooms.map((r: object, i: number) => (i === 10 ? { ...r, hallway: "nowhere" } : r));
await db.exec(`insert into auth.users values ('44444444-4444-4444-4444-444444444444'); insert into public.user_roles values ('44444444-4444-4444-4444-444444444444','platform_owner');`);
const before = await counts();
try { await as("44444444-4444-4444-4444-444444444444", () => q(`select public.install_building_collection($1::jsonb)`, [JSON.stringify(bad)])); log("broken install", "UNEXPECTED SUCCESS"); }
catch (e) { log("broken install rejected", (e as Error).message); }
log("rolled back completely", JSON.stringify(before) === JSON.stringify(await counts()));

log("existing active building untouched", (await q(`select is_active, environment, exterior_config, name from buildings where id='aaaaaaaa-0000-0000-0000-000000000001'`)).rows[0]);
log("active buildings (should be 1)", Number((await q(`select count(*) n from buildings where is_active`)).rows[0].n));
log("entries", (await q(`select kind, category_slug, count(*)::int n, bool_and(published) published from building_gallery_entries group by 1,2 order by 2`)).rows);
log("per building structure", (await q(`select b.name, (select count(*) from building_walkways w where w.building_id=b.id)::int w, (select count(*) from building_classrooms c where c.building_id=b.id)::int c, (select count(*) from building_room_screens s where s.building_id=b.id)::int s, (select count(*) from building_frames f where f.building_id=b.id)::int f from buildings b where b.name like 'Nile%' order by b.name`)).rows);
log("template points to template building", Number((await q(`select count(*) n from building_gallery_entries e join buildings b on b.id=e.template_building_id where b.name like '%(gallery template)' and not b.is_active`)).rows[0].n));
log("privileges", (await q(`select has_function_privilege('authenticated','public.install_building_collection_for_owner(uuid,jsonb)','execute') a_owner, has_function_privilege('anon','public.install_building_collection(jsonb)','execute') anon_wrapper, has_function_privilege('authenticated','public.install_building_collection(jsonb)','execute') auth_wrapper, has_function_privilege('authenticated','public.collection_insert_building_structure(uuid,uuid,jsonb)','execute') auth_helper`)).rows[0]);
const env = (await q(`select environment->'leftWall' lw, exterior_config->'slotOverrides'->'core-3' core from buildings where name='Aegean Academy' limit 1`)).rows[0];
log("stored design sample", env);
