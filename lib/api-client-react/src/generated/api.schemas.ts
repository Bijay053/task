/**
 * Task Management Portal API — Type Schemas
 */

export interface HealthStatus { status: string; }
export interface MessageResponse { message: string; }

export interface LoginRequest { email: string; password: string; }

export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  availability_status: string;
  created_at: string;
}

export interface UserAvailabilityUpdate {
  availability_status: string;
}

/** External agent / sub-agent / partner */
export interface AgentOut {
  id: number;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
}
export interface AgentCreate { name: string; company_name?: string; email?: string; phone?: string; country?: string; notes?: string; }
export interface AgentUpdate { name?: string; company_name?: string; email?: string; phone?: string; country?: string; notes?: string; is_active?: boolean; }

/** Department settings */
export interface DeptSettingOut { id: number; department: string; key: string; value?: string | null; }
export interface DeptSettingUpdate { value?: string | null; }

export interface Token {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface UserCreate { email: string; full_name: string; password: string; role?: string; }
export interface UserUpdate { email?: string; full_name?: string; role?: string; is_active?: boolean; password?: string; }

export interface StudentOut {
  id: number; full_name: string; passport_no?: string | null; dob?: string | null;
  phone?: string | null; email?: string | null; created_at: string;
}
export interface StudentCreate { full_name: string; passport_no?: string; dob?: string; phone?: string; email?: string; }
export interface StudentUpdate { full_name?: string; passport_no?: string; dob?: string; phone?: string; email?: string; }

export interface UniversityOut { id: number; name: string; country?: string | null; created_at: string; }
export interface UniversityCreate { name: string; country?: string; }
export interface UniversityUpdate { name?: string; country?: string; }

export interface ApplicationOut {
  id: number;
  department: string;
  student_id?: number | null;
  university_id?: number | null;
  agent_id?: number | null;
  assigned_to_id?: number | null;
  created_by_id?: number | null;
  application_status: string;
  assigned_date?: string | null;
  intake?: string | null;
  course?: string | null;
  country?: string | null;
  remarks?: string | null;
  /** Raw fallback names */
  student_name?: string | null;
  university_name?: string | null;
  /** GS-specific */
  priority?: string | null;
  source?: string | null;
  submitted_date?: string | null;
  verification?: string | null;
  /** Offer-specific */
  channel?: string | null;
  offer_applied_date?: string | null;
  offer_received_date?: string | null;
  created_at: string;
  updated_at: string;
  agent?: AgentOut | null;
  student?: StudentOut | null;
  university?: UniversityOut | null;
  assigned_to?: UserOut | null;
  created_by?: UserOut | null;
}

export interface ApplicationCreate {
  department?: string;
  student_id?: number | null;
  university_id?: number | null;
  student_name?: string | null;
  university_name?: string | null;
  agent_id?: number | null;
  assigned_to_id?: number | null;
  application_status?: string;
  intake?: string;
  course?: string;
  country?: string;
  remarks?: string;
  priority?: string;
  source?: string;
  submitted_date?: string | null;
  verification?: string | null;
  channel?: string | null;
  offer_applied_date?: string | null;
  offer_received_date?: string | null;
}

export interface ApplicationUpdate {
  university_id?: number | null;
  university_name?: string | null;
  agent_id?: number | null;
  assigned_to_id?: number | null;
  application_status?: string;
  intake?: string;
  course?: string;
  country?: string;
  remarks?: string;
  priority?: string;
  source?: string;
  submitted_date?: string | null;
  verification?: string | null;
  channel?: string | null;
  offer_applied_date?: string | null;
  offer_received_date?: string | null;
}

export interface StatusUpdate { application_status: string; }
export interface AssignUpdate { assigned_to_id?: number | null; }

export interface ActivityLogOut {
  id: number; application_id: number; field_name: string;
  old_value?: string | null; new_value?: string | null; changed_at: string;
  changed_by_user?: UserOut | null;
}

export interface DashboardSummary { total: number; pending: number; approved: number; refused: number; }
export interface StatusCount { status: string; count: number; color: string; }
export interface AssigneeCount { assignee_name: string; count: number; }
export interface UniversityCount { university_name: string; count: number; }
export interface NotificationTest { type: string; target: string; }

/** Dynamic statuses */
export interface AppStatusOut {
  id: number;
  department: string;
  name: string;
  text_color: string;
  bg_color: string;
  sort_order: number;
  is_active: boolean;
}
export interface AppStatusCreate { department: string; name: string; text_color?: string; bg_color?: string; }
export interface AppStatusUpdate { name?: string; text_color?: string; bg_color?: string; is_active?: boolean; }
export interface AppStatusReorder { ordered_ids: number[]; }

/** Department permissions */
export interface UserDeptPermOut { id: number; user_id: number; department: string; can_view: boolean; can_edit: boolean; can_delete: boolean; can_upload: boolean; }
export interface UserDeptPermUpdate { can_view: boolean; can_edit: boolean; can_delete: boolean; can_upload: boolean; }

/** Performance reports */
export interface StaffPerformance {
  user_id: number; full_name: string; role: string;
  total_assigned: number; gs_count: number; offer_count: number;
  status_breakdown: Record<string, number>;
}

/** Bulk upload */
export interface BulkUploadResult { created: number; skipped: number; errors: string[]; }

/** Time-based performance reports */
export interface StaffTimingReport {
  user_id: number;
  full_name: string;
  role: string;
  total_gs: number;
  pending_gs: number;
  completed_gs: number;
  avg_handling_days: number | null;
  avg_completion_days: number | null;
  avg_first_action_days: number | null;
  avg_stage_days: Record<string, number> | null;
}

export interface StageReport {
  status: string;
  department: string;
  total_transitions: number;
  avg_days: number | null;
  min_days: number | null;
  max_days: number | null;
  currently_in_stage: number;
}

export interface AppTimeline {
  application_id: number;
  student_name: string;
  current_status: string;
  created_at: string;
  total_days: number;
  assigned_to: string | null;
  stages: Array<{
    status: string | null;
    entered_at: string;
    exited_at: string | null;
    duration_days: number;
    changed_by: string | null;
  }>;
}

export type ListStudentsParams = { search?: string };
export type ListUniversitiesParams = { search?: string };
export type ListApplicationsParams = { department?: string; assigned_to_id?: number; agent_id?: number; status?: string; search?: string };
export type MyApplicationsParams = { department?: string };
export type ListStatusesParams = { department?: string; include_inactive?: boolean };
export type PerformanceReportParams = { department?: string };
export type ListAgentsParams = { search?: string };
