// Types for the parts of the schema the app uses so far. Once a Supabase
// project is linked, replace with the generated file:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type AppRole = "tenant" | "staff" | "driver" | "admin";
export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: AccountStatus;
  unit: string | null;
  room_letter: string | null;
  floor: number | null;
  phone: string | null;
  shuttle_alerts: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileUpdate = Partial<
  Pick<Profile, "full_name" | "unit" | "room_letter" | "floor" | "phone" | "shuttle_alerts">
>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: never;
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      review_tenant: {
        Args: { target: string; decision: AccountStatus; note?: string | null };
        Returns: Profile;
      };
      set_user_role: {
        Args: { target: string; new_role: AppRole };
        Returns: Profile;
      };
    };
    Enums: { app_role: AppRole; account_status: AccountStatus };
    CompositeTypes: { [_ in never]: never };
  };
};
