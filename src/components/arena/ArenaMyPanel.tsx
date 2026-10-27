import { useArenaHeartbeat } from "@/hooks/useArenaHeartbeat";
/** Reporting stays active without taking space from the floating-number toolbar. */
export default function ArenaMyPanel({guestCode,token,assessmentId}:{guestCode:string;token:string;assessmentId:string}) {
 useArenaHeartbeat(guestCode,token,assessmentId);return null;
}
