export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          test_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          name?: string | null;
          test_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      homes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          region: string | null;
          home_type: string | null;
          style_notes: string | null;
          whole_home_palette: Json;
          whole_home_constraints: Json;
          value_band: string | null;
          test_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          region?: string | null;
          home_type?: string | null;
          style_notes?: string | null;
          whole_home_palette?: Json;
          whole_home_constraints?: Json;
          value_band?: string | null;
          test_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["homes"]["Insert"]>;
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          home_id: string;
          name: string;
          room_type: string | null;
          purpose: string | null;
          dimensions: Json;
          ceiling_height: number | null;
          budget_range: string | null;
          style_preferences: Json;
          color_preferences: Json;
          constraints: Json;
          existing_items: Json;
          design_brief: string | null;
          status: string;
          current_stage: string;
          selected_mood_board_id: string | null;
          test_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          home_id: string;
          name: string;
          room_type?: string | null;
          purpose?: string | null;
          dimensions?: Json;
          ceiling_height?: number | null;
          budget_range?: string | null;
          style_preferences?: Json;
          color_preferences?: Json;
          constraints?: Json;
          existing_items?: Json;
          design_brief?: string | null;
          status?: string;
          current_stage?: string;
          selected_mood_board_id?: string | null;
          test_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          room_id: string;
          file_url: string;
          storage_path: string;
          label: string | null;
          angle_type: string | null;
          ai_caption: string | null;
          metadata: Json;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          file_url: string;
          storage_path: string;
          label?: string | null;
          angle_type?: string | null;
          ai_caption?: string | null;
          metadata?: Json;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
        Relationships: [];
      };
      room_analyses: {
        Row: {
          id: string;
          room_id: string;
          analysis: Json;
          version: number | null;
          status: string;
          source_photo_ids: Json;
          brief_snapshot: Json;
          quality_score: number | null;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          analysis: Json;
          version?: number | null;
          status?: string;
          source_photo_ids?: Json;
          brief_snapshot?: Json;
          quality_score?: number | null;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["room_analyses"]["Insert"]>;
        Relationships: [];
      };
      mood_boards: {
        Row: {
          id: string;
          room_id: string;
          concept_name: string;
          concept_data: Json;
          selected: boolean;
          version: number | null;
          parent_version: number | null;
          origin: string;
          status: string;
          locked_fields: Json;
          quality_score: number | null;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          concept_name: string;
          concept_data: Json;
          selected?: boolean;
          version?: number | null;
          parent_version?: number | null;
          origin?: string;
          status?: string;
          locked_fields?: Json;
          quality_score?: number | null;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mood_boards"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          room_id: string;
          mood_board_id: string | null;
          category: string;
          name: string;
          retailer: string | null;
          url: string | null;
          image_url: string | null;
          cached_image_path: string | null;
          price: number | null;
          mood_board_version: number | null;
          dimensions: Json;
          material: string | null;
          finish: string | null;
          scores: Json;
          reason_selected: string | null;
          risks: Json;
          alternatives: Json;
          status: string;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          mood_board_id?: string | null;
          category: string;
          name: string;
          retailer?: string | null;
          url?: string | null;
          image_url?: string | null;
          cached_image_path?: string | null;
          price?: number | null;
          mood_board_version?: number | null;
          dimensions?: Json;
          material?: string | null;
          finish?: string | null;
          scores?: Json;
          reason_selected?: string | null;
          risks?: Json;
          alternatives?: Json;
          status?: string;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      renders: {
        Row: {
          id: string;
          room_id: string;
          mood_board_id: string | null;
          mood_board_version: number | null;
          source_photo_id: string | null;
          file_url: string | null;
          prompt: string;
          render_prompt: string | null;
          preservation_constraints: Json;
          transformation_instructions: Json;
          negative_instructions: Json;
          user_regeneration_instructions: string | null;
          generated_image_path: string | null;
          status: string;
          critique: Json;
          quality_score: number | null;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          mood_board_id?: string | null;
          mood_board_version?: number | null;
          source_photo_id?: string | null;
          file_url?: string | null;
          prompt: string;
          render_prompt?: string | null;
          preservation_constraints?: Json;
          transformation_instructions?: Json;
          negative_instructions?: Json;
          user_regeneration_instructions?: string | null;
          generated_image_path?: string | null;
          status?: string;
          critique?: Json;
          quality_score?: number | null;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["renders"]["Insert"]>;
        Relationships: [];
      };
      revisions: {
        Row: {
          id: string;
          room_id: string;
          user_message: string;
          assistant_response: string;
          revision_type: string;
          state_before: Json;
          state_after: Json;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_message: string;
          assistant_response: string;
          revision_type: string;
          state_before?: Json;
          state_after?: Json;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["revisions"]["Insert"]>;
        Relationships: [];
      };
      design_memories: {
        Row: {
          id: string;
          scope: string;
          scope_id: string;
          memory_type: string;
          content: Json;
          test_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: string;
          scope_id: string;
          memory_type: string;
          content: Json;
          test_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["design_memories"]["Insert"]>;
        Relationships: [];
      };
      ai_runs: {
        Row: {
          id: string;
          room_id: string | null;
          service_name: string;
          prompt_version: string;
          provider: string | null;
          model_name: string | null;
          status: string;
          input_payload: Json;
          output_payload: Json;
          raw_input: string | null;
          raw_output: string | null;
          validation_errors: Json;
          quality_score: number | null;
          token_estimate: number | null;
          cost_estimate: number | null;
          latency_ms: number | null;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id?: string | null;
          service_name: string;
          prompt_version: string;
          provider?: string | null;
          model_name?: string | null;
          status?: string;
          input_payload?: Json;
          output_payload?: Json;
          raw_input?: string | null;
          raw_output?: string | null;
          validation_errors?: Json;
          quality_score?: number | null;
          token_estimate?: number | null;
          cost_estimate?: number | null;
          latency_ms?: number | null;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_runs"]["Insert"]>;
        Relationships: [];
      };
      design_preferences: {
        Row: {
          id: string;
          home_id: string;
          preference_type: string;
          label: string;
          details: Json;
          test_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          home_id: string;
          preference_type: string;
          label: string;
          details?: Json;
          test_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["design_preferences"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          room_id: string;
          role: string;
          content: string;
          classified_intent: string | null;
          referenced_artifact_ids: Json;
          test_run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          role: string;
          content: string;
          classified_intent?: string | null;
          referenced_artifact_ids?: Json;
          test_run_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Home = Database["public"]["Tables"]["homes"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Photo = Database["public"]["Tables"]["photos"]["Row"];
export type MoodBoard = Database["public"]["Tables"]["mood_boards"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Render = Database["public"]["Tables"]["renders"]["Row"];
