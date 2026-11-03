
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "book_assets": {
                  Row: {
                    "book_id": string,"bucket_id": string,"byte_size": number,"chapter_number": number,"created_at": string,"format": string,"id": string,"mime_type": string,"object_path": string,"sha256": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"bucket_id"?: string,"byte_size": number,"chapter_number": number,"created_at"?: string,"format"?: string,"id"?: string,"mime_type"?: string,"object_path": string,"sha256": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "book_id"?: string,"bucket_id"?: string,"byte_size"?: number,"chapter_number"?: number,"created_at"?: string,"format"?: string,"id"?: string,"mime_type"?: string,"object_path"?: string,"sha256"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_assets_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    }
                  ]
                },"book_licenses": {
                  Row: {
                    "book_id": string,"created_at": string,"distribution_permitted": boolean,"id": string,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"rights_evidence": string,"rights_holder": string,"updated_at": string,"valid_from": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string,"distribution_permitted"?: boolean,"id"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rights_evidence": string,"rights_holder": string,"updated_at"?: string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"distribution_permitted"?: boolean,"id"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rights_evidence"?: string,"rights_holder"?: string,"updated_at"?: string,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_licenses_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    }
                  ]
                },"books": {
                  Row: {
                    "author": string,"category": string,"contributor_id": string | null,"cover_alt": string,"cover_path": string | null,"created_at": string,"description": string,"id": string,"ownership": Database["public"]['Enums']["book_ownership"],"public_preview": string,"status": Database["public"]['Enums']["book_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author": string,"category": string,"contributor_id"?: string | null,"cover_alt"?: string,"cover_path"?: string | null,"created_at"?: string,"description": string,"id"?: string,"ownership"?: Database["public"]['Enums']["book_ownership"],"public_preview"?: string,"status"?: Database["public"]['Enums']["book_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author"?: string,"category"?: string,"contributor_id"?: string | null,"cover_alt"?: string,"cover_path"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"ownership"?: Database["public"]['Enums']["book_ownership"],"public_preview"?: string,"status"?: Database["public"]['Enums']["book_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "books_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    }
                  ]
                },"borrowing_plans": {
                  Row: {
                    "book_id": string,"chain_id": number,"created_at": string,"decimals": number,"duration_days": number,"enabled": boolean,"id": string,"price_units": number,"token": string,"token_contract": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"chain_id"?: number,"created_at"?: string,"decimals"?: number,"duration_days": number,"enabled"?: boolean,"id"?: string,"price_units": number,"token"?: string,"token_contract"?: string,"updated_at"?: string
                  }
                  Update: {
                    "book_id"?: string,"chain_id"?: number,"created_at"?: string,"decimals"?: number,"duration_days"?: number,"enabled"?: boolean,"id"?: string,"price_units"?: number,"token"?: string,"token_contract"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "borrowing_plans_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    }
                  ]
                },"contributor_applications": {
                  Row: {
                    "contact": string,"contributor_type": Database["public"]['Enums']["contributor_type"],"created_at": string,"description": string,"id": string,"name": string,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"rights_information": string,"status": Database["public"]['Enums']["application_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact": string,"contributor_type": Database["public"]['Enums']["contributor_type"],"created_at"?: string,"description": string,"id"?: string,"name": string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rights_information": string,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "contact"?: string,"contributor_type"?: Database["public"]['Enums']["contributor_type"],"created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rights_information"?: string,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"contributors": {
                  Row: {
                    "application_id": string | null,"contact": string,"contributor_type": Database["public"]['Enums']["contributor_type"],"created_at": string,"id": string,"name": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"contact": string,"contributor_type": Database["public"]['Enums']["contributor_type"],"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "application_id"?: string | null,"contact"?: string,"contributor_type"?: Database["public"]['Enums']["contributor_type"],"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contributors_application_id_fkey"
      columns: ["application_id"]
isOneToOne: true
      referencedRelation: "contributor_applications"
      referencedColumns: ["id"]
    }
                  ]
                },"loans": {
                  Row: {
                    "book_id": string,"borrowing_plan_id": string,"created_at": string,"duration_days": number,"expires_at": string | null,"id": string,"returned_at": string | null,"started_at": string | null,"status": Database["public"]['Enums']["loan_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"borrowing_plan_id": string,"created_at"?: string,"duration_days": number,"expires_at"?: string | null,"id"?: string,"returned_at"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["loan_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "book_id"?: string,"borrowing_plan_id"?: string,"created_at"?: string,"duration_days"?: number,"expires_at"?: string | null,"id"?: string,"returned_at"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["loan_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loans_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loans_borrowing_plan_id_book_id_fkey"
      columns: ["borrowing_plan_id","book_id"]
isOneToOne: false
      referencedRelation: "borrowing_plans"
      referencedColumns: ["id","book_id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "block_hash": string | null,"block_number": number | null,"block_timestamp": string | null,"chain_id": number,"contributor_id": string | null,"contributor_share": number,"created_at": string,"decimals": number,"environment": string,"expected_sender": string | null,"gross_amount": number,"id": string,"idempotency_key": string,"last_checked_at": string | null,"loan_id": string,"ownership": Database["public"]['Enums']["book_ownership"],"platform_share": number,"quote_block_number": number | null,"recipient": string | null,"status": Database["public"]['Enums']["payment_status"],"submitted_at": string | null,"token": string,"token_contract": string,"tx_hash": string | null,"updated_at": string,"user_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "block_hash"?: string | null,"block_number"?: number | null,"block_timestamp"?: string | null,"chain_id"?: number,"contributor_id"?: string | null,"contributor_share": number,"created_at"?: string,"decimals"?: number,"environment"?: string,"expected_sender"?: string | null,"gross_amount": number,"id"?: string,"idempotency_key": string,"last_checked_at"?: string | null,"loan_id": string,"ownership": Database["public"]['Enums']["book_ownership"],"platform_share": number,"quote_block_number"?: number | null,"recipient"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"submitted_at"?: string | null,"token"?: string,"token_contract"?: string,"tx_hash"?: string | null,"updated_at"?: string,"user_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "block_hash"?: string | null,"block_number"?: number | null,"block_timestamp"?: string | null,"chain_id"?: number,"contributor_id"?: string | null,"contributor_share"?: number,"created_at"?: string,"decimals"?: number,"environment"?: string,"expected_sender"?: string | null,"gross_amount"?: number,"id"?: string,"idempotency_key"?: string,"last_checked_at"?: string | null,"loan_id"?: string,"ownership"?: Database["public"]['Enums']["book_ownership"],"platform_share"?: number,"quote_block_number"?: number | null,"recipient"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"submitted_at"?: string | null,"token"?: string,"token_contract"?: string,"tx_hash"?: string | null,"updated_at"?: string,"user_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_loan_id_user_id_fkey"
      columns: ["loan_id","user_id"]
isOneToOne: false
      referencedRelation: "loans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "authorize_chapter":
{ Args: { "p_book": string,"p_chapter": number,"p_loan": string,"p_user": string }; Returns: Json
                           },
"library_state":
{ Args: { "p_user": string }; Returns: Json
                           },
"return_loan":
{ Args: { "p_loan": string,"p_user": string }; Returns: Json
                           }
          }
          Enums: {
            "app_role": "reader"|"admin","application_status": "pending"|"approved"|"rejected","book_ownership": "platform"|"contributor","book_status": "draft"|"published","contributor_type": "author"|"publisher","loan_status": "pending_payment"|"active"|"returned"|"expired"|"cancelled","payment_status": "pending"|"submitted"|"verifying"|"confirmed"|"failed"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["reader", "admin"],"application_status": ["pending", "approved", "rejected"],"book_ownership": ["platform", "contributor"],"book_status": ["draft", "published"],"contributor_type": ["author", "publisher"],"loan_status": ["pending_payment", "active", "returned", "expired", "cancelled"],"payment_status": ["pending", "submitted", "verifying", "confirmed", "failed", "cancelled"]
          }
        }
} as const
