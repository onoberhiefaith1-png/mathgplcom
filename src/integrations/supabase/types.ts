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
          created_at: string
          game_id: string
          id: string
          is_primary: boolean
          name: string
          position_x: number | null
          position_y: number | null
          progress_element_id: string
          source_element_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          game_id: string
          id?: string
          is_primary?: boolean
          name: string
          position_x?: number | null
          position_y?: number | null
          progress_element_id: string
          source_element_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          game_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          position_x?: number | null
          position_y?: number | null
          progress_element_id?: string
          source_element_id?: string | null
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
      assessments: {
        Row: {
          assigned_at: string | null
          assignment_id: string | null
          class_id: string
          created_at: string
          due_at: string | null
          id: string
          kind: string
          notebook_id: string | null
          owner_id: string
          question_key: string | null
          questions: Json
          score_label: string
          section_id: string | null
          title: string
          total_marks: number
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assignment_id?: string | null
          class_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: string
          notebook_id?: string | null
          owner_id: string
          question_key?: string | null
          questions?: Json
          score_label?: string
          section_id?: string | null
          title?: string
          total_marks?: number
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assignment_id?: string | null
          class_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: string
          notebook_id?: string | null
          owner_id?: string
          question_key?: string | null
          questions?: Json
          score_label?: string
          section_id?: string | null
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
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          game_id: string
          id?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          game_id?: string
          id?: string
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
          workspace: string
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
          workspace?: string
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
          workspace?: string
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
          owner_id?: string
          subtopic?: string | null
          thumbnail_path?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
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
          stable_key: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["section_kind"]
          notebook_id: string
          order_index?: number
          stable_key?: string
          title?: string | null
        }
        Update: {
          created_at?: string
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
          stable_key: string
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
          stable_key?: string
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
          class_name: string
          color_index: number
          created_at: string
          document_json: Json | null
          id: string
          owner_id: string
          paper_size: string
          paper_style: string
          purpose: string
          score_label: string
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
          score_label?: string
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
          score_label?: string
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
      sessions: {
        Row: {
          broadcasts: Json
          class_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          notebook_id: string | null
          owner_id: string
          session_code: string
          starts_at: string | null
          status: string
          time_zone: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          broadcasts?: Json
          class_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          notebook_id?: string | null
          owner_id: string
          session_code: string
          starts_at?: string | null
          status?: string
          time_zone?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          broadcasts?: Json
          class_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          notebook_id?: string | null
          owner_id?: string
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
      ensure_class_game_boards: {
        Args: { _class_id: string; _game_id: string }
        Returns: undefined
      }
      generate_mathgpl_id: { Args: never; Returns: string }
      generate_session_code: { Args: never; Returns: string }
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
