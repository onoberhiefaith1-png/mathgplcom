CREATE INDEX IF NOT EXISTS floating_knowledge_documents_owner_kind_idx
  ON public.floating_knowledge_documents(owner_id, kind, created_at DESC);