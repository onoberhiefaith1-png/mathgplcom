-- Reorder the public homepage into a clear product story and add the new sections.

-- 1. Retire sections that no longer serve the story (kept, just hidden).
UPDATE public.site_sections
SET visible = false, position = 100 + position
WHERE key IN ('curiosity','product','platform','world','transformation','audience','experience');

-- 2. Reposition and re-copy the sections we keep.
UPDATE public.site_sections SET position = 1 WHERE key = 'hook';
UPDATE public.site_sections SET position = 3, headline = 'MathGPL at a glance' WHERE key = 'numbers';
UPDATE public.site_sections
SET position = 4,
    headline = 'Create. Teach. Practise. Master.',
    subline = 'Four pillars, one continuous mathematics experience.',
    items = '[{"id":"pillar-create","label":"Create","headline":"Lesson notes built step by step."},
              {"id":"pillar-teach","label":"Teach","headline":"Smartboard teaching, live."},
              {"id":"pillar-practise","label":"Practise","headline":"Assignments, adventures, skills."},
              {"id":"pillar-master","label":"Master","headline":"Assessment and reports."}]'::jsonb,
    published_at = now()
WHERE key = 'what';
UPDATE public.site_sections SET position = 14 WHERE key = 'proof';
UPDATE public.site_sections
SET position = 15,
    headline = 'Where mathematics becomes an experience.',
    subline = 'Start with your school, your class, or just yourself.'
WHERE key = 'final';
UPDATE public.site_sections SET position = 16 WHERE key = 'footer';

-- 3. New sections.
INSERT INTO public.site_sections (key, kind, title, position, visible, eyebrow, headline, subline, cta_label, cta_href, media, items, published_at)
VALUES
  ('introduction','statement',NULL,2,true,NULL,
   'One platform. The complete mathematics learning journey.',
   'School → Teacher → Student → Parent.',
   NULL,NULL,'{}'::jsonb,'[]'::jsonb,now()),

  ('smartboard','spotlight',NULL,5,true,'Smartboard',
   'Bring mathematics to life.',
   'Teach on a living board where every step is written, moved and solved in front of the class.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"chip-notes","label":"Lesson Notes"},{"id":"chip-board","label":"Smartboard"},{"id":"chip-2d","label":"2D"},{"id":"chip-3d","label":"3D"},{"id":"chip-reports","label":"Reports"}]'::jsonb,
   now()),

  ('floating','cinematic',NULL,6,true,'Floating Numbers',
   'Mathematics in Motion.',
   'Numbers you can pick up, move and rearrange — the engine behind every MathGPL board.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"floating-shot","label":"Floating Numbers on the Smartboard"}]'::jsonb,
   now()),

  ('workflow','workflow',NULL,7,true,'How it works',
   'Everything connects.',
   'One flow from the school office to the parent''s phone.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"step-school","label":"School","headline":"Create the school and invite teachers.","media":null},
     {"id":"step-teacher","label":"Teacher","headline":"Build classes and lesson notes.","media":null},
     {"id":"step-board","label":"Smartboard","headline":"Teach the lesson live.","media":null},
     {"id":"step-student","label":"Student","headline":"Join the class and follow every step.","media":null},
     {"id":"step-assignments","label":"Assignments","headline":"Practise with real working, not multiple choice.","media":null},
     {"id":"step-collab","label":"Collaboration","headline":"Solve together on a shared board.","media":null},
     {"id":"step-adventure","label":"Adventure","headline":"Problem-solving becomes exploration.","media":null},
     {"id":"step-assessment","label":"Assessment & Reports","headline":"See exactly where each learner stands.","media":null},
     {"id":"step-parents","label":"Parents","headline":"Progress shared with the people at home.","media":null}]'::jsonb,
   now()),

  ('teacher','spotlight',NULL,8,true,'Teacher workspace',
   'Everything a teacher needs, in one place.',
   'Classes, lesson notes, assignments, adventures and reports — without switching tools.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"t-classes","label":"Classes"},{"id":"t-notes","label":"Lesson Notes"},{"id":"t-assign","label":"Assignments"},{"id":"t-reports","label":"Reports"}]'::jsonb,
   now()),

  ('student','spotlight',NULL,9,true,'Student workspace',
   'Learning doesn''t stop when the lesson ends.',
   'Every class, assignment and adventure waiting behind one door.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"s-learning","label":"Learning"},{"id":"s-assign","label":"Assignments"},{"id":"s-adventure","label":"Adventure"},{"id":"s-skills","label":"Skill Builder"}]'::jsonb,
   now()),

  ('parent','spotlight',NULL,10,true,'Parents',
   'Parents stay connected to learning.',
   'Follow progress class by class, school by school, in plain language.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"p-progress","label":"Progress"},{"id":"p-schools","label":"By school"},{"id":"p-children","label":"Every child"}]'::jsonb,
   now()),

  ('reports','spotlight',NULL,11,true,'Assessment & reports',
   'Know where every learner stands.',
   'Per-student progress, class averages and trends over time — from real work, not guesses.',
   NULL,NULL,'{}'::jsonb,
   '[{"id":"r-student","label":"Student progress"},{"id":"r-class","label":"Class averages"},{"id":"r-trend","label":"Trends"}]'::jsonb,
   now()),

  ('payments','spotlight',NULL,12,true,'For teachers',
   'Teach. Earn. Grow.',
   'Publish your own student access plans and get paid directly through your own payment account.',
   'Set Up Payments','/signup','{}'::jsonb,
   '[{"id":"pay-plans","label":"Your plans"},{"id":"pay-gateway","label":"Your gateway page"},{"id":"pay-payouts","label":"Direct payouts"}]'::jsonb,
   now()),

  ('journey','journey',NULL,13,true,'The complete journey',
   'One connected ecosystem.',
   NULL,
   NULL,NULL,'{}'::jsonb,
   '[{"id":"j-school","label":"School"},{"id":"j-teacher","label":"Teacher"},{"id":"j-notes","label":"Lesson Notes"},
     {"id":"j-board","label":"Smartboard"},{"id":"j-floating","label":"Floating Numbers"},{"id":"j-student","label":"Student"},
     {"id":"j-assign","label":"Assignment"},{"id":"j-collab","label":"Collaboration"},{"id":"j-adventure","label":"Adventure"},
     {"id":"j-assessment","label":"Assessment"},{"id":"j-reports","label":"Reports"},{"id":"j-parent","label":"Parent"},
     {"id":"j-growth","label":"Growth"}]'::jsonb,
   now())
ON CONFLICT (key) DO NOTHING;