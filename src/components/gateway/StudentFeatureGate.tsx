import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useParams } from "@/lib/router-compat";
import type { GatewayItem } from "@/lib/gateway/items";
import GatewayGate from "./GatewayGate";

const StudentFeatureGate = ({ item, Page }: { item: GatewayItem; Page: ComponentType }) => {
  const { classId } = useParams<{ classId?: string }>();
  const owner = useQuery({
    queryKey: ["gateway-class-owner", classId ?? ""],
    enabled: Boolean(classId),
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("owner_id").eq("id", classId ?? "").maybeSingle();
      if (error) throw error;
      return data?.owner_id ?? null;
    },
    staleTime: 60_000,
  });

  return (
    <GatewayGate ownerId={owner.data} item={item}>
      <Page />
    </GatewayGate>
  );
};

export default StudentFeatureGate;