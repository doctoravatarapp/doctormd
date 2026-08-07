import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;

if (!url || !serviceRoleKey || !adminEmail) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL are required.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;

const user = users.users.find((candidate) => candidate.email?.toLowerCase() === adminEmail.toLowerCase());
if (!user) throw new Error("Admin Auth user was not found.");

let { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("id, name, slug")
  .order("created_at")
  .limit(1)
  .maybeSingle();
if (organizationError) throw organizationError;

if (!organization) {
  const created = await supabase
    .from("organizations")
    .insert({ name: "APolloMD Demo", slug: "apollomd-demo", status: "active" })
    .select("id, name, slug")
    .single();
  if (created.error) throw created.error;
  organization = created.data;
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({ id: user.id, full_name: user.user_metadata?.full_name ?? "Administrador APolloMD", status: "active" });
if (profileError) throw profileError;

const { error: membershipError } = await supabase
  .from("organization_memberships")
  .upsert(
    { organization_id: organization.id, user_id: user.id, role: "organization_admin", status: "active" },
    { onConflict: "organization_id,user_id" },
  );
if (membershipError) throw membershipError;

console.log(JSON.stringify({
  organization: organization.name,
  organizationSlug: organization.slug,
  adminEmail,
  role: "organization_admin",
  status: "provisioned",
}));
