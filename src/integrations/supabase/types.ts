export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adventure_games: {
        Row: {
          created_at: string
          description: string | null
          frame_index: number | null
          id: string
          name: string
          owner_id: string
          subtopic: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frame_index?: number | null
          id?: string
          name: string
          owner_id: string
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frame_index?: number | null
          id?: string
          name?: string
          owner_id?: string
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      adventure_scene_questions: {
        Row: {
          claim_once: boolean
          created_at: string
          id: string
          marks: number
          order_index: number
          question_payload: Json
          scene_id: string
          updated_at: string
          vault_id: string | null
        }
        Insert: {
          claim_once?: boolean
          created_at?: string
          id?: string
          marks?: number
          order_index?: number
          question_payload?: Json
          scene_id: string
          updated_at?: string
          vault_id?: string | null
        }
        Update: {
          claim_once?: boolean
          created_at?: string
          id?: string
          marks?: number
          order_index?: number
          question_payload?: Json
          scene_id?: string
          updated_at?: string
          vault_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adventure_scene_questions_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "adventure_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      adventure_scenes: {
        Row: {
          background_ref: Json | null
          config: Json
          created_at: string
          game_id: string
          id: string
          kind: string
          layout_json: Json
          notebook_id: string | null
          order_index: number
          required_progress: number
          title: string | null
          updated_at: string
        }
        Insert: {
          background_ref?: Json | null
          config?: Json
          created_at?: string
          game_id: string
          id?: string
          kind: string
          layout_json?: Json
          notebook_id?: string | null
          order_index?: number
          required_progress?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          background_ref?: Json | null
          config?: Json
          created_at?: string
          game_id?: string
          id?: string
          kind?: string
          layout_json?: Json
          notebook_id?: string | null
          order_index?: number
          required_progress?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_scenes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "adventure_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_scenes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answer_keys: {
        Row: {
          assessment_id: string
          created_at: string
          lines: Json
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          lines?: Json
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          lines?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answer_keys_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_progress: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          score: number
          solved_lines: Json
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          score?: number
          solved_lines?: Json
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          score?: number
          solved_lines?: Json
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_progress_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          kind: string
          notebook_id: string | null
          owner_id: string
          questions: Json
          score_label: string
          section_id: string | null
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          kind?: string
          notebook_id?: string | null
          owner_id: string
          questions?: Json
          score_label?: string
          section_id?: string | null
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          kind?: string
          notebook_id?: string | null
          owner_id?: string
          questions?: Json
          score_label?: string
          section_id?: string | null
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_invitations: {
        Row: {
          class_id: string
          created_at: string
          id: string
          invitee_user_id: string
          status: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          invitee_user_id: string
          status?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          invitee_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_invitations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_join_codes: {
        Row: {
          class_id: string
          created_at: string
          join_code: string
        }
        Insert: {
          class_id: string
          created_at?: string
          join_code: string
        }
        Update: {
          class_id?: string
          created_at?: string
          join_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_join_codes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_join_requests: {
        Row: {
          class_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_join_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_lesson_notes: {
        Row: {
          added_at: string
          class_id: string
          id: string
          notebook_id: string
          visibility: string
        }
        Insert: {
          added_at?: string
          class_id: string
          id?: string
          notebook_id: string
          visibility?: string
        }
        Update: {
          added_at?: string
          class_id?: string
          id?: string
          notebook_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_lesson_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_lesson_notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_smartboard_state: {
        Row: {
          active_student_id: string | null
          class_id: string
          notebook_id: string | null
          state_json: Json
          updated_at: string
        }
        Insert: {
          active_student_id?: string | null
          class_id: string
          notebook_id?: string | null
          state_json?: Json
          updated_at?: string
        }
        Update: {
          active_student_id?: string | null
          class_id?: string
          notebook_id?: string | null
          state_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_smartboard_state_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_code: string
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          school: string | null
          smartboard_visibility: string
          updated_at: string
        }
        Insert: {
          class_code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          school?: string | null
          smartboard_visibility?: string
          updated_at?: string
        }
        Update: {
          class_code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          school?: string | null
          smartboard_visibility?: string
          updated_at?: string
        }
        Relationships: []
      }
      floating_assistant_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          owner_id: string
          role: string
          thread_id: string
          tool_name: string | null
          tool_payload: Json | null
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          owner_id: string
          role: string
          thread_id: string
          tool_name?: string | null
          tool_payload?: Json | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          owner_id?: string
          role?: string
          thread_id?: string
          tool_name?: string | null
          tool_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "floating_assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "floating_assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      floating_assistant_threads: {
        Row: {
          created_at: string
          id: string
          notebook_id: string | null
          owner_id: string
          subsection_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notebook_id?: string | null
          owner_id: string
          subsection_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notebook_id?: string | null
          owner_id?: string
          subsection_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      floating_chip_snapshots: {
        Row: {
          chips: Json
          created_at: string
          id: string
          line_id: string
          owner_id: string
          scaffolds: Json | null
          source: string | null
          subsection_id: string
        }
        Insert: {
          chips: Json
          created_at?: string
          id?: string
          line_id: string
          owner_id: string
          scaffolds?: Json | null
          source?: string | null
          subsection_id: string
        }
        Update: {
          chips?: Json
          created_at?: string
          id?: string
          line_id?: string
          owner_id?: string
          scaffolds?: Json | null
          source?: string | null
          subsection_id?: string
        }
        Relationships: []
      }
      floating_generations: {
        Row: {
          chips: Json
          created_at: string
          elements: Json
          id: string
          law_trace: Json
          line_id: string | null
          notebook_id: string | null
          original: string
          owner_id: string
          scaffolds: Json
          status: string
          subsection_id: string | null
          updated_at: string
          verification: Json
        }
        Insert: {
          chips?: Json
          created_at?: string
          elements?: Json
          id?: string
          law_trace?: Json
          line_id?: string | null
          notebook_id?: string | null
          original: string
          owner_id?: string
          scaffolds?: Json
          status?: string
          subsection_id?: string | null
          updated_at?: string
          verification?: Json
        }
        Update: {
          chips?: Json
          created_at?: string
          elements?: Json
          id?: string
          law_trace?: Json
          line_id?: string | null
          notebook_id?: string | null
          original?: string
          owner_id?: string
          scaffolds?: Json
          status?: string
          subsection_id?: string | null
          updated_at?: string
          verification?: Json
        }
        Relationships: []
      }
      floating_knowledge_documents: {
        Row: {
          created_at: string
          filename: string
          id: string
          kind: string
          metadata: Json | null
          owner_id: string
          parsed_text: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          kind: string
          metadata?: Json | null
          owner_id: string
          parsed_text?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          kind?: string
          metadata?: Json | null
          owner_id?: string
          parsed_text?: string | null
          storage_path?: string | null
        }
        Relationships: []
      }
      floating_law_drafts: {
        Row: {
          conditions: Json
          created_at: string
          examples: Json
          exceptions: Json
          id: string
          name: string
          owner_id: string
          reason: string | null
          rule: string
          source_generation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          name: string
          owner_id?: string
          reason?: string | null
          rule: string
          source_generation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          name?: string
          owner_id?: string
          reason?: string | null
          rule?: string
          source_generation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floating_law_drafts_source_generation_id_fkey"
            columns: ["source_generation_id"]
            isOneToOne: false
            referencedRelation: "floating_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      floating_law_library: {
        Row: {
          approved_at: string
          conditions: Json
          created_at: string
          examples: Json
          exceptions: Json
          id: string
          law_number: number
          name: string
          owner_id: string
          reason: string | null
          revisions: Json
          rule: string
          source_generation_id: string | null
          superseded_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          law_number: number
          name: string
          owner_id?: string
          reason?: string | null
          revisions?: Json
          rule: string
          source_generation_id?: string | null
          superseded_by?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          law_number?: number
          name?: string
          owner_id?: string
          reason?: string | null
          revisions?: Json
          rule?: string
          source_generation_id?: string | null
          superseded_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "floating_law_library_source_generation_id_fkey"
            columns: ["source_generation_id"]
            isOneToOne: false
            referencedRelation: "floating_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      floating_restructure_events: {
        Row: {
          attachments: Json
          created_at: string
          generation_id: string
          id: string
          input_kind: string
          instruction: string | null
          owner_id: string
          scope: Json | null
        }
        Insert: {
          attachments?: Json
          created_at?: string
          generation_id: string
          id?: string
          input_kind: string
          instruction?: string | null
          owner_id?: string
          scope?: Json | null
        }
        Update: {
          attachments?: Json
          created_at?: string
          generation_id?: string
          id?: string
          input_kind?: string
          instruction?: string | null
          owner_id?: string
          scope?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "floating_restructure_events_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "floating_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_blocks: {
        Row: {
          content_ascii: string
          content_json: Json | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["block_kind"]
          order_index: number
          section_id: string
          subsection_id: string | null
          updated_at: string
        }
        Insert: {
          content_ascii?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["block_kind"]
          order_index?: number
          section_id: string
          subsection_id?: string | null
          updated_at?: string
        }
        Update: {
          content_ascii?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["block_kind"]
          order_index?: number
          section_id?: string
          subsection_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_blocks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "notebook_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_blocks_subsection_id_fkey"
            columns: ["subsection_id"]
            isOneToOne: false
            referencedRelation: "notebook_subsections"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_sections: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["section_kind"]
          notebook_id: string
          order_index: number
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["section_kind"]
          notebook_id: string
          order_index?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["section_kind"]
          notebook_id?: string
          order_index?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebook_sections_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_subsections: {
        Row: {
          created_at: string
          floating_bucket: Json | null
          floating_highlights: Json | null
          floating_lines: Json
          floating_scoring: Json | null
          id: string
          order_index: number
          section_id: string
        }
        Insert: {
          created_at?: string
          floating_bucket?: Json | null
          floating_highlights?: Json | null
          floating_lines?: Json
          floating_scoring?: Json | null
          id?: string
          order_index?: number
          section_id: string
        }
        Update: {
          created_at?: string
          floating_bucket?: Json | null
          floating_highlights?: Json | null
          floating_lines?: Json
          floating_scoring?: Json | null
          id?: string
          order_index?: number
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_subsections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "notebook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          class_name: string
          color_index: number
          created_at: string
          document_json: Json | null
          id: string
          owner_id: string
          paper_size: string
          paper_style: string
          purpose: string
          session: string
          subject: string
          subtopic: string
          teacher: string
          title: string | null
          updated_at: string
          zoom: number
        }
        Insert: {
          class_name?: string
          color_index?: number
          created_at?: string
          document_json?: Json | null
          id?: string
          owner_id: string
          paper_size?: string
          paper_style?: string
          purpose?: string
          session?: string
          subject?: string
          subtopic?: string
          teacher?: string
          title?: string | null
          updated_at?: string
          zoom?: number
        }
        Update: {
          class_name?: string
          color_index?: number
          created_at?: string
          document_json?: Json | null
          id?: string
          owner_id?: string
          paper_size?: string
          paper_style?: string
          purpose?: string
          session?: string
          subject?: string
          subtopic?: string
          teacher?: string
          title?: string | null
          updated_at?: string
          zoom?: number
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          best_score: number
          coins: number
          levels_cleared: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_score?: number
          coins?: number
          levels_cleared?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_score?: number
          coins?: number
          levels_cleared?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          mathgpl_student_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          mathgpl_student_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          mathgpl_student_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_class_invitation: {
        Args: { _invitation_id: string }
        Returns: string
      }
      can_access_realtime_topic: { Args: { _topic: string }; Returns: boolean }
      generate_mathgpl_id: { Args: never; Returns: string }
      get_class_join_code: { Args: { _class_id: string }; Returns: string }
      get_class_join_request_profiles: {
        Args: { _class_id: string }
        Returns: {
          display_name: string
          mathgpl_student_id: string
          user_id: string
        }[]
      }
      get_class_member_names: {
        Args: { _class_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      get_owned_class_codes: {
        Args: never
        Returns: {
          id: string
          join_code: string
        }[]
      }
      is_class_member: { Args: { _class_id: string }; Returns: boolean }
      is_class_owner: { Args: { _class_id: string }; Returns: boolean }
      lookup_class_by_code: {
        Args: { code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      lookup_profile_by_student_id: {
        Args: { _student_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      notebook_shared_to_member: {
        Args: { _notebook_id: string }
        Returns: boolean
      }
      shares_class_with: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      block_kind: "problem" | "solution" | "reasoning" | "text"
      section_kind:
        | "introduction"
        | "explanation"
        | "example"
        | "exercise"
        | "classwork"
        | "homework"
        | "summary"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      block_kind: ["problem", "solution", "reasoning", "text"],
      section_kind: [
        "introduction",
        "explanation",
        "example",
        "exercise",
        "classwork",
        "homework",
        "summary",
      ],
    },
  },
} as const
