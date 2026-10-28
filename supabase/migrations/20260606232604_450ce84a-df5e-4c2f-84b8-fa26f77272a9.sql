
-- 1. Add UPDATE/DELETE policies for class_join_requests
CREATE POLICY "Owners can update join requests for their classes"
ON public.class_join_requests
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid()));

CREATE POLICY "Owners can delete join requests for their classes"
ON public.class_join_requests
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid()));

CREATE POLICY "Requesters can withdraw their own pending requests"
ON public.class_join_requests
FOR DELETE
TO authenticated
USING (requester_id = auth.uid() AND status = 'pending');

-- 2. Restrict SECURITY DEFINER function to authenticated only (revoke from anon/public)
REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO authenticated;
