import { createClient } from "@supabase/supabase-js";
/** Separate persisted session: signing into Mathemagine never changes MathGPL's login. */
export const mathemagineAuth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
 global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(key.startsWith('sb_') && headers.get('Authorization')===`Bearer ${key}`) headers.delete('Authorization');
 headers.set('apikey',key);return fetch(input,{...init,headers});}},
 auth:{storageKey:'mathemagine.auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});
