import {mathemagineAuth} from "@/lib/offline/mathemagineAuth";
import {getRun,saveRun,learningAccount,switchLearningAccount} from "@/lib/offline/academiaStore";
import {syncLearning} from "@/lib/offline/accountSync";
import {guestLinkToken,setGuestLinkToken} from "@/lib/guests/guestSession";
/** Account sync restores only this link's random identity, never other-link marks. */
export async function participationToken(arenaCode:string,guestCode:string):Promise<string> {
 const {data:{session}}=await mathemagineAuth.auth.getSession();
 const id=session?.user.id??null;
 if(learningAccount()!==id)await switchLearningAccount(id);
 if(!id)return guestLinkToken(guestCode);
 await syncLearning();
 const saved=await getRun<{token:string}>(`share:${arenaCode}`,"practice");
 const token=saved?.token??crypto.randomUUID();
 if(!saved)await saveRun(`share:${arenaCode}`,"practice",{token});
 setGuestLinkToken(guestCode,token);await syncLearning();return token;
}
