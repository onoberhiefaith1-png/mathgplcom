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
      academies: {
        Row: {
          created_at: string
          featured_title: string
          id: string
          name: string
          org_id: string | null
          owner_id: string
          template: string
          updated_at: string
          welcome_message: string
        }
        Insert: {
          created_at?: string
          featured_title?: string
          id?: string
          name?: string
          org_id?: string | null
          owner_id: string
          template?: string
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          created_at?: string
          featured_title?: string
          id?: string
          name?: string
          org_id?: string | null
          owner_id?: string
          template?: string
          updated_at?: string
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "academies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_categories: {
        Row: {
          accent: string | null
          created_at: string
          created_by: string | null
          description: string
          icon_url: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          name: string
          position: number
          room_id: string
          updated_at: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          room_id: string
          updated_at?: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_categories_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "academy_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_placements: {
        Row: {
          badge: string | null
          created_at: string
          created_by: string | null
          description_override: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_visible: boolean
          position: number
          product_id: string
          product_kind: string
          subtopic_id: string
          title_override: string | null
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          description_override?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_visible?: boolean
          position?: number
          product_id: string
          product_kind: string
          subtopic_id: string
          title_override?: string | null
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          description_override?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_visible?: boolean
          position?: number
          product_id?: string
          product_kind?: string
          subtopic_id?: string
          title_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_placements_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "academy_subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_rooms: {
        Row: {
          academy_id: string
          accent: string | null
          created_at: string
          created_by: string | null
          description: string
          icon_url: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          name: string
          position: number
          room_type: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          accent?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          room_type?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          accent?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          room_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_rooms_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_subtopics: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          icon_url: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          name: string
          position: number
          topic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          topic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "academy_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_topics: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          icon_url: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "academy_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      account_ids: {
        Row: {
          acronym: string | null
          created_at: string
          custom_id: string | null
          custom_id_history: Json
          custom_id_updated_at: string | null
          id: string
          mathgpl_id: string
          org_id: string | null
          prefix: string
          role: Database["public"]["Enums"]["app_role"]
          seq: number
          share_code: string
          user_id: string
        }
        Insert: {
          acronym?: string | null
          created_at?: string
          custom_id?: string | null
          custom_id_history?: Json
          custom_id_updated_at?: string | null
          id?: string
          mathgpl_id: string
          org_id?: string | null
          prefix: string
          role: Database["public"]["Enums"]["app_role"]
          seq: number
          share_code?: string
          user_id: string
        }
        Update: {
          acronym?: string | null
          created_at?: string
          custom_id?: string | null
          custom_id_history?: Json
          custom_id_updated_at?: string | null
          id?: string
          mathgpl_id?: string
          org_id?: string | null
          prefix?: string
          role?: Database["public"]["Enums"]["app_role"]
          seq?: number
          share_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_ids_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_log: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          target_role: string | null
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          target_role?: string | null
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          target_role?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
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
      adventure_group_members: {
        Row: {
          class_id: string
          created_at: string
          game_id: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          game_id: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          game_id?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_group_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "adventure_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      adventure_groups: {
        Row: {
          class_id: string
          completed_at: string | null
          created_at: string
          eliminated_at_scene_id: string | null
          game_id: string
          id: string
          is_primary: boolean
          name: string
          position_x: number | null
          position_y: number | null
          progress_element_id: string
          qualified: boolean
          source_element_id: string | null
          style_color: string | null
          style_preset_id: string | null
          style_scale: number | null
          updated_at: string
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          created_at?: string
          eliminated_at_scene_id?: string | null
          game_id: string
          id?: string
          is_primary?: boolean
          name: string
          position_x?: number | null
          position_y?: number | null
          progress_element_id: string
          qualified?: boolean
          source_element_id?: string | null
          style_color?: string | null
          style_preset_id?: string | null
          style_scale?: number | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          created_at?: string
          eliminated_at_scene_id?: string | null
          game_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          position_x?: number | null
          position_y?: number | null
          progress_element_id?: string
          qualified?: boolean
          source_element_id?: string | null
          style_color?: string | null
          style_preset_id?: string | null
          style_scale?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      adventure_live_sessions: {
        Row: {
          assessment_id: string
          class_id: string
          created_at: string
          game_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          question_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          class_id: string
          created_at?: string
          game_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          question_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          class_id?: string
          created_at?: string
          game_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          question_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_live_sessions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_live_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_live_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
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
      archived_features: {
        Row: {
          archived: boolean
          created_at: string
          display_name: string
          feature_key: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          display_name: string
          feature_key: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          display_name?: string
          feature_key?: string
          updated_at?: string
        }
        Relationships: []
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
      assessment_board_state: {
        Row: {
          active_line_idx: number
          assessment_id: string
          author: string | null
          created_at: string
          question_id: string | null
          state_json: Json
          student_id: string
          updated_at: string
        }
        Insert: {
          active_line_idx?: number
          assessment_id: string
          author?: string | null
          created_at?: string
          question_id?: string | null
          state_json?: Json
          student_id: string
          updated_at?: string
        }
        Update: {
          active_line_idx?: number
          assessment_id?: string
          author?: string | null
          created_at?: string
          question_id?: string | null
          state_json?: Json
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_board_state_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
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
          per_question: Json
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
          per_question?: Json
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
          per_question?: Json
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
      assessment_question_board_state: {
        Row: {
          active_line_idx: number
          assessment_id: string
          author: string | null
          created_at: string
          question_id: string
          state_json: Json
          student_id: string
          updated_at: string
        }
        Insert: {
          active_line_idx?: number
          assessment_id: string
          author?: string | null
          created_at?: string
          question_id: string
          state_json?: Json
          student_id: string
          updated_at?: string
        }
        Update: {
          active_line_idx?: number
          assessment_id?: string
          author?: string | null
          created_at?: string
          question_id?: string
          state_json?: Json
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessment_student_questions: {
        Row: {
          answer_body: string | null
          answered_at: string | null
          answered_by: string | null
          assessment_id: string
          board_question_id: string | null
          body: string
          class_id: string
          created_at: string
          id: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          answer_body?: string | null
          answered_at?: string | null
          answered_by?: string | null
          assessment_id: string
          board_question_id?: string | null
          body: string
          class_id: string
          created_at?: string
          id?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          answer_body?: string | null
          answered_at?: string | null
          answered_by?: string | null
          assessment_id?: string
          board_question_id?: string | null
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_student_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_student_questions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_timer_attempts: {
        Row: {
          assessment_id: string
          attempt_lines: Json
          attempt_no: number
          completed_at: string | null
          created_at: string
          elapsed_ms: number
          id: string
          question_id: string
          running: boolean
          started_at: string | null
          student_id: string
          success: boolean
          updated_at: string
        }
        Insert: {
          assessment_id: string
          attempt_lines?: Json
          attempt_no?: number
          completed_at?: string | null
          created_at?: string
          elapsed_ms?: number
          id?: string
          question_id: string
          running?: boolean
          started_at?: string | null
          student_id: string
          success?: boolean
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          attempt_lines?: Json
          attempt_no?: number
          completed_at?: string | null
          created_at?: string
          elapsed_ms?: number
          id?: string
          question_id?: string
          running?: boolean
          started_at?: string | null
          student_id?: string
          success?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_timer_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assigned_at: string | null
          assignment_id: string | null
          class_id: string
          closes_at: string | null
          created_at: string
          due_at: string | null
          id: string
          kind: string
          notebook_id: string | null
          opens_at: string | null
          owner_id: string
          question_key: string | null
          questions: Json
          score_label: string
          section_id: string | null
          timer_enabled: boolean
          title: string
          total_marks: number
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assignment_id?: string | null
          class_id: string
          closes_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: string
          notebook_id?: string | null
          opens_at?: string | null
          owner_id: string
          question_key?: string | null
          questions?: Json
          score_label?: string
          section_id?: string | null
          timer_enabled?: boolean
          title?: string
          total_marks?: number
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assignment_id?: string | null
          class_id?: string
          closes_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: string
          notebook_id?: string | null
          opens_at?: string | null
          owner_id?: string
          question_key?: string | null
          questions?: Json
          score_label?: string
          section_id?: string | null
          timer_enabled?: boolean
          title?: string
          total_marks?: number
          unassigned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "learning_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_managers: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      building_assets: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          thumbnail: Json | null
          updated_at: string
          version: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          thumbnail?: Json | null
          updated_at?: string
          version?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          thumbnail?: Json | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      building_classrooms: {
        Row: {
          building_id: string
          created_at: string
          door_id: string
          id: string
          kind: string
          name: string
          position: number
          surface_overrides: Json
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          door_id: string
          id?: string
          kind?: string
          name: string
          position?: number
          surface_overrides?: Json
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          door_id?: string
          id?: string
          kind?: string
          name?: string
          position?: number
          surface_overrides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_classrooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_classrooms_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: true
            referencedRelation: "building_doors"
            referencedColumns: ["id"]
          },
        ]
      }
      building_doors: {
        Row: {
          building_id: string
          content_id: string | null
          content_kind: string | null
          created_at: string
          created_by: string | null
          design: Json
          id: string
          position_along: number
          title_override: string | null
          updated_at: string
          walkway_id: string
        }
        Insert: {
          building_id: string
          content_id?: string | null
          content_kind?: string | null
          created_at?: string
          created_by?: string | null
          design?: Json
          id?: string
          position_along?: number
          title_override?: string | null
          updated_at?: string
          walkway_id: string
        }
        Update: {
          building_id?: string
          content_id?: string | null
          content_kind?: string | null
          created_at?: string
          created_by?: string | null
          design?: Json
          id?: string
          position_along?: number
          title_override?: string | null
          updated_at?: string
          walkway_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_doors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_doors_walkway_id_fkey"
            columns: ["walkway_id"]
            isOneToOne: false
            referencedRelation: "building_walkways"
            referencedColumns: ["id"]
          },
        ]
      }
      building_room_lock_attempts: {
        Row: {
          classroom_id: string
          created_at: string
          failed_count: number
          id: string
          updated_at: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          failed_count?: number
          id?: string
          updated_at?: string
          user_id: string
          window_started_at?: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          failed_count?: number
          id?: string
          updated_at?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_room_lock_attempts_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "building_classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      building_room_locks: {
        Row: {
          building_id: string
          charset: string
          classroom_id: string
          code_hash: string
          code_length: number
          created_at: string
          created_by: string | null
          id: string
          max_attempts: number | null
          retry_after_minutes: number | null
          updated_at: string
        }
        Insert: {
          building_id: string
          charset?: string
          classroom_id: string
          code_hash: string
          code_length?: number
          created_at?: string
          created_by?: string | null
          id?: string
          max_attempts?: number | null
          retry_after_minutes?: number | null
          updated_at?: string
        }
        Update: {
          building_id?: string
          charset?: string
          classroom_id?: string
          code_hash?: string
          code_length?: number
          created_at?: string
          created_by?: string | null
          id?: string
          max_attempts?: number | null
          retry_after_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_room_locks_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_room_locks_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: true
            referencedRelation: "building_classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      building_room_screens: {
        Row: {
          building_id: string
          camera_active: boolean
          camera_host_id: string | null
          classroom_id: string
          created_at: string
          id: string
          updated_at: string
          video_mime: string | null
          video_name: string | null
          video_path: string | null
        }
        Insert: {
          building_id: string
          camera_active?: boolean
          camera_host_id?: string | null
          classroom_id: string
          created_at?: string
          id?: string
          updated_at?: string
          video_mime?: string | null
          video_name?: string | null
          video_path?: string | null
        }
        Update: {
          building_id?: string
          camera_active?: boolean
          camera_host_id?: string | null
          classroom_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          video_mime?: string | null
          video_name?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_room_screens_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_room_screens_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: true
            referencedRelation: "building_classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      building_walkway_links: {
        Row: {
          building_id: string
          corridor_walkway_id: string | null
          created_at: string
          created_by: string | null
          from_position: number
          from_walkway_id: string
          id: string
          to_position: number
          to_walkway_id: string
          updated_at: string
        }
        Insert: {
          building_id: string
          corridor_walkway_id?: string | null
          created_at?: string
          created_by?: string | null
          from_position?: number
          from_walkway_id: string
          id?: string
          to_position?: number
          to_walkway_id: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          corridor_walkway_id?: string | null
          created_at?: string
          created_by?: string | null
          from_position?: number
          from_walkway_id?: string
          id?: string
          to_position?: number
          to_walkway_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_walkway_links_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_walkway_links_corridor_walkway_id_fkey"
            columns: ["corridor_walkway_id"]
            isOneToOne: false
            referencedRelation: "building_walkways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_walkway_links_from_walkway_id_fkey"
            columns: ["from_walkway_id"]
            isOneToOne: false
            referencedRelation: "building_walkways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_walkway_links_to_walkway_id_fkey"
            columns: ["to_walkway_id"]
            isOneToOne: false
            referencedRelation: "building_walkways"
            referencedColumns: ["id"]
          },
        ]
      }
      building_walkways: {
        Row: {
          building_id: string
          created_at: string
          direction: string
          end_label: string | null
          id: string
          junction_at: number
          length: number
          name: string
          parent_id: string | null
          position: number
          surface_overrides: Json
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          direction?: string
          end_label?: string | null
          id?: string
          junction_at?: number
          length?: number
          name?: string
          parent_id?: string | null
          position?: number
          surface_overrides?: Json
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          direction?: string
          end_label?: string | null
          id?: string
          junction_at?: number
          length?: number
          name?: string
          parent_id?: string | null
          position?: number
          surface_overrides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_walkways_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_walkways_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "building_walkways"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          created_at: string
          environment: Json
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          owner_id: string
          source_building_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: Json
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          owner_id: string
          source_building_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: Json
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          owner_id?: string
          source_building_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_source_building_id_fkey"
            columns: ["source_building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      class_adventure_notes: {
        Row: {
          assigned_by: string
          assignment_id: string | null
          class_id: string
          created_at: string
          due_at: string | null
          id: string
          notebook_id: string
          question_key: string | null
          section_id: string | null
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assignment_id?: string | null
          class_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          notebook_id: string
          question_key?: string | null
          section_id?: string | null
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assignment_id?: string | null
          class_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          notebook_id?: string
          question_key?: string | null
          section_id?: string | null
          unassigned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_adventure_notes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "learning_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_adventure_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_adventure_notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      class_content_nodes: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          id: string
          level: string
          name: string
          order_index: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          id?: string
          level: string
          name: string
          order_index?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          id?: string
          level?: string
          name?: string
          order_index?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_content_nodes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_content_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "class_content_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_course_assignments: {
        Row: {
          class_id: string
          course_id: string
          created_at: string
          display_order: number
          id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          course_id: string
          created_at?: string
          display_order?: number
          id?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          course_id?: string
          created_at?: string
          display_order?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_course_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      class_course_settings: {
        Row: {
          allow_revisit: boolean
          class_id: string
          created_at: string
          learning_mode: string
          updated_at: string
        }
        Insert: {
          allow_revisit?: boolean
          class_id: string
          created_at?: string
          learning_mode?: string
          updated_at?: string
        }
        Update: {
          allow_revisit?: boolean
          class_id?: string
          created_at?: string
          learning_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_course_settings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_galleries: {
        Row: {
          canvas: Json
          class_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          canvas?: Json
          class_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          canvas?: Json
          class_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_galleries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_gallery_awards: {
        Row: {
          awarded_at: string
          class_id: string
          created_at: string
          game_id: string
          group_id: string | null
          id: string
          reward_element_id: string
          updated_at: string
        }
        Insert: {
          awarded_at?: string
          class_id: string
          created_at?: string
          game_id: string
          group_id?: string | null
          id?: string
          reward_element_id: string
          updated_at?: string
        }
        Update: {
          awarded_at?: string
          class_id?: string
          created_at?: string
          game_id?: string
          group_id?: string | null
          id?: string
          reward_element_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_gallery_rewards: {
        Row: {
          asset_id: string | null
          class_id: string
          created_at: string
          duration_ms: number
          element_style: Json | null
          end_x: number
          end_y: number
          game_id: string
          id: string
          media_type: string
          opacity: number
          reward_element_id: string
          rotation: number
          scale: number
          source: string
          start_x: number
          start_y: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          class_id: string
          created_at?: string
          duration_ms?: number
          element_style?: Json | null
          end_x?: number
          end_y?: number
          game_id: string
          id?: string
          media_type?: string
          opacity?: number
          reward_element_id: string
          rotation?: number
          scale?: number
          source?: string
          start_x?: number
          start_y?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          class_id?: string
          created_at?: string
          duration_ms?: number
          element_style?: Json | null
          end_x?: number
          end_y?: number
          game_id?: string
          id?: string
          media_type?: string
          opacity?: number
          reward_element_id?: string
          rotation?: number
          scale?: number
          source?: string
          start_x?: number
          start_y?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_gallery_rewards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_game_boards: {
        Row: {
          assessment_id: string
          assignment_id: string | null
          class_id: string
          created_at: string
          game_id: string
          id: string
          notebook_id: string | null
          progress_element_id: string
          question_keys: string[]
          required_marks: number | null
          section_id: string | null
        }
        Insert: {
          assessment_id: string
          assignment_id?: string | null
          class_id: string
          created_at?: string
          game_id: string
          id?: string
          notebook_id?: string | null
          progress_element_id: string
          question_keys?: string[]
          required_marks?: number | null
          section_id?: string | null
        }
        Update: {
          assessment_id?: string
          assignment_id?: string | null
          class_id?: string
          created_at?: string
          game_id?: string
          id?: string
          notebook_id?: string | null
          progress_element_id?: string
          question_keys?: string[]
          required_marks?: number | null
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_game_boards_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_game_boards_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "learning_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_game_boards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_game_boards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_game_boards_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_game_boards_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "notebook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      class_games: {
        Row: {
          class_id: string
          created_at: string
          game_id: string
          game_mode: string
          group_completion_message: string | null
          id: string
          winner_group_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          game_id: string
          game_mode?: string
          group_completion_message?: string | null
          id?: string
          winner_group_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          game_id?: string
          game_mode?: string
          group_completion_message?: string | null
          id?: string
          winner_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_games_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
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
          node_id: string | null
          notebook_id: string
          visibility: string
        }
        Insert: {
          added_at?: string
          class_id: string
          id?: string
          node_id?: string | null
          notebook_id: string
          visibility?: string
        }
        Update: {
          added_at?: string
          class_id?: string
          id?: string
          node_id?: string | null
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
            foreignKeyName: "class_lesson_notes_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "class_content_nodes"
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
          broadcasts: Json
          class_code: string
          community_shared: boolean
          created_at: string
          description: string | null
          id: string
          lesson_note_levels: string[]
          name: string
          org_id: string | null
          owner_id: string
          schedule_days: number[]
          schedule_end_times: Json
          schedule_times: Json
          school: string | null
          smartboard_visibility: string
          time_zone: string | null
          updated_at: string
          venue_address: string | null
          venue_details: string | null
          venue_kind: string
          workspace: string
        }
        Insert: {
          broadcasts?: Json
          class_code: string
          community_shared?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lesson_note_levels?: string[]
          name: string
          org_id?: string | null
          owner_id: string
          schedule_days?: number[]
          schedule_end_times?: Json
          schedule_times?: Json
          school?: string | null
          smartboard_visibility?: string
          time_zone?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_details?: string | null
          venue_kind?: string
          workspace?: string
        }
        Update: {
          broadcasts?: Json
          class_code?: string
          community_shared?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lesson_note_levels?: string[]
          name?: string
          org_id?: string | null
          owner_id?: string
          schedule_days?: number[]
          schedule_end_times?: Json
          schedule_times?: Json
          school?: string | null
          smartboard_visibility?: string
          time_zone?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_details?: string | null
          venue_kind?: string
          workspace?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      community_downloads: {
        Row: {
          copy_id: string | null
          created_at: string
          id: string
          resource_id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          copy_id?: string | null
          created_at?: string
          id?: string
          resource_id: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          copy_id?: string | null
          created_at?: string
          id?: string
          resource_id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_downloads_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "community_resource_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_downloads_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "community_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          created_at: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "community_resource_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "community_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          moderation_state: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          moderation_state?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          moderation_state?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          attached_resource_id: string | null
          author_id: string
          body: string
          category: string
          created_at: string
          hashtags: string[]
          id: string
          is_promotion: boolean
          media_kind: string
          media_url: string | null
          moderation_reason: string | null
          moderation_state: string
          promotion_url: string | null
          status: string
          updated_at: string
          view_count: number
        }
        Insert: {
          attached_resource_id?: string | null
          author_id: string
          body: string
          category?: string
          created_at?: string
          hashtags?: string[]
          id?: string
          is_promotion?: boolean
          media_kind?: string
          media_url?: string | null
          moderation_reason?: string | null
          moderation_state?: string
          promotion_url?: string | null
          status?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          attached_resource_id?: string | null
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          hashtags?: string[]
          id?: string
          is_promotion?: boolean
          media_kind?: string
          media_url?: string | null
          moderation_reason?: string | null
          moderation_state?: string
          promotion_url?: string | null
          status?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_attached_resource_id_fkey"
            columns: ["attached_resource_id"]
            isOneToOne: false
            referencedRelation: "community_resource_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_attached_resource_id_fkey"
            columns: ["attached_resource_id"]
            isOneToOne: false
            referencedRelation: "community_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profile_views: {
        Row: {
          created_at: string
          id: string
          profile_user_id: string
          viewed_on: string
          viewer_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_user_id: string
          viewed_on?: string
          viewer_key: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_user_id?: string
          viewed_on?: string
          viewer_key?: string
        }
        Relationships: []
      }
      community_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bio_long: string | null
          country: string | null
          cover_kind: string
          cover_url: string | null
          created_at: string
          display_name: string | null
          headline: string | null
          intro_video_url: string | null
          is_listed: boolean
          location: string | null
          moderated_at: string | null
          moderation_reason: string | null
          moderation_state: string
          professional: Json
          role_kind: string | null
          updated_at: string
          user_id: string
          username: string
          view_count: number
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bio_long?: string | null
          country?: string | null
          cover_kind?: string
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          intro_video_url?: string | null
          is_listed?: boolean
          location?: string | null
          moderated_at?: string | null
          moderation_reason?: string | null
          moderation_state?: string
          professional?: Json
          role_kind?: string | null
          updated_at?: string
          user_id: string
          username: string
          view_count?: number
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bio_long?: string | null
          country?: string | null
          cover_kind?: string
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          intro_video_url?: string | null
          is_listed?: boolean
          location?: string | null
          moderated_at?: string | null
          moderation_reason?: string | null
          moderation_state?: string
          professional?: Json
          role_kind?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          view_count?: number
          years_experience?: number | null
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resource_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resource_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resource_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "community_resource_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "community_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      community_resources: {
        Row: {
          created_at: string
          description: string | null
          hashtags: string[]
          id: string
          kind: string
          owner_id: string
          payload: Json
          published_at: string
          source_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hashtags?: string[]
          id?: string
          kind: string
          owner_id: string
          payload?: Json
          published_at?: string
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hashtags?: string[]
          id?: string
          kind?: string
          owner_id?: string
          payload?: Json
          published_at?: string
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          child_confirmed_at: string | null
          child_user_id: string | null
          counterpart_accepted_at: string | null
          created_at: string
          from_user_id: string
          id: string
          message: string | null
          org_id: string | null
          relation: Database["public"]["Enums"]["connection_relation"]
          responded_at: string | null
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          child_confirmed_at?: string | null
          child_user_id?: string | null
          counterpart_accepted_at?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          message?: string | null
          org_id?: string | null
          relation: Database["public"]["Enums"]["connection_relation"]
          responded_at?: string | null
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          child_confirmed_at?: string | null
          child_user_id?: string | null
          counterpart_accepted_at?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string | null
          org_id?: string | null
          relation?: Database["public"]["Enums"]["connection_relation"]
          responded_at?: string | null
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_unit_totals: {
        Row: {
          actual_cost: number
          amount_paid: number
          category: Database["public"]["Enums"]["cost_category"]
          charge_credits: number
          cost_credits: number
          cost_unit_id: string
          customer_charge: number
          day: string
          financial_result: number
          id: string
          paid_credits: number
          profit: number
          quantity: number
          updated_at: string
        }
        Insert: {
          actual_cost?: number
          amount_paid?: number
          category: Database["public"]["Enums"]["cost_category"]
          charge_credits?: number
          cost_credits?: number
          cost_unit_id: string
          customer_charge?: number
          day: string
          financial_result?: number
          id?: string
          paid_credits?: number
          profit?: number
          quantity?: number
          updated_at?: string
        }
        Update: {
          actual_cost?: number
          amount_paid?: number
          category?: Database["public"]["Enums"]["cost_category"]
          charge_credits?: number
          cost_credits?: number
          cost_unit_id?: string
          customer_charge?: number
          day?: string
          financial_result?: number
          id?: string
          paid_credits?: number
          profit?: number
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_unit_totals_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_units: {
        Row: {
          code: string
          created_at: string
          credit_usage_enabled: boolean
          id: string
          org_id: string | null
          owner_kind: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          credit_usage_enabled?: boolean
          id?: string
          org_id?: string | null
          owner_kind: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          credit_usage_enabled?: boolean
          id?: string
          org_id?: string | null
          owner_kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_blocks: {
        Row: {
          config: Json
          created_at: string
          id: string
          kind: string
          position: number
          section_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          kind: string
          position?: number
          section_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          kind?: string
          position?: number
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_blocks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      course_exercise_questions: {
        Row: {
          block_id: string
          created_at: string
          id: string
          label: string
          notebook_id: string | null
          position: number
          question_key: string | null
          section_id: string | null
          subsection_id: string | null
          total_marks: number
          updated_at: string
        }
        Insert: {
          block_id: string
          created_at?: string
          id?: string
          label?: string
          notebook_id?: string | null
          position?: number
          question_key?: string | null
          section_id?: string | null
          subsection_id?: string | null
          total_marks?: number
          updated_at?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          id?: string
          label?: string
          notebook_id?: string | null
          position?: number
          question_key?: string | null
          section_id?: string | null
          subsection_id?: string | null
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_exercise_questions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "course_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          background_kind: string
          background_url: string | null
          certificate_mode: string
          completion_mode: string
          created_at: string
          deadline_days: number
          description: string
          id: string
          learning_days: number
          learning_mode: string
          org_id: string | null
          owner_id: string
          pass_mark: number
          status: string
          subject: string
          subtopic: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          background_kind?: string
          background_url?: string | null
          certificate_mode?: string
          completion_mode?: string
          created_at?: string
          deadline_days?: number
          description?: string
          id?: string
          learning_days?: number
          learning_mode?: string
          org_id?: string | null
          owner_id: string
          pass_mark?: number
          status?: string
          subject?: string
          subtopic?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Update: {
          background_kind?: string
          background_url?: string | null
          certificate_mode?: string
          completion_mode?: string
          created_at?: string
          deadline_days?: number
          description?: string
          id?: string
          learning_days?: number
          learning_mode?: string
          org_id?: string | null
          owner_id?: string
          pass_mark?: number
          status?: string
          subject?: string
          subtopic?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_grants: {
        Row: {
          cost_per_credit_at_purchase: number | null
          cost_unit_id: string
          credits: number
          customer_multiplier: number
          expires_at: string
          granted_at: string
          id: string
          note: string | null
          pricing_version_id: string | null
          profit_percentage_at_purchase: number | null
          purchase_id: string | null
          remaining: number
          sell_price_at_purchase: number | null
          source: string
          wallet_id: string
        }
        Insert: {
          cost_per_credit_at_purchase?: number | null
          cost_unit_id: string
          credits: number
          customer_multiplier?: number
          expires_at?: string
          granted_at?: string
          id?: string
          note?: string | null
          pricing_version_id?: string | null
          profit_percentage_at_purchase?: number | null
          purchase_id?: string | null
          remaining: number
          sell_price_at_purchase?: number | null
          source?: string
          wallet_id: string
        }
        Update: {
          cost_per_credit_at_purchase?: number | null
          cost_unit_id?: string
          credits?: number
          customer_multiplier?: number
          expires_at?: string
          granted_at?: string
          id?: string
          note?: string | null
          pricing_version_id?: string | null
          profit_percentage_at_purchase?: number | null
          purchase_id?: string | null
          remaining?: number
          sell_price_at_purchase?: number | null
          source?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_grants_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_grants_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "pricing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_grants_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "credit_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_grants_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          cost_unit_id: string
          created_at: string
          credit_lot_id: string | null
          id: string
          kind: string
          note: string | null
          pricing_version_id: string | null
          usage_event_id: string | null
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          cost_unit_id: string
          created_at?: string
          credit_lot_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          pricing_version_id?: string | null
          usage_event_id?: string | null
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          cost_unit_id?: string
          created_at?: string
          credit_lot_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          pricing_version_id?: string | null
          usage_event_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          external_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits: number
          external_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          external_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          cost_unit_id: string | null
          created_at: string
          created_by: string | null
          credits: number
          currency: string
          id: string
          note: string | null
          provider: string | null
          provider_ref: string | null
          purchased_at: string
          unit_cost: number
          user_id: string | null
        }
        Insert: {
          cost_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          credits: number
          currency?: string
          id?: string
          note?: string | null
          provider?: string | null
          provider_ref?: string | null
          purchased_at?: string
          unit_cost: number
          user_id?: string | null
        }
        Update: {
          cost_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          currency?: string
          id?: string
          note?: string | null
          provider?: string | null
          provider_ref?: string | null
          purchased_at?: string
          unit_cost?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_reservations: {
        Row: {
          consumed: number
          cost_unit_id: string
          created_at: string
          credits: number
          expires_at: string
          feature: string | null
          id: string
          operation_key: string
          settled_at: string | null
          status: string
          wallet_id: string
        }
        Insert: {
          consumed?: number
          cost_unit_id: string
          created_at?: string
          credits?: number
          expires_at?: string
          feature?: string | null
          id?: string
          operation_key: string
          settled_at?: string | null
          status?: string
          wallet_id: string
        }
        Update: {
          consumed?: number
          cost_unit_id?: string
          created_at?: string
          credits?: number
          expires_at?: string
          feature?: string | null
          id?: string
          operation_key?: string
          settled_at?: string | null
          status?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reservations_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_reservations_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_wallets: {
        Row: {
          balance: number
          cost_unit_id: string
          created_at: string
          id: string
          lifetime_purchased: number
          lifetime_spent: number
          reserved: number
          updated_at: string
        }
        Insert: {
          balance?: number
          cost_unit_id: string
          created_at?: string
          id?: string
          lifetime_purchased?: number
          lifetime_spent?: number
          reserved?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          cost_unit_id?: string
          created_at?: string
          id?: string
          lifetime_purchased?: number
          lifetime_spent?: number
          reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_wallets_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: true
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          created_at: string
          created_by: string | null
          credit_value: number
          currency: string
          effective_from: string
          exchange_rate: number
          follows_base: boolean
          id: string
          note: string | null
          profit_percentage: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_value: number
          currency: string
          effective_from?: string
          exchange_rate?: number
          follows_base?: boolean
          id?: string
          note?: string | null
          profit_percentage?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_value?: number
          currency?: string
          effective_from?: string
          exchange_rate?: number
          follows_base?: boolean
          id?: string
          note?: string | null
          profit_percentage?: number | null
        }
        Relationships: []
      }
      custom_assets: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          payload: Json
          preview_path: string | null
          section: string
          short_code: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          payload?: Json
          preview_path?: string | null
          section: string
          short_code: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          payload?: Json
          preview_path?: string | null
          section?: string
          short_code?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emoji_categories: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          order_index: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      emoji_items: {
        Row: {
          category_id: string
          created_at: string
          external_url: string | null
          glyph: string | null
          id: string
          kind: string
          name: string
          order_index: number
          owner_id: string
          storage_path: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          external_url?: string | null
          glyph?: string | null
          id?: string
          kind?: string
          name?: string
          order_index?: number
          owner_id: string
          storage_path?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          external_url?: string | null
          glyph?: string | null
          id?: string
          kind?: string
          name?: string
          order_index?: number
          owner_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emoji_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "emoji_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_entitlements: {
        Row: {
          applies_to: string[]
          category: string
          created_at: string
          id: string
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_to?: string[]
          category: string
          created_at?: string
          id?: string
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_to?: string[]
          category?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
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
          workspace: string
        }
        Insert: {
          created_at?: string
          id?: string
          notebook_id?: string | null
          owner_id: string
          subsection_id?: string | null
          title?: string | null
          updated_at?: string
          workspace?: string
        }
        Update: {
          created_at?: string
          id?: string
          notebook_id?: string | null
          owner_id?: string
          subsection_id?: string | null
          title?: string | null
          updated_at?: string
          workspace?: string
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
      floating_display_settings: {
        Row: {
          created_at: string
          id: boolean
          style: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          style?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          style?: string
          updated_at?: string
        }
        Relationships: []
      }
      floating_example_analyses: {
        Row: {
          block_id: string | null
          created_at: string
          detected_elements: Json
          example_text: string
          id: string
          lesson_topic: string | null
          notebook_id: string | null
          structures: Json
          subsection_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          detected_elements?: Json
          example_text: string
          id?: string
          lesson_topic?: string | null
          notebook_id?: string | null
          structures?: Json
          subsection_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          block_id?: string | null
          created_at?: string
          detected_elements?: Json
          example_text?: string
          id?: string
          lesson_topic?: string | null
          notebook_id?: string | null
          structures?: Json
          subsection_id?: string | null
          updated_at?: string
          user_id?: string
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
          approval_history: Json
          conditions: Json
          created_at: string
          examples: Json
          exceptions: Json
          id: string
          lesson_topics: string[]
          name: string
          owner_id: string
          reason: string | null
          rule: string
          source: string | null
          source_generation_id: string | null
          source_kind: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          approval_history?: Json
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          lesson_topics?: string[]
          name: string
          owner_id?: string
          reason?: string | null
          rule: string
          source?: string | null
          source_generation_id?: string | null
          source_kind?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          approval_history?: Json
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          lesson_topics?: string[]
          name?: string
          owner_id?: string
          reason?: string | null
          rule?: string
          source?: string | null
          source_generation_id?: string | null
          source_kind?: string
          status?: string
          tags?: string[]
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
          approval_history: Json
          approved_at: string
          conditions: Json
          created_at: string
          examples: Json
          exceptions: Json
          id: string
          law_number: number
          lesson_topics: string[]
          name: string
          owner_id: string
          reason: string | null
          revisions: Json
          rule: string
          source_generation_id: string | null
          superseded_by: string | null
          tags: string[]
          updated_at: string
          usage_count: number
          version: number
        }
        Insert: {
          approval_history?: Json
          approved_at?: string
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          law_number: number
          lesson_topics?: string[]
          name: string
          owner_id?: string
          reason?: string | null
          revisions?: Json
          rule: string
          source_generation_id?: string | null
          superseded_by?: string | null
          tags?: string[]
          updated_at?: string
          usage_count?: number
          version?: number
        }
        Update: {
          approval_history?: Json
          approved_at?: string
          conditions?: Json
          created_at?: string
          examples?: Json
          exceptions?: Json
          id?: string
          law_number?: number
          lesson_topics?: string[]
          name?: string
          owner_id?: string
          reason?: string | null
          revisions?: Json
          rule?: string
          source_generation_id?: string | null
          superseded_by?: string | null
          tags?: string[]
          updated_at?: string
          usage_count?: number
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
          law_refs: string[]
          owner_id: string
          reason: string | null
          scope: Json | null
        }
        Insert: {
          attachments?: Json
          created_at?: string
          generation_id: string
          id?: string
          input_kind: string
          instruction?: string | null
          law_refs?: string[]
          owner_id?: string
          reason?: string | null
          scope?: Json | null
        }
        Update: {
          attachments?: Json
          created_at?: string
          generation_id?: string
          id?: string
          input_kind?: string
          instruction?: string | null
          law_refs?: string[]
          owner_id?: string
          reason?: string | null
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
      game_assets: {
        Row: {
          created_at: string
          id: string
          kind: string
          media_type: string
          owner_id: string
          processed_path: string | null
          processed_status: string
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          media_type: string
          owner_id: string
          processed_path?: string | null
          processed_status?: string
          storage_path: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          media_type?: string
          owner_id?: string
          processed_path?: string | null
          processed_status?: string
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          id: string
          marks: number
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          marks?: number
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          marks?: number
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          class_id: string
          created_at: string
          ended_at: string | null
          game_id: string
          id: string
          mode: string
          segment_count: number
          started_at: string | null
          status: string
          time_limit_sec: number | null
          updated_at: string
          win_threshold: number
        }
        Insert: {
          class_id: string
          created_at?: string
          ended_at?: string | null
          game_id: string
          id?: string
          mode?: string
          segment_count?: number
          started_at?: string | null
          status?: string
          time_limit_sec?: number | null
          updated_at?: string
          win_threshold?: number
        }
        Update: {
          class_id?: string
          created_at?: string
          ended_at?: string | null
          game_id?: string
          id?: string
          mode?: string
          segment_count?: number
          started_at?: string | null
          status?: string
          time_limit_sec?: number | null
          updated_at?: string
          win_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_time_bars: {
        Row: {
          accumulated_paused_ms: number
          created_at: string
          default_duration_seconds: number
          duration_seconds: number
          game_id: string
          paused_at: string | null
          progress_element_id: string
          scheduled_start_at: string | null
          start_mode: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          accumulated_paused_ms?: number
          created_at?: string
          default_duration_seconds?: number
          duration_seconds?: number
          game_id: string
          paused_at?: string | null
          progress_element_id: string
          scheduled_start_at?: string | null
          start_mode?: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_paused_ms?: number
          created_at?: string
          default_duration_seconds?: number
          duration_seconds?: number
          game_id?: string
          paused_at?: string | null
          progress_element_id?: string
          scheduled_start_at?: string | null
          start_mode?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_time_bars_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          canvas: Json
          created_at: string
          id: string
          org_id: string | null
          owner_id: string
          subtopic: string | null
          thumbnail_path: string | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          canvas?: Json
          created_at?: string
          id?: string
          org_id?: string | null
          owner_id: string
          subtopic?: string | null
          thumbnail_path?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          canvas?: Json
          created_at?: string
          id?: string
          org_id?: string | null
          owner_id?: string
          subtopic?: string | null
          thumbnail_path?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_entitlements: {
        Row: {
          content_access: Json | null
          created_at: string
          current_period_end: string | null
          granted_items: string[]
          id: string
          owner_id: string
          owner_kind: string
          paid_amount: number | null
          paid_currency: string | null
          payment_provider: string | null
          payment_reference: string | null
          plan_id: string
          source: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          content_access?: Json | null
          created_at?: string
          current_period_end?: string | null
          granted_items?: string[]
          id?: string
          owner_id: string
          owner_kind: string
          paid_amount?: number | null
          paid_currency?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          plan_id: string
          source?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          content_access?: Json | null
          created_at?: string
          current_period_end?: string | null
          granted_items?: string[]
          id?: string
          owner_id?: string
          owner_kind?: string
          paid_amount?: number | null
          paid_currency?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          plan_id?: string
          source?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "gateway_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_payments: {
        Row: {
          amount: number
          billing_interval: string | null
          billing_mode: string
          created_at: string
          currency: string
          current_period_end: string | null
          granted_items: string[]
          id: string
          owner_id: string
          owner_kind: string
          permanent_access: boolean
          plan_description: string
          plan_id: string | null
          plan_name: string
          status: string
          stripe_account_id: string | null
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          student_id: string
          updated_at: string
          yearly_discount_percentage: number
        }
        Insert: {
          amount?: number
          billing_interval?: string | null
          billing_mode?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          granted_items?: string[]
          id?: string
          owner_id: string
          owner_kind: string
          permanent_access?: boolean
          plan_description?: string
          plan_id?: string | null
          plan_name?: string
          status?: string
          stripe_account_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          student_id: string
          updated_at?: string
          yearly_discount_percentage?: number
        }
        Update: {
          amount?: number
          billing_interval?: string | null
          billing_mode?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          granted_items?: string[]
          id?: string
          owner_id?: string
          owner_kind?: string
          permanent_access?: boolean
          plan_description?: string
          plan_id?: string | null
          plan_name?: string
          status?: string
          stripe_account_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          student_id?: string
          updated_at?: string
          yearly_discount_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "gateway_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "gateway_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_payout_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          external_account_id: string | null
          id: string
          owner_id: string
          owner_kind: string
          payments_active: boolean
          provider: string | null
          status: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          external_account_id?: string | null
          id?: string
          owner_id: string
          owner_kind: string
          payments_active?: boolean
          provider?: string | null
          status?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          external_account_id?: string | null
          id?: string
          owner_id?: string
          owner_kind?: string
          payments_active?: boolean
          provider?: string | null
          status?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gateway_plans: {
        Row: {
          auto_grant_existing: boolean
          billing_mode: string
          created_at: string
          currency: string
          description: string
          id: string
          is_published: boolean
          items: string[]
          monthly_enabled: boolean
          name: string
          one_time_enabled: boolean
          owner_id: string
          owner_kind: string
          price_amount: number | null
          slot: string
          updated_at: string
          yearly_discount_percentage: number
          yearly_enabled: boolean
        }
        Insert: {
          auto_grant_existing?: boolean
          billing_mode?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_published?: boolean
          items?: string[]
          monthly_enabled?: boolean
          name?: string
          one_time_enabled?: boolean
          owner_id: string
          owner_kind: string
          price_amount?: number | null
          slot: string
          updated_at?: string
          yearly_discount_percentage?: number
          yearly_enabled?: boolean
        }
        Update: {
          auto_grant_existing?: boolean
          billing_mode?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          is_published?: boolean
          items?: string[]
          monthly_enabled?: boolean
          name?: string
          one_time_enabled?: boolean
          owner_id?: string
          owner_kind?: string
          price_amount?: number | null
          slot?: string
          updated_at?: string
          yearly_discount_percentage?: number
          yearly_enabled?: boolean
        }
        Relationships: []
      }
      gpl_asset_sessions: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gpl_asset_subsessions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          session_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          session_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          session_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpl_asset_subsessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gpl_asset_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gpl_asset_usage: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          surface: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          surface: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpl_asset_usage_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "gpl_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      gpl_assets: {
        Row: {
          asset_type: string
          created_at: string
          description: string | null
          external_url: string | null
          glyph: string | null
          id: string
          is_active: boolean
          media_type: string
          name: string
          slug: string
          sort_order: number
          storage_path: string | null
          subsession_id: string
          updated_at: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          glyph?: string | null
          id?: string
          is_active?: boolean
          media_type?: string
          name: string
          slug: string
          sort_order?: number
          storage_path?: string | null
          subsession_id: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          glyph?: string | null
          id?: string
          is_active?: boolean
          media_type?: string
          name?: string
          slug?: string
          sort_order?: number
          storage_path?: string | null
          subsession_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpl_assets_subsession_id_fkey"
            columns: ["subsession_id"]
            isOneToOne: false
            referencedRelation: "gpl_asset_subsessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_attempts: {
        Row: {
          assessment_id: string
          block_id: string | null
          created_at: string
          guest_name: string | null
          guest_token: string
          id: string
          link_id: string
          score: number
          solved_lines: Json
          status: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          assessment_id: string
          block_id?: string | null
          created_at?: string
          guest_name?: string | null
          guest_token: string
          id?: string
          link_id: string
          score?: number
          solved_lines?: Json
          status?: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          block_id?: string | null
          created_at?: string
          guest_name?: string | null
          guest_token?: string
          id?: string
          link_id?: string
          score?: number
          solved_lines?: Json
          status?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_attempts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "guest_links"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_links: {
        Row: {
          ask_name: boolean
          class_id: string | null
          code: string
          created_at: string
          enabled: boolean
          id: string
          kind: string
          owner_id: string
          resource_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          ask_name?: boolean
          class_id?: string | null
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          owner_id: string
          resource_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          ask_name?: boolean
          class_id?: string | null
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          owner_id?: string
          resource_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guest_presence: {
        Row: {
          assessment_id: string | null
          guest_name: string | null
          guest_token: string
          id: string
          last_seen_at: string
          link_id: string
          question_id: string | null
          score: number
          started_at: string
          total_marks: number
        }
        Insert: {
          assessment_id?: string | null
          guest_name?: string | null
          guest_token: string
          id?: string
          last_seen_at?: string
          link_id: string
          question_id?: string | null
          score?: number
          started_at?: string
          total_marks?: number
        }
        Update: {
          assessment_id?: string | null
          guest_name?: string | null
          guest_token?: string
          id?: string
          last_seen_at?: string
          link_id?: string
          question_id?: string | null
          score?: number
          started_at?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_presence_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "guest_links"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_question_times: {
        Row: {
          assessment_id: string
          created_at: string
          elapsed_ms: number
          guest_token: string
          id: string
          link_id: string
          question_id: string
          success: boolean
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          elapsed_ms?: number
          guest_token: string
          id?: string
          link_id: string
          question_id: string
          success?: boolean
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          elapsed_ms?: number
          guest_token?: string
          id?: string
          link_id?: string
          question_id?: string
          success?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_question_times_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "guest_links"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_audit_runs: {
        Row: {
          actor: string | null
          fail_count: number
          finished_at: string | null
          id: string
          missing_count: number
          notes: string | null
          partial_count: number
          pass_count: number
          run_no: number
          segment_key: string
          started_at: string
          total: number
          unknown_count: number
        }
        Insert: {
          actor?: string | null
          fail_count?: number
          finished_at?: string | null
          id?: string
          missing_count?: number
          notes?: string | null
          partial_count?: number
          pass_count?: number
          run_no: number
          segment_key: string
          started_at?: string
          total?: number
          unknown_count?: number
        }
        Update: {
          actor?: string | null
          fail_count?: number
          finished_at?: string | null
          id?: string
          missing_count?: number
          notes?: string | null
          partial_count?: number
          pass_count?: number
          run_no?: number
          segment_key?: string
          started_at?: string
          total?: number
          unknown_count?: number
        }
        Relationships: []
      }
      integrity_repair_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          requirement_id: string
          restoration_source: string | null
          scope: string | null
          segment_key: string
          standard_snapshot: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          requirement_id: string
          restoration_source?: string | null
          scope?: string | null
          segment_key: string
          standard_snapshot: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          requirement_id?: string
          restoration_source?: string | null
          scope?: string | null
          segment_key?: string
          standard_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrity_requirement_results: {
        Row: {
          check_details: Json
          created_at: string
          evidence: string | null
          id: string
          reason: string | null
          requirement_id: string
          run_id: string
          segment_key: string
          status: string
        }
        Insert: {
          check_details?: Json
          created_at?: string
          evidence?: string | null
          id?: string
          reason?: string | null
          requirement_id: string
          run_id: string
          segment_key: string
          status: string
        }
        Update: {
          check_details?: Json
          created_at?: string
          evidence?: string | null
          id?: string
          reason?: string | null
          requirement_id?: string
          run_id?: string
          segment_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_requirement_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "integrity_audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_assignments: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          class_id: string
          created_at: string
          created_by: string
          due_at: string | null
          game_id: string | null
          id: string
          mode: string
          notebook_id: string
          question_keys: string[]
          started_at: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          class_id: string
          created_at?: string
          created_by: string
          due_at?: string | null
          game_id?: string | null
          id?: string
          mode?: string
          notebook_id: string
          question_keys?: string[]
          started_at?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          class_id?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          game_id?: string | null
          id?: string
          mode?: string
          notebook_id?: string
          question_keys?: string[]
          started_at?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_assignments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_assignments_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      live_entry_requests: {
        Row: {
          created_at: string
          display_name: string | null
          guest_token: string
          id: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          guest_token: string
          id?: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          guest_token?: string
          id?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_entry_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_gallery_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          media_type: string | null
          media_url: string | null
          owner_id: string
          source: string | null
          source_resource_id: string | null
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          media_type?: string | null
          media_url?: string | null
          owner_id: string
          source?: string | null
          source_resource_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          media_type?: string | null
          media_url?: string | null
          owner_id?: string
          source?: string | null
          source_resource_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      notebook_copilot_messages: {
        Row: {
          created_at: string
          cycle: number
          id: string
          payload: Json | null
          role: string
          session_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle?: number
          id?: string
          payload?: Json | null
          role: string
          session_id: string
          text?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle?: number
          id?: string
          payload?: Json | null
          role?: string
          session_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_copilot_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "notebook_copilot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_copilot_sessions: {
        Row: {
          analysis: Json | null
          created_at: string
          current_item: string | null
          cycle: number
          id: string
          notebook_id: string
          queue: Json
          stage: string
          structure: Json
          subtopic: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          current_item?: string | null
          cycle?: number
          id?: string
          notebook_id: string
          queue?: Json
          stage?: string
          structure?: Json
          subtopic?: string
          topic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          current_item?: string | null
          cycle?: number
          id?: string
          notebook_id?: string
          queue?: Json
          stage?: string
          structure?: Json
          subtopic?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_copilot_sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: true
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_sections: {
        Row: {
          created_at: string
          doc_key: string | null
          id: string
          kind: Database["public"]["Enums"]["section_kind"]
          notebook_id: string
          order_index: number
          stable_key: string
          title: string | null
        }
        Insert: {
          created_at?: string
          doc_key?: string | null
          id?: string
          kind: Database["public"]["Enums"]["section_kind"]
          notebook_id: string
          order_index?: number
          stable_key?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          doc_key?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["section_kind"]
          notebook_id?: string
          order_index?: number
          stable_key?: string
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
      notebook_slide_decks: {
        Row: {
          created_at: string
          id: string
          name: string
          notebook_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          notebook_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notebook_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_slide_decks_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_slide_items: {
        Row: {
          content_json: Json | null
          created_at: string
          h: number
          id: string
          kind: string
          slide_id: string
          step: number
          storage_path: string
          w: number
          x: number
          y: number
          z: number
        }
        Insert: {
          content_json?: Json | null
          created_at?: string
          h?: number
          id?: string
          kind: string
          slide_id: string
          step?: number
          storage_path: string
          w?: number
          x?: number
          y?: number
          z?: number
        }
        Update: {
          content_json?: Json | null
          created_at?: string
          h?: number
          id?: string
          kind?: string
          slide_id?: string
          step?: number
          storage_path?: string
          w?: number
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebook_slide_items_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "notebook_slides"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_slides: {
        Row: {
          created_at: string
          deck_id: string | null
          id: string
          name: string
          notebook_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deck_id?: string | null
          id?: string
          name?: string
          notebook_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deck_id?: string | null
          id?: string
          name?: string
          notebook_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_slides_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "notebook_slide_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_slides_notebook_id_fkey"
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
          doc_key: string | null
          floating_bucket: Json | null
          floating_highlights: Json | null
          floating_lines: Json
          floating_scoring: Json | null
          id: string
          order_index: number
          section_id: string
          stable_key: string
        }
        Insert: {
          created_at?: string
          doc_key?: string | null
          floating_bucket?: Json | null
          floating_highlights?: Json | null
          floating_lines?: Json
          floating_scoring?: Json | null
          id?: string
          order_index?: number
          section_id: string
          stable_key?: string
        }
        Update: {
          created_at?: string
          doc_key?: string | null
          floating_bucket?: Json | null
          floating_highlights?: Json | null
          floating_lines?: Json
          floating_scoring?: Json | null
          id?: string
          order_index?: number
          section_id?: string
          stable_key?: string
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
          archived_at: string | null
          checkout_link_id: string | null
          class_name: string
          color_index: number
          companion_json: Json | null
          cover_config: Json | null
          created_at: string
          document_json: Json | null
          id: string
          org_id: string | null
          origin_notebook_id: string | null
          owner_id: string
          page_extra_mm: number
          paper_size: string
          paper_style: string
          purpose: string
          score_label: string
          session: string
          storage_scope: string
          subject: string
          subtopic: string
          teacher: string
          title: string | null
          updated_at: string
          zoom: number
        }
        Insert: {
          archived_at?: string | null
          checkout_link_id?: string | null
          class_name?: string
          color_index?: number
          companion_json?: Json | null
          cover_config?: Json | null
          created_at?: string
          document_json?: Json | null
          id?: string
          org_id?: string | null
          origin_notebook_id?: string | null
          owner_id: string
          page_extra_mm?: number
          paper_size?: string
          paper_style?: string
          purpose?: string
          score_label?: string
          session?: string
          storage_scope?: string
          subject?: string
          subtopic?: string
          teacher?: string
          title?: string | null
          updated_at?: string
          zoom?: number
        }
        Update: {
          archived_at?: string | null
          checkout_link_id?: string | null
          class_name?: string
          color_index?: number
          companion_json?: Json | null
          cover_config?: Json | null
          created_at?: string
          document_json?: Json | null
          id?: string
          org_id?: string | null
          origin_notebook_id?: string | null
          owner_id?: string
          page_extra_mm?: number
          paper_size?: string
          paper_style?: string
          purpose?: string
          score_label?: string
          session?: string
          storage_scope?: string
          subject?: string
          subtopic?: string
          teacher?: string
          title?: string | null
          updated_at?: string
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          read_at: string | null
          recipient_user_id: string
          responded_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          read_at?: string | null
          recipient_user_id: string
          responded_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          read_at?: string | null
          recipient_user_id?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          allow_responses: boolean
          attachment: Json | null
          audience: Json | null
          body: string
          category: string
          context: Json
          created_at: string
          id: string
          kind: string
          parent_id: string | null
          recipient_count: number
          sender_role: string | null
          sender_user_id: string | null
          subject: string | null
          target_path: string | null
          thread_root_id: string | null
        }
        Insert: {
          allow_responses?: boolean
          attachment?: Json | null
          audience?: Json | null
          body: string
          category?: string
          context?: Json
          created_at?: string
          id?: string
          kind: string
          parent_id?: string | null
          recipient_count?: number
          sender_role?: string | null
          sender_user_id?: string | null
          subject?: string | null
          target_path?: string | null
          thread_root_id?: string | null
        }
        Update: {
          allow_responses?: boolean
          attachment?: Json | null
          audience?: Json | null
          body?: string
          category?: string
          context?: Json
          created_at?: string
          id?: string
          kind?: string
          parent_id?: string | null
          recipient_count?: number
          sender_role?: string | null
          sender_user_id?: string | null
          subject?: string | null
          target_path?: string | null
          thread_root_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string | null
          created_at: string
          id: string
          invite_code: string | null
          kind: string
          name: string
          owner_user_id: string | null
          parent_org_id: string | null
          school_type: string | null
          status: string
          updated_at: string
          visibility: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          kind: string
          name: string
          owner_user_id?: string | null
          parent_org_id?: string | null
          school_type?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          kind?: string
          name?: string
          owner_user_id?: string | null
          parent_org_id?: string | null
          school_type?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      page_guide_videos: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          page_key: string
          position: number
          status: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          video_path: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          page_key: string
          position?: number
          status?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_path: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          page_key?: string
          position?: number
          status?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_path?: string
        }
        Relationships: []
      }
      page_guides: {
        Row: {
          created_at: string
          description: string | null
          id: string
          page_key: string
          status: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          video_path: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          page_key: string
          status?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_path?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          page_key?: string
          status?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_path?: string | null
        }
        Relationships: []
      }
      parent_children: {
        Row: {
          child_user_id: string
          created_at: string
          id: string
          parent_user_id: string
        }
        Insert: {
          child_user_id: string
          created_at?: string
          id?: string
          parent_user_id: string
        }
        Update: {
          child_user_id?: string
          created_at?: string
          id?: string
          parent_user_id?: string
        }
        Relationships: []
      }
      parent_teacher_links: {
        Row: {
          child_user_id: string | null
          created_at: string
          id: string
          parent_user_id: string
          status: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          child_user_id?: string | null
          created_at?: string
          id?: string
          parent_user_id: string
          status?: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          child_user_id?: string | null
          created_at?: string
          id?: string
          parent_user_id?: string
          status?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          environment: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          credit_amount: number
          credits_allocated: number
          currency: string
          id: string
          occurred_at: string
          org_id: string | null
          plan_id: string | null
          plan_version_id: string | null
          provider: string
          provider_ref: string | null
          service_amount: number
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_amount?: number
          credits_allocated?: number
          currency?: string
          id?: string
          occurred_at?: string
          org_id?: string | null
          plan_id?: string | null
          plan_version_id?: string | null
          provider?: string
          provider_ref?: string | null
          service_amount?: number
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credit_amount?: number
          credits_allocated?: number
          currency?: string
          id?: string
          occurred_at?: string
          org_id?: string | null
          plan_id?: string | null
          plan_version_id?: string | null
          provider?: string
          provider_ref?: string | null
          service_amount?: number
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_entitlements"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          id: string
          label: string
          plan_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          plan_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          plan_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          created_at: string
          id: string
          limit_key: string
          limit_value: number | null
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_key: string
          limit_value?: number | null
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_key?: string
          limit_value?: number | null
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          created_at: string
          credit_amount: number
          credit_cost: number
          credit_sell_price: number
          currency: string
          description: string | null
          id: string
          included_credits: number
          label: string | null
          plan_id: string
          platform_amount: number
          price: number
          profit_percentage: number
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          version_no: number
          yearly_enabled: boolean
        }
        Insert: {
          created_at?: string
          credit_amount?: number
          credit_cost?: number
          credit_sell_price?: number
          currency?: string
          description?: string | null
          id?: string
          included_credits?: number
          label?: string | null
          plan_id: string
          platform_amount?: number
          price?: number
          profit_percentage?: number
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          version_no?: number
          yearly_enabled?: boolean
        }
        Update: {
          created_at?: string
          credit_amount?: number
          credit_cost?: number
          credit_sell_price?: number
          currency?: string
          description?: string | null
          id?: string
          included_credits?: number
          label?: string | null
          plan_id?: string
          platform_amount?: number
          price?: number
          profit_percentage?: number
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          version_no?: number
          yearly_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          audience: string
          audience_visible: boolean
          created_at: string
          credit_amount: number
          currency: string
          current_version_id: string | null
          description: string | null
          id: string
          is_free: boolean
          key: string
          label: string
          sort_order: number
          status: string
          subscription_amount: number
          updated_at: string
          yearly_enabled: boolean
        }
        Insert: {
          active?: boolean
          audience: string
          audience_visible?: boolean
          created_at?: string
          credit_amount?: number
          currency?: string
          current_version_id?: string | null
          description?: string | null
          id?: string
          is_free?: boolean
          key: string
          label: string
          sort_order?: number
          status?: string
          subscription_amount?: number
          updated_at?: string
          yearly_enabled?: boolean
        }
        Update: {
          active?: boolean
          audience?: string
          audience_visible?: boolean
          created_at?: string
          credit_amount?: number
          currency?: string
          current_version_id?: string | null
          description?: string | null
          id?: string
          is_free?: boolean
          key?: string
          label?: string
          sort_order?: number
          status?: string
          subscription_amount?: number
          updated_at?: string
          yearly_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plans_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_advertisements: {
        Row: {
          ad_kind: string
          adsense_slot_id: string | null
          campaign_name: string | null
          click_url: string | null
          created_at: string
          duration_ms: number
          ends_at: string | null
          id: string
          is_active: boolean
          label: string | null
          media_path: string | null
          media_source: string
          media_type: string
          provider: string
          provider_ad_id: string | null
          slot: number
          starts_at: string | null
          thumbnail_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ad_kind?: string
          adsense_slot_id?: string | null
          campaign_name?: string | null
          click_url?: string | null
          created_at?: string
          duration_ms?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          media_path?: string | null
          media_source?: string
          media_type?: string
          provider?: string
          provider_ad_id?: string | null
          slot: number
          starts_at?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ad_kind?: string
          adsense_slot_id?: string | null
          campaign_name?: string | null
          click_url?: string | null
          created_at?: string
          duration_ms?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          media_path?: string | null
          media_source?: string
          media_type?: string
          provider?: string
          provider_ad_id?: string | null
          slot?: number
          starts_at?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_building_default: {
        Row: {
          background: Json | null
          created_at: string
          free_building: Json | null
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background?: Json | null
          created_at?: string
          free_building?: Json | null
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background?: Json | null
          created_at?: string
          free_building?: Json | null
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_cost_settings: {
        Row: {
          credit_rate: number
          credit_start_floor: number
          credit_stop_floor: number
          currency: string
          id: number
          profit_percentage: number
          updated_at: string
        }
        Insert: {
          credit_rate?: number
          credit_start_floor?: number
          credit_stop_floor?: number
          currency?: string
          id?: number
          profit_percentage?: number
          updated_at?: string
        }
        Update: {
          credit_rate?: number
          credit_start_floor?: number
          credit_stop_floor?: number
          currency?: string
          id?: number
          profit_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_senders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reply_to_email: string
          sender_email: string
          sender_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reply_to_email?: string
          sender_email: string
          sender_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reply_to_email?: string
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_settings: {
        Row: {
          id: boolean
          notes: string
          reply_to_email: string
          sender_email: string
          sender_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          notes?: string
          reply_to_email?: string
          sender_email?: string
          sender_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          notes?: string
          reply_to_email?: string
          sender_email?: string
          sender_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_email_templates: {
        Row: {
          body: string
          button_color: string
          button_label: string
          display_name: string
          footer: string
          heading_color: string
          logo_text: string
          signature: string
          subject: string
          template_key: string
          text_color: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          button_color?: string
          button_label?: string
          display_name: string
          footer?: string
          heading_color?: string
          logo_text?: string
          signature?: string
          subject: string
          template_key: string
          text_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          button_color?: string
          button_label?: string
          display_name?: string
          footer?: string
          heading_color?: string
          logo_text?: string
          signature?: string
          subject?: string
          template_key?: string
          text_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_test_accounts: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          role: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          role: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          role?: string
          target_user_id?: string
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
      pricing_versions: {
        Row: {
          cost_per_credit: number | null
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          label: string | null
          note: string | null
          profit_percentage: number
          sell_price: number | null
        }
        Insert: {
          cost_per_credit?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          label?: string | null
          note?: string | null
          profit_percentage: number
          sell_price?: number | null
        }
        Update: {
          cost_per_credit?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          label?: string | null
          note?: string | null
          profit_percentage?: number
          sell_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepts_requests: boolean
          active_org_id: string | null
          avatar_url: string | null
          children_count: number | null
          country: string | null
          created_at: string
          dashboard_background: string | null
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          full_name: string | null
          homepage_config: Json
          is_live: boolean
          last_name: string | null
          managed_by_org_id: string | null
          managed_by_user_id: string | null
          marketing_opt_in: boolean
          mathgpl_student_id: string | null
          rejected_retention_hours: number
          school_name: string | null
          subjects_taught: string | null
          terms_accepted_at: string | null
          time_zone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          accepts_requests?: boolean
          active_org_id?: string | null
          avatar_url?: string | null
          children_count?: number | null
          country?: string | null
          created_at?: string
          dashboard_background?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          full_name?: string | null
          homepage_config?: Json
          is_live?: boolean
          last_name?: string | null
          managed_by_org_id?: string | null
          managed_by_user_id?: string | null
          marketing_opt_in?: boolean
          mathgpl_student_id?: string | null
          rejected_retention_hours?: number
          school_name?: string | null
          subjects_taught?: string | null
          terms_accepted_at?: string | null
          time_zone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          accepts_requests?: boolean
          active_org_id?: string | null
          avatar_url?: string | null
          children_count?: number | null
          country?: string | null
          created_at?: string
          dashboard_background?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          full_name?: string | null
          homepage_config?: Json
          is_live?: boolean
          last_name?: string | null
          managed_by_org_id?: string | null
          managed_by_user_id?: string | null
          marketing_opt_in?: boolean
          mathgpl_student_id?: string | null
          rejected_retention_hours?: number
          school_name?: string | null
          subjects_taught?: string | null
          terms_accepted_at?: string | null
          time_zone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_org_id_fkey"
            columns: ["active_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_percentage: number
          expires_at: string | null
          id: string
          kind: string
          label: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_percentage?: number
          expires_at?: string | null
          id?: string
          kind?: string
          label?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_percentage?: number
          expires_at?: string | null
          id?: string
          kind?: string
          label?: string | null
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          active: boolean
          code_id: string
          cost_unit_id: string
          id: string
          redeemed_at: string
        }
        Insert: {
          active?: boolean
          code_id: string
          cost_unit_id: string
          id?: string
          redeemed_at?: string
        }
        Update: {
          active?: boolean
          code_id?: string
          cost_unit_id?: string
          id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_redemptions_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_attributions: {
        Row: {
          campaign_id: string
          id: string
          link_id: string
          org_id: string | null
          referred_role: string | null
          referred_user_id: string
          referrer_user_id: string
          registered_at: string
          subscribed_at: string | null
        }
        Insert: {
          campaign_id: string
          id?: string
          link_id: string
          org_id?: string | null
          referred_role?: string | null
          referred_user_id: string
          referrer_user_id: string
          registered_at?: string
          subscribed_at?: string | null
        }
        Update: {
          campaign_id?: string
          id?: string
          link_id?: string
          org_id?: string | null
          referred_role?: string | null
          referred_user_id?: string
          referrer_user_id?: string
          registered_at?: string
          subscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_attributions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_campaigns: {
        Row: {
          audience: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          owner_kind: string
          owner_user_id: string
          reward_rule: Json
          reward_type: string
          status: string
          target_user_id: string | null
          trigger_event: string
          updated_at: string
        }
        Insert: {
          audience?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          owner_kind: string
          owner_user_id: string
          reward_rule?: Json
          reward_type?: string
          status?: string
          target_user_id?: string | null
          trigger_event?: string
          updated_at?: string
        }
        Update: {
          audience?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          owner_kind?: string
          owner_user_id?: string
          reward_rule?: Json
          reward_type?: string
          status?: string
          target_user_id?: string | null
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: string
          referred_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind: string
          referred_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: string
          referred_user_id?: string | null
        }
        Relationships: []
      }
      referral_links: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          org_id: string | null
          referrer_user_id: string
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          referrer_user_id: string
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          amount: number | null
          attribution_id: string
          campaign_id: string
          created_at: string
          currency: string | null
          description: string | null
          discount_kind: string | null
          id: string
          org_id: string | null
          paid_at: string | null
          paid_note: string | null
          qualified_at: string | null
          referrer_user_id: string
          reward_type: string
          status: string
        }
        Insert: {
          amount?: number | null
          attribution_id: string
          campaign_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_kind?: string | null
          id?: string
          org_id?: string | null
          paid_at?: string | null
          paid_note?: string | null
          qualified_at?: string | null
          referrer_user_id: string
          reward_type: string
          status?: string
        }
        Update: {
          amount?: number | null
          attribution_id?: string
          campaign_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_kind?: string | null
          id?: string
          org_id?: string | null
          paid_at?: string | null
          paid_note?: string | null
          qualified_at?: string | null
          referrer_user_id?: string
          reward_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: true
            referencedRelation: "referral_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      report_task_results: {
        Row: {
          assignment_id: string
          class_id: string
          created_at: string
          frozen_at: string
          frozen_score: number
          frozen_target: number
          id: string
          mode: string
          percent: number
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          class_id: string
          created_at?: string
          frozen_at?: string
          frozen_score?: number
          frozen_target?: number
          id?: string
          mode?: string
          percent?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          class_id?: string
          created_at?: string
          frozen_at?: string
          frozen_score?: number
          frozen_target?: number
          id?: string
          mode?: string
          percent?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_task_results_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_prices: {
        Row: {
          category: Database["public"]["Enums"]["cost_category"]
          created_at: string
          currency: string
          effective_from: string
          id: string
          metric: string
          note: string | null
          unit: string
          unit_price: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          metric: string
          note?: string | null
          unit: string
          unit_price?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          metric?: string
          note?: string | null
          unit?: string
          unit_price?: number | null
        }
        Relationships: []
      }
      role_capabilities: {
        Row: {
          capability: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          scope: string
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: string
        }
        Relationships: []
      }
      session_audience: {
        Row: {
          created_at: string
          display_name: string | null
          guest_token: string
          id: string
          last_seen_at: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          guest_token: string
          id?: string
          last_seen_at?: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          guest_token?: string
          id?: string
          last_seen_at?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_audience_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_public_notes: {
        Row: {
          created_at: string
          notebook_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          notebook_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          notebook_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_public_notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_public_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          allow_free_entry: boolean
          ask_participant_name: boolean
          broadcasts: Json
          class_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_live: boolean
          live_started_at: string | null
          notebook_id: string | null
          owner_id: string
          schedule_days: number[]
          schedule_end_times: Json
          schedule_time: string | null
          schedule_times: Json
          session_code: string
          starts_at: string | null
          status: string
          time_zone: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          allow_free_entry?: boolean
          ask_participant_name?: boolean
          broadcasts?: Json
          class_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_live?: boolean
          live_started_at?: string | null
          notebook_id?: string | null
          owner_id: string
          schedule_days?: number[]
          schedule_end_times?: Json
          schedule_time?: string | null
          schedule_times?: Json
          session_code: string
          starts_at?: string | null
          status?: string
          time_zone?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          allow_free_entry?: boolean
          ask_participant_name?: boolean
          broadcasts?: Json
          class_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_live?: boolean
          live_started_at?: string | null
          notebook_id?: string | null
          owner_id?: string
          schedule_days?: number[]
          schedule_end_times?: Json
          schedule_time?: string | null
          schedule_times?: Json
          session_code?: string
          starts_at?: string | null
          status?: string
          time_zone?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      site_sections: {
        Row: {
          created_at: string
          cta_href: string | null
          cta_label: string | null
          draft: Json | null
          eyebrow: string | null
          headline: string | null
          id: string
          items: Json
          key: string
          kind: string
          media: Json
          position: number
          published_at: string | null
          subline: string | null
          title: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          draft?: Json | null
          eyebrow?: string | null
          headline?: string | null
          id?: string
          items?: Json
          key: string
          kind: string
          media?: Json
          position?: number
          published_at?: string | null
          subline?: string | null
          title?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          draft?: Json | null
          eyebrow?: string | null
          headline?: string | null
          id?: string
          items?: Json
          key?: string
          kind?: string
          media?: Json
          position?: number
          published_at?: string | null
          subline?: string | null
          title?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      site_stats_settings: {
        Row: {
          created_at: string
          id: string
          show_adventures: boolean
          show_learners: boolean
          show_questions: boolean
          show_schools: boolean
          show_teachers: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_adventures?: boolean
          show_learners?: boolean
          show_questions?: boolean
          show_schools?: boolean
          show_teachers?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          show_adventures?: boolean
          show_learners?: boolean
          show_questions?: boolean
          show_schools?: boolean
          show_teachers?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      site_testimonials: {
        Row: {
          approved: boolean
          author_name: string
          author_role: string | null
          avatar: Json | null
          created_at: string
          id: string
          organisation: string | null
          position: number
          quote: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          author_name: string
          author_role?: string | null
          avatar?: Json | null
          created_at?: string
          id?: string
          organisation?: string | null
          position?: number
          quote: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          author_name?: string
          author_role?: string | null
          avatar?: Json | null
          created_at?: string
          id?: string
          organisation?: string | null
          position?: number
          quote?: string
          updated_at?: string
        }
        Relationships: []
      }
      smart_card_attempts: {
        Row: {
          card_id: string
          completed_at: string
          created_at: string
          display_name: string
          duration_ms: number
          id: string
          is_preview: boolean
          participant_key: string
          percent: number
          user_id: string | null
        }
        Insert: {
          card_id: string
          completed_at?: string
          created_at?: string
          display_name: string
          duration_ms?: number
          id?: string
          is_preview?: boolean
          participant_key: string
          percent?: number
          user_id?: string | null
        }
        Update: {
          card_id?: string
          completed_at?: string
          created_at?: string
          display_name?: string
          duration_ms?: number
          id?: string
          is_preview?: boolean
          participant_key?: string
          percent?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_card_attempts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "smart_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_card_game_results: {
        Row: {
          card_id: string
          completion_ms: number | null
          created_at: string
          display_name: string | null
          id: string
          is_winner: boolean
          participant_key: string
          qualified_at: string | null
          required_marks: number
          rewarded_at: string | null
          score: number
          started_at: string
          updated_at: string
        }
        Insert: {
          card_id: string
          completion_ms?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_winner?: boolean
          participant_key: string
          qualified_at?: string | null
          required_marks?: number
          rewarded_at?: string | null
          score?: number
          started_at?: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          completion_ms?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_winner?: boolean
          participant_key?: string
          qualified_at?: string | null
          required_marks?: number
          rewarded_at?: string | null
          score?: number
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_card_game_results_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "smart_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_card_presence: {
        Row: {
          card_id: string
          display_name: string | null
          first_seen_at: string
          id: string
          is_preview: boolean
          last_seen_at: string
          participant_key: string
          state: string
        }
        Insert: {
          card_id: string
          display_name?: string | null
          first_seen_at?: string
          id?: string
          is_preview?: boolean
          last_seen_at?: string
          participant_key: string
          state?: string
        }
        Update: {
          card_id?: string
          display_name?: string | null
          first_seen_at?: string
          id?: string
          is_preview?: boolean
          last_seen_at?: string
          participant_key?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_card_presence_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "smart_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_cards: {
        Row: {
          ask_participant_name: boolean
          assessment_id: string | null
          class_id: string | null
          created_at: string
          difficulty: string | null
          game_id: string | null
          game_progress_element_id: string | null
          geometry: Json | null
          id: string
          notebook_id: string | null
          owner_id: string
          pass_mark_pct: number
          presentation: Json
          preview_image_path: string | null
          publish_mode: string
          published: boolean
          published_at: string | null
          section_id: string | null
          slug: string
          subsection_id: string | null
          subtopic: string | null
          title: string
          topic: string | null
          total_marks: number
          updated_at: string
        }
        Insert: {
          ask_participant_name?: boolean
          assessment_id?: string | null
          class_id?: string | null
          created_at?: string
          difficulty?: string | null
          game_id?: string | null
          game_progress_element_id?: string | null
          geometry?: Json | null
          id?: string
          notebook_id?: string | null
          owner_id: string
          pass_mark_pct?: number
          presentation?: Json
          preview_image_path?: string | null
          publish_mode?: string
          published?: boolean
          published_at?: string | null
          section_id?: string | null
          slug: string
          subsection_id?: string | null
          subtopic?: string | null
          title?: string
          topic?: string | null
          total_marks?: number
          updated_at?: string
        }
        Update: {
          ask_participant_name?: boolean
          assessment_id?: string | null
          class_id?: string | null
          created_at?: string
          difficulty?: string | null
          game_id?: string | null
          game_progress_element_id?: string | null
          geometry?: Json | null
          id?: string
          notebook_id?: string | null
          owner_id?: string
          pass_mark_pct?: number
          presentation?: Json
          preview_image_path?: string | null
          publish_mode?: string
          published?: boolean
          published_at?: string | null
          section_id?: string | null
          slug?: string
          subsection_id?: string | null
          subtopic?: string | null
          title?: string
          topic?: string | null
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_cards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_codes: {
        Row: {
          active: boolean
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          created_by: string | null
          entitlement: string
          expires_at: string | null
          id: string
          label: string | null
          purpose: string
          revoked_at: string | null
        }
        Insert: {
          active?: boolean
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          entitlement?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          purpose?: string
          revoked_at?: string | null
        }
        Update: {
          active?: boolean
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          entitlement?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          purpose?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      staff_redemptions: {
        Row: {
          active: boolean
          code_id: string
          cost_unit_id: string
          id: string
          redeemed_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          code_id: string
          cost_unit_id: string
          id?: string
          redeemed_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          code_id?: string
          cost_unit_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "staff_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_redemptions_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_course_progress: {
        Row: {
          certificate_status: string
          class_id: string
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          progress: number
          score: number | null
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          certificate_status?: string
          class_id: string
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          progress?: number
          score?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          certificate_status?: string
          class_id?: string
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          progress?: number
          score?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_course_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_workspace_access: {
        Row: {
          created_at: string
          granted_at: string
          id: string
          org_id: string | null
          owner_id: string
          source: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          id?: string
          org_id?: string | null
          owner_id: string
          source?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          id?: string
          org_id?: string | null
          owner_id?: string
          source?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_workspace_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_entitlements: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_entitlements_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_entitlements"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "subscription_entitlements_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_limits: {
        Row: {
          created_at: string
          id: string
          limit_key: string
          limit_value: number | null
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_key: string
          limit_value?: number | null
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_key?: string
          limit_value?: number | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_limits_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cancel_at: string | null
          cost_unit_id: string
          created_at: string
          credit_price: number
          credit_sell_price: number | null
          currency: string
          discount_percentage: number
          final_price: number
          grace_until: string | null
          id: string
          included_credits: number | null
          locked_profit_rate: number
          monthly_equivalent: number | null
          org_id: string | null
          payment_state: string
          period_end: string | null
          period_start: string
          plan: string
          plan_id: string | null
          plan_version_id: string | null
          pricing_version_id: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          region: string | null
          scheduled_plan_id: string | null
          standard_annual_price: number | null
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_interval?: string
          cancel_at?: string | null
          cost_unit_id: string
          created_at?: string
          credit_price?: number
          credit_sell_price?: number | null
          currency?: string
          discount_percentage?: number
          final_price?: number
          grace_until?: string | null
          id?: string
          included_credits?: number | null
          locked_profit_rate?: number
          monthly_equivalent?: number | null
          org_id?: string | null
          payment_state?: string
          period_end?: string | null
          period_start?: string
          plan?: string
          plan_id?: string | null
          plan_version_id?: string | null
          pricing_version_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          region?: string | null
          scheduled_plan_id?: string | null
          standard_annual_price?: number | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_interval?: string
          cancel_at?: string | null
          cost_unit_id?: string
          created_at?: string
          credit_price?: number
          credit_sell_price?: number | null
          currency?: string
          discount_percentage?: number
          final_price?: number
          grace_until?: string | null
          id?: string
          included_credits?: number | null
          locked_profit_rate?: number
          monthly_equivalent?: number | null
          org_id?: string | null
          payment_state?: string
          period_end?: string | null
          period_start?: string
          plan?: string
          plan_id?: string | null
          plan_version_id?: string | null
          pricing_version_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          region?: string | null
          scheduled_plan_id?: string | null
          standard_annual_price?: number | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      teacher_invitations: {
        Row: {
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string
          last_name: string | null
          org_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by: string
          last_name?: string | null
          org_id: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string
          last_name?: string | null
          org_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_schedule_entries: {
        Row: {
          created_at: string
          description: string | null
          entry_date: string | null
          id: string
          owner_id: string
          position: number
          scope: string
          scope_id: string
          topic: string
          updated_at: string
          week_label: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_date?: string | null
          id?: string
          owner_id: string
          position?: number
          scope: string
          scope_id: string
          topic: string
          updated_at?: string
          week_label?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_date?: string | null
          id?: string
          owner_id?: string
          position?: number
          scope?: string
          scope_id?: string
          topic?: string
          updated_at?: string
          week_label?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          actor_user_id: string | null
          actual_cost: number
          amount_paid: number
          balance_after: number | null
          balance_before: number | null
          category: Database["public"]["Enums"]["cost_category"]
          charge_credits: number
          cost_credits: number
          cost_unit_id: string
          credit_lot_id: string | null
          credit_price: number | null
          customer_charge: number
          discount_percentage: number
          feature: string | null
          financial_result: number
          id: string
          import_day: string | null
          metric: string
          model: string | null
          occurred_at: string
          operation_key: string | null
          paid_credits: number
          payer_cost_unit_id: string | null
          payment_status: string
          pricing_version_id: string | null
          profit: number
          profit_rate: number
          promo_code: string | null
          quantity: number
          reconciled: boolean
          resource_label: string | null
          source: string
          unit: string
          unit_price: number | null
        }
        Insert: {
          actor_user_id?: string | null
          actual_cost?: number
          amount_paid?: number
          balance_after?: number | null
          balance_before?: number | null
          category: Database["public"]["Enums"]["cost_category"]
          charge_credits?: number
          cost_credits?: number
          cost_unit_id: string
          credit_lot_id?: string | null
          credit_price?: number | null
          customer_charge?: number
          discount_percentage?: number
          feature?: string | null
          financial_result?: number
          id?: string
          import_day?: string | null
          metric: string
          model?: string | null
          occurred_at?: string
          operation_key?: string | null
          paid_credits?: number
          payer_cost_unit_id?: string | null
          payment_status?: string
          pricing_version_id?: string | null
          profit?: number
          profit_rate?: number
          promo_code?: string | null
          quantity?: number
          reconciled?: boolean
          resource_label?: string | null
          source?: string
          unit?: string
          unit_price?: number | null
        }
        Update: {
          actor_user_id?: string | null
          actual_cost?: number
          amount_paid?: number
          balance_after?: number | null
          balance_before?: number | null
          category?: Database["public"]["Enums"]["cost_category"]
          charge_credits?: number
          cost_credits?: number
          cost_unit_id?: string
          credit_lot_id?: string | null
          credit_price?: number | null
          customer_charge?: number
          discount_percentage?: number
          feature?: string | null
          financial_result?: number
          id?: string
          import_day?: string | null
          metric?: string
          model?: string | null
          occurred_at?: string
          operation_key?: string | null
          paid_credits?: number
          payer_cost_unit_id?: string | null
          payment_status?: string
          pricing_version_id?: string | null
          profit?: number
          profit_rate?: number
          promo_code?: string | null
          quantity?: number
          reconciled?: boolean
          resource_label?: string | null
          source?: string
          unit?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_cost_unit_id_fkey"
            columns: ["cost_unit_id"]
            isOneToOne: false
            referencedRelation: "cost_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_display_preferences: {
        Row: {
          created_at: string
          floating_display_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          floating_display_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          floating_display_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_adventure_challenges: {
        Row: {
          accumulated_paused_ms: number
          class_id: string
          created_at: string
          duration_seconds: number
          ended_at: string | null
          game_id: string
          id: string
          outcome: string | null
          paused_at: string | null
          progress_element_id: string | null
          required_pct: number
          scene_id: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          accumulated_paused_ms?: number
          class_id: string
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          game_id: string
          id?: string
          outcome?: string | null
          paused_at?: string | null
          progress_element_id?: string | null
          required_pct?: number
          scene_id: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_paused_ms?: number
          class_id?: string
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          game_id?: string
          id?: string
          outcome?: string | null
          paused_at?: string | null
          progress_element_id?: string | null
          required_pct?: number
          scene_id?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_adventure_challenges_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_adventure_challenges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      video_adventure_runs: {
        Row: {
          active_scene_id: string | null
          class_id: string
          created_at: string
          ended_at: string | null
          game_id: string
          id: string
          playhead_seconds: number
          playing: boolean
          started_at: string | null
          updated_at: string
        }
        Insert: {
          active_scene_id?: string | null
          class_id: string
          created_at?: string
          ended_at?: string | null
          game_id: string
          id?: string
          playhead_seconds?: number
          playing?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          active_scene_id?: string | null
          class_id?: string
          created_at?: string
          ended_at?: string | null
          game_id?: string
          id?: string
          playhead_seconds?: number
          playing?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_adventure_runs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_adventure_runs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      community_post_cards: {
        Row: {
          attached_resource_id: string | null
          author_id: string | null
          avatar_url: string | null
          body: string | null
          category: string | null
          comment_count: number | null
          created_at: string | null
          display_name: string | null
          hashtags: string[] | null
          headline: string | null
          id: string | null
          is_promotion: boolean | null
          like_count: number | null
          media_kind: string | null
          media_url: string | null
          promotion_url: string | null
          status: string | null
          username: string | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_attached_resource_id_fkey"
            columns: ["attached_resource_id"]
            isOneToOne: false
            referencedRelation: "community_resource_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_attached_resource_id_fkey"
            columns: ["attached_resource_id"]
            isOneToOne: false
            referencedRelation: "community_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      community_resource_cards: {
        Row: {
          active_downloads: number | null
          created_at: string | null
          description: string | null
          hashtags: string[] | null
          id: string | null
          kind: string | null
          like_count: number | null
          owner_id: string | null
          payload: Json | null
          published_at: string | null
          source_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      academy_of_category: { Args: { _category_id: string }; Returns: string }
      academy_of_room: { Args: { _room_id: string }; Returns: string }
      academy_of_subtopic: { Args: { _subtopic_id: string }; Returns: string }
      academy_of_topic: { Args: { _topic_id: string }; Returns: string }
      accept_class_invitation: {
        Args: { _invitation_id: string }
        Returns: string
      }
      account_activity_score: { Args: { _user_id: string }; Returns: number }
      account_audience: { Args: { _user_id: string }; Returns: string }
      account_features: {
        Args: { _user_id: string }
        Returns: {
          feature_key: string
          kind: string
        }[]
      }
      account_plan_id: { Args: { _user_id: string }; Returns: string }
      account_role_of: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      account_subscription_id: { Args: { _user_id: string }; Returns: string }
      activate_subscription: {
        Args: {
          _amount_paid?: number
          _billing_interval?: string
          _org_id?: string
          _period_days?: number
          _plan_key: string
          _provider?: string
          _provider_subscription_id?: string
          _user_id: string
        }
        Returns: string
      }
      adjust_credits: {
        Args: {
          _amount: number
          _cost_unit_id: string
          _kind: string
          _note?: string
        }
        Returns: number
      }
      apply_usage_payment: {
        Args: { _amount: number; _cost_unit_id: string }
        Returns: number
      }
      building_of_door: { Args: { _door_id: string }; Returns: string }
      building_of_walkway: { Args: { _walkway_id: string }; Returns: string }
      can_access_realtime_topic: { Args: { _topic: string }; Returns: boolean }
      can_afford_usage: {
        Args: { _estimated?: number; _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_academy: { Args: { _academy_id: string }; Returns: boolean }
      can_edit_building: { Args: { _building_id: string }; Returns: boolean }
      can_manage_gpl_assets: { Args: never; Returns: boolean }
      can_manage_tutorials: { Args: never; Returns: boolean }
      can_view_academy: { Args: { _academy_id: string }; Returns: boolean }
      can_view_building: { Args: { _building_id: string }; Returns: boolean }
      can_view_workspace: { Args: { _org_id: string }; Returns: boolean }
      can_watch_course_media: { Args: { _path: string }; Returns: boolean }
      class_has_open_live_session: {
        Args: { _class_id: string }
        Returns: boolean
      }
      class_join_gate: {
        Args: { code: string }
        Returns: {
          allowed: boolean
          id: string
          name: string
          org_id: string
        }[]
      }
      community_directory: {
        Args: { _limit?: number; _q?: string; _role?: string }
        Returns: {
          accepts_requests: boolean
          avatar_url: string
          bio: string
          country: string
          cover_kind: string
          cover_url: string
          display_name: string
          headline: string
          intro_video_url: string
          location: string
          professional: Json
          role_kind: string
          user_id: string
          username: string
          view_count: number
          years_experience: number
        }[]
      }
      community_directory_ranked: {
        Args: { _limit?: number; _q?: string; _role?: string }
        Returns: {
          accepts_requests: boolean
          avatar_url: string
          bio: string
          country: string
          cover_kind: string
          cover_url: string
          display_name: string
          headline: string
          intro_video_url: string
          like_count: number
          live_count: number
          location: string
          post_count: number
          professional: Json
          prominence: number
          role_kind: string
          shared_count: number
          student_count: number
          user_id: string
          username: string
          view_count: number
          years_experience: number
        }[]
      }
      community_hashtag_counts: {
        Args: { _limit?: number; _prefix?: string }
        Returns: {
          tag: string
          uses: number
        }[]
      }
      community_live_now: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          description: string
          display_name: string
          headline: string
          owner_id: string
          role_kind: string
          session_id: string
          started_at: string
          title: string
          username: string
        }[]
      }
      community_member_stats: {
        Args: { _username: string }
        Returns: {
          like_count: number
          live_count: number
          post_count: number
          shared_count: number
          student_count: number
        }[]
      }
      community_post_viewed: { Args: { _post_id: string }; Returns: number }
      community_profile_viewed: { Args: { _username: string }; Returns: number }
      community_public_profile: {
        Args: { _username: string }
        Returns: {
          accepts_requests: boolean
          avatar_url: string
          bio: string
          bio_long: string
          country: string
          cover_kind: string
          cover_url: string
          display_name: string
          headline: string
          intro_video_url: string
          location: string
          professional: Json
          role_kind: string
          user_id: string
          username: string
          view_count: number
          years_experience: number
        }[]
      }
      consume_cost_credits: {
        Args: {
          _cost_credits: number
          _cost_unit_id: string
          _note?: string
          _usage_event_id?: string
        }
        Returns: {
          balance_after: number
          balance_before: number
          charged: number
          cost_covered: number
          first_lot: string
          first_version: string
        }[]
      }
      consume_credits: {
        Args: {
          _cost_unit_id: string
          _credits: number
          _note?: string
          _usage_event_id?: string
        }
        Returns: number
      }
      course_assigned_to_my_class: {
        Args: { _course_id: string }
        Returns: boolean
      }
      credit_headroom: {
        Args: { _org_id?: string; _user_id: string }
        Returns: {
          available: number
          balance: number
          blocked_reason: string
          enforced: boolean
          reserved: number
          start_floor: number
          stop_floor: number
        }[]
      }
      credit_value_at: {
        Args: { _at?: string; _currency?: string }
        Returns: number
      }
      current_org_id: { Args: never; Returns: string }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      default_username: { Args: { _name: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      discover_accounts: {
        Args: { _q?: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          accepts_requests: boolean
          activity: number
          connection_status: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
        }[]
      }
      discover_schools: {
        Args: { _q?: string }
        Returns: {
          accepts_requests: boolean
          activity: number
          connection_status: string
          name: string
          org_id: string
          owner_user_id: string
          students: number
          teachers: number
          username: string
        }[]
      }
      downgrade_to_free_plan: { Args: { _sub_id: string }; Returns: undefined }
      effective_entitlements: {
        Args: { _user_id: string }
        Returns: {
          feature_key: string
          payer_user_id: string
          source: string
        }[]
      }
      effective_limit: {
        Args: { _limit: string; _user_id: string }
        Returns: number
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_account: {
        Args: { _org_name?: string; _requested_role?: string }
        Returns: {
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      ensure_class_game_boards: {
        Args: { _class_id: string; _game_id: string }
        Returns: undefined
      }
      ensure_credit_wallet: { Args: { _cost_unit_id: string }; Returns: string }
      ensure_user_cost_unit: { Args: { _user_id: string }; Returns: string }
      ensure_workspace_cost_unit: { Args: { _org_id: string }; Returns: string }
      enter_workspace: {
        Args: { _org_id?: string; _owner_id: string }
        Returns: string
      }
      expire_credit_grants: { Args: never; Returns: number }
      expire_lapsed_subscriptions: { Args: never; Returns: number }
      gateway_by_handle: {
        Args: { _handle: string }
        Returns: {
          billing_mode: string
          currency: string
          description: string
          items: string[]
          monthly_enabled: boolean
          name: string
          one_time_enabled: boolean
          owner_id: string
          owner_kind: string
          owner_name: string
          payments_active: boolean
          plan_id: string
          price_amount: number
          slot: string
          username: string
          yearly_discount_percentage: number
          yearly_enabled: boolean
        }[]
      }
      gateway_choose_plan: {
        Args: { _plan_id: string }
        Returns: {
          content_access: Json | null
          created_at: string
          current_period_end: string | null
          granted_items: string[]
          id: string
          owner_id: string
          owner_kind: string
          paid_amount: number | null
          paid_currency: string | null
          payment_provider: string | null
          payment_reference: string | null
          plan_id: string
          source: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gateway_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_mathgpl_id: { Args: never; Returns: string }
      generate_org_invite_code: { Args: never; Returns: string }
      generate_session_code: { Args: never; Returns: string }
      generate_share_code: { Args: never; Returns: string }
      get_account_homepage_config: { Args: { _user_id: string }; Returns: Json }
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
      get_org_homepage_config: { Args: never; Returns: Json }
      get_owned_class_codes: {
        Args: never
        Returns: {
          id: string
          join_code: string
        }[]
      }
      get_platform_free_building: { Args: never; Returns: Json }
      get_site_stats: { Args: never; Returns: Json }
      get_workspace_homepage_config: {
        Args: { _org_id: string }
        Returns: Json
      }
      has_capability: { Args: { _capability: string }; Returns: boolean }
      has_entitlement: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      has_free_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_platform_usage: {
        Args: {
          _cost_unit_id: string
          _credit_rate?: number
          _day: string
          _rows: Json
        }
        Returns: number
      }
      invite_teacher_by_user: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      is_class_member: { Args: { _class_id: string }; Returns: boolean }
      is_class_owner: { Args: { _class_id: string }; Returns: boolean }
      is_community_published: {
        Args: { _kind: string; _source_id: string }
        Returns: boolean
      }
      is_connected: {
        Args: {
          _a: string
          _b: string
          _relation: Database["public"]["Enums"]["connection_relation"]
        }
        Returns: boolean
      }
      is_notification_recipient: {
        Args: { _notification_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
      is_workspace_member: { Args: { _org_id: string }; Returns: boolean }
      issue_account_id: {
        Args: {
          _role?: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: string
      }
      issue_account_id_for_email: { Args: { _email: string }; Returns: string }
      join_class_with_code: { Args: { code: string }; Returns: Json }
      join_org_with_invite: { Args: { _code: string }; Returns: string }
      live_audience_me: {
        Args: { _session: string; _token: string }
        Returns: {
          created_at: string
          display_name: string | null
          guest_token: string
          id: string
          last_seen_at: string
          session_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_audience"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      live_audience_touch: {
        Args: {
          _claim_free_entry?: boolean
          _name?: string
          _session: string
          _token: string
        }
        Returns: {
          created_at: string
          display_name: string | null
          guest_token: string
          id: string
          last_seen_at: string
          session_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_audience"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      live_entry_status: {
        Args: { _guest_token: string; _session_id: string }
        Returns: string
      }
      live_public_activities: {
        Args: { _session_id: string }
        Returns: {
          due_at: string
          game_id: string
          id: string
          kind: string
          notebook_id: string
          status: string
          title: string
        }[]
      }
      live_public_note: {
        Args: { _notebook_id: string; _session_id: string }
        Returns: {
          color_index: number
          cover_config: Json
          document_json: Json
          id: string
          paper_size: string
          paper_style: string
          subject: string
          subtopic: string
          teacher: string
          title: string
        }[]
      }
      live_public_notes: {
        Args: { _session_id: string }
        Returns: {
          color_index: number
          cover_config: Json
          id: string
          subject: string
          subtopic: string
          title: string
        }[]
      }
      live_public_session: {
        Args: { _session_id: string }
        Returns: {
          allow_free_entry: boolean
          ask_participant_name: boolean
          broadcasts: Json
          class_id: string
          description: string
          duration_minutes: number
          id: string
          is_live: boolean
          live_started_at: string
          notebook_id: string
          schedule_days: number[]
          schedule_time: string
          schedule_times: Json
          starts_at: string
          status: string
          subject: string
          subtopic: string
          teacher_name: string
          time_zone: string
          title: string
        }[]
      }
      live_public_smartboard: {
        Args: { _session_id: string }
        Returns: {
          notebook_id: string
          state_json: Json
          updated_at: string
        }[]
      }
      live_request_entry: {
        Args: {
          _display_name?: string
          _guest_token: string
          _session_id: string
        }
        Returns: string
      }
      live_session_is_public: {
        Args: { _session_id: string }
        Returns: boolean
      }
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
      lookup_session_by_code: {
        Args: { code: string }
        Returns: {
          class_id: string
          duration_minutes: number
          id: string
          owner_id: string
          starts_at: string
          title: string
        }[]
      }
      mathgpl_id_for_email: { Args: { _email: string }; Returns: string }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_connection_counts: {
        Args: never
        Returns: {
          children: number
          parents: number
          pending_incoming: number
          schools: number
          students: number
          teachers: number
        }[]
      }
      my_connections: {
        Args: { _status?: string }
        Returns: {
          child_confirmed_at: string
          child_name: string
          child_user_id: string
          counterpart_accepted_at: string
          counterpart_name: string
          counterpart_role: Database["public"]["Enums"]["app_role"]
          counterpart_user_id: string
          counterpart_username: string
          created_at: string
          direction: string
          id: string
          message: string
          org_id: string
          org_name: string
          relation: Database["public"]["Enums"]["connection_relation"]
          status: string
        }[]
      }
      my_credit_activity: {
        Args: { _limit?: number }
        Returns: {
          balance_after: number
          credits: number
          id: string
          kind: string
          label: string
          occurred_at: string
        }[]
      }
      my_credit_balance: { Args: never; Returns: number }
      my_credit_summary: {
        Args: never
        Returns: {
          balance: number
          expiring_credits: number
          next_expiry: string
        }[]
      }
      my_pending_invitations: {
        Args: never
        Returns: {
          created_at: string
          id: string
          invited_by_name: string
          org_id: string
          org_name: string
        }[]
      }
      my_rejected_requests: {
        Args: never
        Returns: {
          child_confirmed_at: string
          child_name: string
          child_user_id: string
          counterpart_accepted_at: string
          counterpart_name: string
          counterpart_role: Database["public"]["Enums"]["app_role"]
          counterpart_user_id: string
          counterpart_username: string
          created_at: string
          direction: string
          id: string
          message: string
          org_id: string
          org_name: string
          relation: Database["public"]["Enums"]["connection_relation"]
          responded_at: string
          status: string
        }[]
      }
      my_school_code: {
        Args: never
        Returns: {
          code: string
          name: string
          org_id: string
        }[]
      }
      my_session_code: { Args: { _session_id: string }; Returns: string }
      my_share_code: { Args: never; Returns: string }
      my_workspaces: {
        Args: never
        Returns: {
          is_owner: boolean
          kind: string
          name: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          visibility: string
        }[]
      }
      notebook_open_to_audience: {
        Args: { _notebook_id: string }
        Returns: boolean
      }
      notebook_shared_to_member: {
        Args: { _notebook_id: string }
        Returns: boolean
      }
      notification_engagement: {
        Args: { _notification_id: string }
        Returns: {
          read_count: number
          recipients: number
          responded_count: number
        }[]
      }
      org_of: { Args: { _user_id: string }; Returns: string }
      owner_can_access_user: { Args: { _user_id: string }; Returns: boolean }
      owns_org: { Args: { _org_id: string }; Returns: boolean }
      owns_smart_card_preview: { Args: { _name: string }; Returns: boolean }
      paddle_activate_paid_plan:
        | {
            Args: {
              _amount?: number
              _customer_id?: string
              _period_end?: string
              _plan_key: string
              _provider_sub_id: string
              _user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _amount?: number
              _billing_interval?: string
              _customer_id?: string
              _period_end?: string
              _plan_key: string
              _provider_sub_id: string
              _user_id: string
            }
            Returns: string
          }
      paddle_apply_plan_change: {
        Args: { _plan_key: string; _provider_sub_id: string }
        Returns: string
      }
      paddle_cancel_at_period_end: {
        Args: { _period_end?: string; _provider_sub_id: string }
        Returns: undefined
      }
      paddle_record_topup: {
        Args: {
          _amount: number
          _credits: number
          _currency?: string
          _provider_ref: string
          _user_id: string
        }
        Returns: boolean
      }
      paddle_schedule_plan_change: {
        Args: { _plan_key: string; _provider_sub_id: string }
        Returns: undefined
      }
      paddle_set_payment_state: {
        Args: { _provider_sub_id: string; _state: string }
        Returns: undefined
      }
      parent_child_breakdown: {
        Args: { _child_user_id: string }
        Returns: {
          classes: number
          kind: string
          name: string
          progress: number
        }[]
      }
      parent_child_overview: {
        Args: never
        Returns: {
          adventures: number
          assignments: number
          child_user_id: string
          classes: number
          display_name: string
          progress: number
          schools: number
          skill_builder: number
          teachers: number
          username: string
        }[]
      }
      parent_family_activity: {
        Args: never
        Returns: {
          child_name: string
          child_user_id: string
          happened_at: string
          kind: string
          title: string
        }[]
      }
      parent_family_connections: {
        Args: never
        Returns: {
          children: number
          connected_at: string
          kind: string
          name: string
          target_user_id: string
          username: string
        }[]
      }
      plan_allows_ai: {
        Args: { _org_id?: string; _user_id: string }
        Returns: boolean
      }
      pricing_version_at: {
        Args: { _at?: string }
        Returns: {
          cost_per_credit: number
          id: string
          label: string
          multiplier: number
          profit_percentage: number
          sell_price: number
        }[]
      }
      profit_percentage_at: { Args: { _at?: string }; Returns: number }
      publish_plan_version: { Args: { _plan_id: string }; Returns: string }
      question_best_times: {
        Args: { _assessment_id: string; _question_id: string }
        Returns: {
          my_best_ms: number
          overall_best_ms: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_cost_unit_day: {
        Args: { _cost_unit_id: string; _day: string }
        Returns: undefined
      }
      reconcile_usage_costs: { Args: { _since?: string }; Returns: number }
      record_pricing_version: {
        Args: {
          _cost_per_credit: number
          _created_by?: string
          _note?: string
          _profit_percentage: number
        }
        Returns: string
      }
      record_usage_event: {
        Args: {
          _category: Database["public"]["Enums"]["cost_category"]
          _feature?: string
          _metric: string
          _model?: string
          _occurred_at?: string
          _operation_key?: string
          _org_id: string
          _quantity: number
          _resource_label?: string
          _unit?: string
          _user_id: string
        }
        Returns: string
      }
      redeem_access_code: { Args: { _code: string }; Returns: string }
      redeem_promo_code: { Args: { _code: string }; Returns: string }
      redeem_staff_code: { Args: { _code: string }; Returns: string }
      referral_campaign_visible: {
        Args: { _audience: string[]; _target: string }
        Returns: boolean
      }
      referral_is_admin: { Args: never; Returns: boolean }
      regenerate_my_share_code: { Args: never; Returns: string }
      regenerate_school_code: { Args: { _org_id: string }; Returns: string }
      release_expired_reservations: { Args: never; Returns: number }
      request_connection: {
        Args: {
          _message?: string
          _relation: Database["public"]["Enums"]["connection_relation"]
          _target_user_id: string
        }
        Returns: string
      }
      request_connection_for_child: {
        Args: {
          _child_user_id: string
          _message?: string
          _relation: Database["public"]["Enums"]["connection_relation"]
          _target_user_id: string
        }
        Returns: string
      }
      reserve_credits: {
        Args: {
          _credits?: number
          _feature?: string
          _operation_key?: string
          _org_id?: string
          _user_id: string
        }
        Returns: {
          available: number
          ok: boolean
          reason: string
          required: number
        }[]
      }
      resolve_account_code: {
        Args: { _code: string }
        Returns: {
          accepts_requests: boolean
          display_name: string
          matched: string
          org_id: string
          org_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
        }[]
      }
      resolve_cost_unit: {
        Args: { _org_id?: string; _user_id: string }
        Returns: string
      }
      resolve_credit_pricing: {
        Args: { _at?: string; _currency?: string }
        Returns: {
          cost_price: number
          currency: string
          follows_base: boolean
          profit_percentage: number
          sell_price: number
        }[]
      }
      resolve_share_code: {
        Args: { _code: string }
        Returns: {
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
        }[]
      }
      respond_to_connection: {
        Args: { _accept: boolean; _connection_id: string }
        Returns: string
      }
      respond_to_teacher_invitation: {
        Args: { _accept: boolean; _invitation_id: string }
        Returns: string
      }
      revoke_connection: { Args: { _connection_id: string }; Returns: string }
      room_screen_object_building: { Args: { _name: string }; Returns: string }
      save_plan_draft: {
        Args: {
          _credit_amount: number
          _currency?: string
          _description: string
          _label: string
          _plan_id: string
          _platform_amount: number
          _profit_percentage?: number
        }
        Returns: string
      }
      school_acronym: { Args: { _name: string }; Returns: string }
      school_member_classes: {
        Args: { _org_id: string; _user_id: string }
        Returns: {
          assignments: number
          id: string
          name: string
          students: number
        }[]
      }
      school_member_overview: {
        Args: { _org_id: string; _user_id: string }
        Returns: {
          adventures: number
          assignments: number
          avatar_url: string
          avg_progress: number
          classes: number
          display_name: string
          first_name: string
          last_name: string
          lesson_notes: number
          mathgpl_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          students: number
          username: string
        }[]
      }
      school_teachers: {
        Args: { _org_id: string }
        Returns: {
          avatar_url: string
          connection_status: string
          display_name: string
          mathgpl_id: string
          status: string
          user_id: string
          username: string
        }[]
      }
      search_public_teachers: {
        Args: { _q: string }
        Returns: {
          display_name: string
          org_id: string
          org_name: string
          user_id: string
        }[]
      }
      session_is_open: { Args: { _session_id: string }; Returns: boolean }
      session_owner_is: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      set_accepts_requests: { Args: { _accept: boolean }; Returns: boolean }
      set_active_workspace: { Args: { _org_id: string }; Returns: string }
      set_go_live: { Args: { _live: boolean }; Returns: boolean }
      set_my_username: { Args: { _username: string }; Returns: string }
      set_platform_building_default: {
        Args: { _background: Json }
        Returns: Json
      }
      set_platform_free_building: { Args: { _config: Json }; Returns: Json }
      set_workspace_visibility: {
        Args: { _org_id: string; _visibility: string }
        Returns: string
      }
      settle_credit_reservation: {
        Args: { _operation_key: string; _status?: string }
        Returns: boolean
      }
      shares_class_with: { Args: { _other: string }; Returns: boolean }
      signup_role_of: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      snapshot_subscription_terms: {
        Args: { _plan_id: string; _subscription_id: string }
        Returns: undefined
      }
      start_subscription_period: {
        Args: {
          _cost_unit_id: string
          _credit_price?: number
          _discount_percentage?: number
          _final_price?: number
          _period_end?: string
          _period_start?: string
          _plan: string
          _plan_id?: string
        }
        Returns: string
      }
      student_may_access_owner: {
        Args: { _org_id: string; _owner_id: string; _student_id: string }
        Returns: boolean
      }
      unread_notification_count: { Args: never; Returns: number }
      username_is_valid: { Args: { _username: string }; Returns: boolean }
      workspace_students: {
        Args: { _org_id: string }
        Returns: {
          display_name: string
          mathgpl_student_id: string
          status: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "platform_owner"
        | "co_admin"
        | "school"
        | "teacher"
        | "parent"
        | "student"
      block_kind: "problem" | "solution" | "reasoning" | "text"
      connection_relation:
        | "school_teacher"
        | "school_student"
        | "teacher_student"
        | "parent_child"
        | "parent_teacher"
        | "parent_school"
        | "teacher_teacher"
        | "student_student"
        | "school_school"
      cost_category:
        | "database"
        | "network"
        | "storage"
        | "compute"
        | "realtime"
        | "ai"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "platform_owner",
        "co_admin",
        "school",
        "teacher",
        "parent",
        "student",
      ],
      block_kind: ["problem", "solution", "reasoning", "text"],
      connection_relation: [
        "school_teacher",
        "school_student",
        "teacher_student",
        "parent_child",
        "parent_teacher",
        "parent_school",
        "teacher_teacher",
        "student_student",
        "school_school",
      ],
      cost_category: [
        "database",
        "network",
        "storage",
        "compute",
        "realtime",
        "ai",
      ],
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
