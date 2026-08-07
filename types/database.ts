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
        Timestamped & { id: string; name: string; slug: string; status: "active" | "suspended" | "inactive"; timezone: string },
        { id?: string; name: string; slug: string; status?: "active" | "suspended" | "inactive"; timezone?: string; created_at?: string; updated_at?: string }
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
        Timestamped & { id: string; organization_id: string; patient_id: string; care_episode_id: string | null; status: "open" | "closed" | "archived"; mode: "ai" | "waiting_doctor" | "doctor"; last_message_at: string | null; generation_started_at: string | null; taken_over_by: string | null; taken_over_doctor_id: string | null; taken_over_at: string | null },
        { id?: string; organization_id: string; patient_id: string; care_episode_id?: string | null; status?: "open" | "closed" | "archived"; mode?: "ai" | "waiting_doctor" | "doctor"; last_message_at?: string | null; generation_started_at?: string | null; taken_over_by?: string | null; taken_over_doctor_id?: string | null; taken_over_at?: string | null; created_at?: string; updated_at?: string }
      >;
      messages: Table<
        { id: string; organization_id: string; conversation_id: string; sender_type: "patient" | "ai" | "doctor" | "staff" | "system"; sender_user_id: string | null; content: string; metadata: Json; client_message_id: string | null; scheduled_action_id: string | null; created_at: string },
        { id?: string; organization_id: string; conversation_id: string; sender_type: "patient" | "ai" | "doctor" | "staff" | "system"; sender_user_id?: string | null; content: string; metadata?: Json; client_message_id?: string | null; scheduled_action_id?: string | null; created_at?: string }
      >;
      red_flag_rules: Table<
        Timestamped & { id: string; organization_id: string; created_by: string | null; name: string; description: string | null; severity: "low" | "medium" | "high" | "critical"; status: "active" | "inactive"; configuration: Json },
        { id?: string; organization_id: string; created_by?: string | null; name: string; description?: string | null; severity?: "low" | "medium" | "high" | "critical"; status?: "active" | "inactive"; configuration?: Json; created_at?: string; updated_at?: string }
      >;
      red_flag_events: Table<
        Timestamped & { id: string; organization_id: string; rule_id: string | null; conversation_id: string; message_id: string | null; patient_id: string | null; severity: "low" | "medium" | "high" | "critical"; status: "new" | "acknowledged" | "resolved" | "dismissed"; metadata: Json; acknowledged_by: string | null; acknowledged_at: string | null; resolved_by: string | null; resolved_at: string | null },
        { id?: string; organization_id: string; rule_id?: string | null; conversation_id: string; message_id?: string | null; patient_id?: string | null; severity: "low" | "medium" | "high" | "critical"; status?: "new" | "acknowledged" | "resolved" | "dismissed"; metadata?: Json; acknowledged_by?: string | null; acknowledged_at?: string | null; resolved_by?: string | null; resolved_at?: string | null; created_at?: string; updated_at?: string }
      >;
      audit_logs: Table<
        { id: string; organization_id: string | null; actor_user_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Json; created_at: string },
        { id?: string; organization_id?: string | null; actor_user_id?: string | null; action: string; entity_type: string; entity_id?: string | null; metadata?: Json; created_at?: string }
      >;
      automation_flows: Table<
        Timestamped & { id:string;organization_id:string;name:string;description:string|null;status:"draft"|"active"|"inactive";version:number;created_by:string|null },
        { id?:string;organization_id:string;name:string;description?:string|null;status?:"draft"|"active"|"inactive";version?:number;created_by?:string|null;created_at?:string;updated_at?:string }
      >;
      automation_steps: Table<
        Timestamped & { id:string;organization_id:string;flow_id:string;position:number;name:string;anchor:"episode_started_at"|"procedure_date";delay_value:number;delay_unit:"minutes"|"hours"|"days"|"weeks";message_content:string;is_active:boolean },
        { id?:string;organization_id:string;flow_id:string;position:number;name:string;anchor:"episode_started_at"|"procedure_date";delay_value:number;delay_unit:"minutes"|"hours"|"days"|"weeks";message_content:string;is_active?:boolean;created_at?:string;updated_at?:string }
      >;
      episode_automations: Table<
        Timestamped & { id:string;organization_id:string;care_episode_id:string;flow_id:string;flow_version:number;status:"scheduled"|"active"|"paused"|"completed"|"cancelled";started_at:string;paused_at:string|null;completed_at:string|null;created_by:string|null },
        { id?:string;organization_id:string;care_episode_id:string;flow_id:string;flow_version:number;status?:"scheduled"|"active"|"paused"|"completed"|"cancelled";started_at?:string;paused_at?:string|null;completed_at?:string|null;created_by?:string|null;created_at?:string;updated_at?:string }
      >;
      scheduled_actions: Table<
        Timestamped & { id:string;organization_id:string;episode_automation_id:string;automation_step_id:string|null;step_position:number;step_name:string;message_content:string;scheduled_for:string;status:"pending"|"processing"|"completed"|"failed"|"cancelled";claimed_at:string|null;executed_at:string|null;message_id:string|null;attempt_count:number;last_error:string|null },
        { id?:string;organization_id:string;episode_automation_id:string;automation_step_id?:string|null;step_position:number;step_name:string;message_content:string;scheduled_for:string;status?:"pending"|"processing"|"completed"|"failed"|"cancelled";claimed_at?:string|null;executed_at?:string|null;message_id?:string|null;attempt_count?:number;last_error?:string|null;created_at?:string;updated_at?:string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_care_episode: {
        Args: { target_patient_id: string; target_doctor_id: string; target_procedure_name: string; target_procedure_date?: string | null; target_status?: "planned" | "preoperative" | "postoperative" | "completed" | "cancelled" };
        Returns: string;
      };
      take_over_conversation: { Args: { target_conversation_id: string }; Returns: boolean };
      send_doctor_message: { Args: { target_conversation_id: string; message_content: string; target_client_message_id: string }; Returns: string };
      resume_ai_conversation: { Args: { target_conversation_id: string }; Returns: boolean };
      resolve_red_flag: { Args: { target_event_id: string }; Returns: boolean };
      assign_automation: { Args: { target_episode_id:string;target_flow_id:string }; Returns:string };
      set_episode_automation_status: { Args: { target_assignment_id:string;target_status:"scheduled"|"active"|"paused"|"completed"|"cancelled" }; Returns:boolean };
      claim_due_automation_actions: { Args: { batch_size?:number }; Returns: Database["public"]["Tables"]["scheduled_actions"]["Row"][] };
      complete_automation_action: { Args: { target_action_id:string }; Returns:string|null };
      fail_automation_action: { Args: { target_action_id:string;error_code:string }; Returns:undefined };
    };
    Enums: {
      app_role: AppRole;
      member_status: MemberStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
