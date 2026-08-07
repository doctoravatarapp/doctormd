import { createServerClient } from "@supabase/ssr";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const appUrl = process.env.APP_URL ?? "https://apollomd.vercel.app";

if (!url || !publishableKey || !email || !password) {
  throw new Error("Supabase environment and admin credentials are required.");
}

const cookieJar = new Map();
const client = createServerClient(url, publishableKey, {
  cookies: {
    getAll: () => [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value }) => value ? cookieJar.set(name, value) : cookieJar.delete(name)),
  },
});

const { data: loginData, error: loginError } = await client.auth.signInWithPassword({ email, password });
if (loginError || !loginData.user) throw new Error("Real admin login failed.");

const persistedClient = createServerClient(url, publishableKey, {
  cookies: {
    getAll: () => [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value }) => value ? cookieJar.set(name, value) : cookieJar.delete(name)),
  },
});
const { data: persisted } = await persistedClient.auth.getUser();
if (persisted.user?.id !== loginData.user.id) throw new Error("Session did not persist.");

const cookieHeader = [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
const adminResponse = await fetch(`${appUrl}/admin`, { headers: { cookie: cookieHeader }, redirect: "manual" });
if (adminResponse.status !== 200) throw new Error(`Authenticated /admin returned ${adminResponse.status}.`);
const adminHtml = await adminResponse.text();
if (!adminHtml.includes("APolloMD Demo")) throw new Error("Authenticated organization was not rendered.");

const { error: signOutError } = await persistedClient.auth.signOut();
if (signOutError) throw signOutError;
const signedOutCookie = [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
const signedOutResponse = await fetch(`${appUrl}/admin`, { headers: { cookie: signedOutCookie }, redirect: "manual" });
if (![302, 303, 307, 308].includes(signedOutResponse.status)) throw new Error("Signed-out /admin was not redirected.");

console.log(JSON.stringify({ login: "ok", session: "persisted", organization: "APolloMD Demo", adminRoute: 200, logout: "ok" }));
