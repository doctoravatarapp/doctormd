export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "platform_admin" | "organization_admin" | "doctor" | "staff";
export type MemberStatus = "active" | "invited" | "inactive";

type Timestamped = {
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<
        Timestamped & { id: string; name: string; slug: string; status: "active" | "suspended" | "inactive" },
        { id?: string; name: string; slug: string; status?: "active" | "suspended" | "inactive"; created_at?: string; updated_at?: string }
      >;
      profiles: Table<
        Timestamped & { id: string; full_name: string | null; status: MemberStatus },
        { id: string; full_name?: string | null; status?: MemberStatus; created_at?: string; updated_at?: string }
      >;
      platform_admins: Table<
        { user_id: string; granted_by: string | null; created_at: string },
        { user_id: string; granted_by?: string | null; created_at?: string }
      >;
      organization_memberships: Table<
        Timestamped & { id: string; organization_id: string; user_id: string; role: AppRole; status: MemberStatus },
        { id?: string; organization_id: string; user_id: string; role: Exclude<AppRole, "platform_admin">; status?: MemberStatus; created_at?: string; updated_at?: string }
      >;
      doctors: Table<
        Timestamped & { id: string; organization_id: string; user_id: string | null; display_name: string; specialty: string | null; professional_registration: string | null; status: "active" | "inactive" },
        { id?: string; organization_id: string; user_id?: string | null; display_name: string; specialty?: string | null; professional_registration?: string | null; status?: "active" | "inactive"; created_at?: string; updated_at?: string }
      >;
      patients: Table<
        Timestamped & { id: string; organization_id: string; auth_user_id: string | null; full_name: string; preferred_name: string | null; email: string | null; phone: string | null; birth_date: string | null; status: "active" | "inactive" },
        { id?: string; organization_id: string; auth_user_id?: string | null; full_name: string; preferred_name?: string | null; email?: string | null; phone?: string | null; birth_date?: string | null; status?: "active" | "inactive"; created_at?: string; updated_at?: string }
      >;
      care_episodes: Table<
        Timestamped & { id: string; organization_id: string; patient_id: string; doctor_id: string; procedure_name: string; procedure_date: string | null; status: "planned" | "preoperative" | "postoperative" | "completed" | "cancelled"; started_at: string | null; ended_at: string | null },
        { id?: string; organization_id: string; patient_id: string; doctor_id: string; procedure_name: string; procedure_date?: string | null; status?: "planned" | "preoperative" | "postoperative" | "completed" | "cancelled"; started_at?: string | null; ended_at?: string | null; created_at?: string; updated_at?: string }
      >;
      conversations: Table<
        Timestamped & { id: string; organization_id: string; patient_id: string; care_episode_id: string | null; status: "open" | "closed" | "archived"; mode: "ai" | "waiting_doctor" | "doctor"; last_message_at: string | null; generation_started_at: string | null },
        { id?: string; organization_id: string; patient_id: string; care_episode_id?: string | null; status?: "open" | "closed" | "archived"; mode?: "ai" | "waiting_doctor" | "doctor"; last_message_at?: string | null; generation_started_at?: string | null; created_at?: string; updated_at?: string }
      >;
      messages: Table<
        { id: string; organization_id: string; conversation_id: string; sender_type: "patient" | "ai" | "doctor" | "staff" | "system"; sender_user_id: string | null; content: string; metadata: Json; client_message_id: string | null; created_at: string },
        { id?: string; organization_id: string; conversation_id: string; sender_type: "patient" | "ai" | "doctor" | "staff" | "system"; sender_user_id?: string | null; content: string; metadata?: Json; client_message_id?: string | null; created_at?: string }
      >;
      red_flag_rules: Table<
        Timestamped & { id: string; organization_id: string; created_by: string | null; name: string; description: string | null; severity: "low" | "medium" | "high" | "critical"; status: "active" | "inactive"; configuration: Json },
        { id?: string; organization_id: string; created_by?: string | null; name: string; description?: string | null; severity?: "low" | "medium" | "high" | "critical"; status?: "active" | "inactive"; configuration?: Json; created_at?: string; updated_at?: string }
      >;
      red_flag_events: Table<
        Timestamped & { id: string; organization_id: string; rule_id: string | null; conversation_id: string; message_id: string | null; severity: "low" | "medium" | "high" | "critical"; status: "new" | "acknowledged" | "resolved" | "dismissed"; metadata: Json; acknowledged_by: string | null; acknowledged_at: string | null },
        { id?: string; organization_id: string; rule_id?: string | null; conversation_id: string; message_id?: string | null; severity: "low" | "medium" | "high" | "critical"; status?: "new" | "acknowledged" | "resolved" | "dismissed"; metadata?: Json; acknowledged_by?: string | null; acknowledged_at?: string | null; created_at?: string; updated_at?: string }
      >;
      audit_logs: Table<
        { id: string; organization_id: string | null; actor_user_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Json; created_at: string },
        { id?: string; organization_id?: string | null; actor_user_id?: string | null; action: string; entity_type: string; entity_id?: string | null; metadata?: Json; created_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_care_episode: {
        Args: { target_patient_id: string; target_doctor_id: string; target_procedure_name: string; target_procedure_date?: string | null; target_status?: "planned" | "preoperative" | "postoperative" | "completed" | "cancelled" };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      member_status: MemberStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
