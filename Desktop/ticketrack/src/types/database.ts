// Database types generated from Supabase schema

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          full_name: string | null;
          avatar_url: string | null;
          role: 'user' | 'organizer' | 'admin';
          is_verified: boolean;
          is_suspended: boolean;
          suspension_reason: string | null;
          last_login_at: string | null;
          login_count: number;
          failed_login_attempts: number;
          locked_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      countries: {
        Row: {
          code: string;
          name: string;
          currency: string;
          currency_symbol: string;
          platform_fee_percent: number;
          tax_percent: number;
          tax_name: string;
          min_payout_amount: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['countries']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['countries']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      organizers: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          business_email: string;
          business_phone: string | null;
          logo_url: string | null;
          cover_image_url: string | null;
          description: string | null;
          website: string | null;
          twitter_url: string | null;
          facebook_url: string | null;
          instagram_url: string | null;
          linkedin_url: string | null;
          is_verified: boolean;
          verification_level: 'none' | 'bronze' | 'silver' | 'gold';
          verification_status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
          kyc_document_type: string | null;
          kyc_document_url: string | null;
          kyc_selfie_url: string | null;
          kyc_submitted_at: string | null;
          kyc_verified_at: string | null;
          kyc_verified_by: string | null;
          kyc_rejection_reason: string | null;
          is_active: boolean;
          is_suspended: boolean;
          suspension_reason: string | null;
          suspended_at: string | null;
          suspended_by: string | null;
          total_events: number;
          total_tickets_sold: number;
          total_revenue: number;
          average_rating: number;
          follower_count: number;
          country_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizers']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_events' | 'total_tickets_sold' | 'total_revenue' | 'average_rating' | 'follower_count'>;
        Update: Partial<Database['public']['Tables']['organizers']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          category_id: string | null;
          country_code: string;
          title: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          start_date: string;
          end_date: string | null;
          timezone: string;
          venue_name: string;
          venue_address: string | null;
          city: string;
          state: string | null;
          country: string;
          fee_handling: 'pass_to_attendee' | 'absorb';
          status: 'draft' | 'published' | 'cancelled' | 'completed' | 'suspended';
          is_featured: boolean;
          is_private: boolean;
          is_approved: boolean;
          moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
          moderation_notes: string | null;
          moderated_by: string | null;
          moderated_at: string | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      ticket_types: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          price: number;
          currency: string;
          quantity_available: number;
          quantity_sold: number;
          quantity_reserved: number;
          max_per_order: number;
          min_per_order: number;
          sale_starts_at: string | null;
          sale_ends_at: string | null;
          is_active: boolean;
          is_hidden: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ticket_types']['Row'], 'id' | 'created_at' | 'updated_at' | 'quantity_sold' | 'quantity_reserved'>;
        Update: Partial<Database['public']['Tables']['ticket_types']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          event_id: string;
          customer_email: string;
          customer_phone: string | null;
          customer_name: string;
          subtotal: number;
          platform_fee: number;
          tax_amount: number;
          discount_amount: number;
          total: number;
          organizer_revenue: number;
          currency: string;
          promo_code_id: string | null;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled' | 'expired';
          payment_method: string | null;
          payment_provider: string;
          payment_reference: string | null;
          payment_provider_reference: string | null;
          payment_metadata: Record<string, unknown> | null;
          paid_at: string | null;
          ip_address: string | null;
          user_agent: string | null;
          device_fingerprint: string | null;
          fraud_score: number;
          fraud_flags: unknown[];
          is_flagged: boolean;
          flagged_reason: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'order_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      tickets: {
        Row: {
          id: string;
          ticket_number: string;
          order_id: string;
          event_id: string;
          ticket_type_id: string;
          user_id: string;
          attendee_name: string | null;
          attendee_email: string | null;
          attendee_phone: string | null;
          status: 'valid' | 'used' | 'cancelled' | 'transferred' | 'expired';
          checked_in_at: string | null;
          checked_in_by: string | null;
          check_in_location: string | null;
          check_in_device: string | null;
          transferred_from: string | null;
          transferred_at: string | null;
          qr_code_hash: string;
          qr_code_salt: string;
          check_in_count: number;
          max_check_ins: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'ticket_number' | 'qr_code_hash' | 'qr_code_salt' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>;
      };
      promo_codes: {
        Row: {
          id: string;
          organizer_id: string;
          code: string;
          description: string | null;
          discount_type: 'percentage' | 'fixed';
          discount_value: number;
          max_uses: number | null;
          times_used: number;
          max_uses_per_user: number;
          min_purchase_amount: number | null;
          max_discount_amount: number | null;
          valid_from: string;
          valid_until: string | null;
          applies_to_all_events: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['promo_codes']['Row'], 'id' | 'times_used' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['promo_codes']['Insert']>;
      };
      followers: {
        Row: {
          id: string;
          organizer_id: string;
          user_id: string;
          notifications_email: boolean;
          notifications_sms: boolean;
          notifications_push: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['followers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['followers']['Insert']>;
      };
      payouts: {
        Row: {
          id: string;
          payout_reference: string;
          organizer_id: string;
          bank_account_id: string;
          gross_amount: number;
          platform_fee: number;
          tax_amount: number;
          net_amount: number;
          currency: string;
          bank_name: string;
          account_number_last4: string;
          account_name: string;
          status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed';
          approved_by: string | null;
          approved_at: string | null;
          approval_notes: string | null;
          processed_by: string | null;
          processed_at: string | null;
          transfer_reference: string | null;
          transfer_provider: string | null;
          transfer_provider_reference: string | null;
          transfer_metadata: Record<string, unknown> | null;
          failure_reason: string | null;
          failure_code: string | null;
          retry_count: number;
          last_retry_at: string | null;
          period_start: string;
          period_end: string;
          order_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payouts']['Row'], 'id' | 'payout_reference' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payouts']['Insert']>;
      };
      support_tickets: {
        Row: {
          id: string;
          ticket_number: string;
          user_id: string | null;
          organizer_id: string | null;
          order_id: string | null;
          subject: string;
          description: string;
          category: 'payment' | 'refund' | 'event' | 'account' | 'technical' | 'payout' | 'verification' | 'other';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          status: 'open' | 'in_progress' | 'waiting_response' | 'on_hold' | 'resolved' | 'closed';
          assigned_to: string | null;
          assigned_at: string | null;
          first_response_at: string | null;
          resolved_at: string | null;
          closed_at: string | null;
          satisfaction_rating: number | null;
          satisfaction_feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['support_tickets']['Row'], 'id' | 'ticket_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['support_tickets']['Insert']>;
      };
      refund_requests: {
        Row: {
          id: string;
          request_number: string;
          order_id: string;
          user_id: string;
          reason: string;
          reason_category: 'event_cancelled' | 'cannot_attend' | 'duplicate_purchase' | 'wrong_tickets' | 'technical_issue' | 'other';
          amount_requested: number;
          amount_approved: number | null;
          status: 'pending' | 'under_review' | 'approved' | 'partially_approved' | 'rejected' | 'processed' | 'cancelled';
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          rejection_reason: string | null;
          processed_by: string | null;
          processed_at: string | null;
          refund_reference: string | null;
          refund_provider_reference: string | null;
          supporting_documents: unknown[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['refund_requests']['Row'], 'id' | 'request_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['refund_requests']['Insert']>;
      };
      organizer_bank_accounts: {
        Row: {
          id: string;
          organizer_id: string;
          country_code: string;
          currency: string;
          bank_name: string;
          bank_code: string | null;
          account_number_encrypted: string;
          account_number_last4: string;
          account_name: string;
          is_default: boolean;
          is_verified: boolean;
          verification_status: 'pending' | 'verified' | 'failed';
          verified_at: string | null;
          verified_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizer_bank_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['organizer_bank_accounts']['Insert']>;
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      owns_organizer: {
        Args: { organizer_id: string };
        Returns: boolean;
      };
      validate_promo_code: {
        Args: {
          p_code: string;
          p_event_id: string;
          p_user_id: string;
          p_subtotal: number;
        };
        Returns: {
          is_valid: boolean;
          promo_code_id: string | null;
          discount_type: string | null;
          discount_value: number | null;
          calculated_discount: number | null;
          error_message: string | null;
        }[];
      };
    };
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Country = Database['public']['Tables']['countries']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Organizer = Database['public']['Tables']['organizers']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type TicketType = Database['public']['Tables']['ticket_types']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type PromoCode = Database['public']['Tables']['promo_codes']['Row'];
export type Follower = Database['public']['Tables']['followers']['Row'];
export type Payout = Database['public']['Tables']['payouts']['Row'];
export type SupportTicket = Database['public']['Tables']['support_tickets']['Row'];
export type RefundRequest = Database['public']['Tables']['refund_requests']['Row'];
export type BankAccount = Database['public']['Tables']['organizer_bank_accounts']['Row'];

// Event with relations
export interface EventWithDetails extends Event {
  organizer?: Organizer;
  category?: Category;
  ticket_types?: TicketType[];
  country?: Country;
}

// Order with relations
export interface OrderWithDetails extends Order {
  event?: Event;
  tickets?: Ticket[];
  promo_code?: PromoCode;
}

// Ticket with relations
export interface TicketWithDetails extends Ticket {
  event?: Event;
  ticket_type?: TicketType;
  order?: Order;
}
