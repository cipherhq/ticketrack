#!/usr/bin/env python3
"""
Add Stripe Identity events to the Connect webhook
"""

file_path = '/Users/bajideace/Desktop/ticketrack/supabase/functions/stripe-connect-webhook/index.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Add Identity event handlers before default case
old_default = '''      default:
        console.log(`Unhandled event type: ${event.type}`);'''

identity_handlers = '''      // ===== STRIPE IDENTITY EVENTS =====
      case "identity.verification_session.verified": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        console.log(`Identity verified for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            kyc_status: "verified",
            kyc_verified: true,
            kyc_level: 1,
            stripe_identity_status: "verified",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);

          // Send success email
          const { data: organizer } = await supabase.from("organizers")
            .select("business_name, user_id").eq("id", organizerId).single();
          if (organizer) {
            const { data: profile } = await supabase.from("profiles")
              .select("email").eq("id", organizer.user_id).single();
            if (profile?.email) {
              await supabase.functions.invoke("send-email", {
                body: { type: "kyc_verified", to: profile.email, data: { organizerName: organizer.business_name, appUrl: "https://ticketrack.com" } },
              });
            }
          }
          await supabase.from("admin_audit_logs").insert({
            action: "kyc_auto_verified", entity_type: "organizer", entity_id: organizerId,
            details: { method: "stripe_identity", session_id: session.id },
          });
        }
        break;
      }

      case "identity.verification_session.requires_input": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        console.log(`Identity requires input for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "requires_input",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);

          // Notify organizer
          const { data: organizer } = await supabase.from("organizers")
            .select("business_name, user_id").eq("id", organizerId).single();
          if (organizer) {
            const { data: profile } = await supabase.from("profiles")
              .select("email").eq("id", organizer.user_id).single();
            if (profile?.email) {
              await supabase.functions.invoke("send-email", {
                body: { type: "kyc_action_required", to: profile.email, data: { organizerName: organizer.business_name, appUrl: "https://ticketrack.com", message: "Additional information is required." } },
              });
            }
          }
        }
        break;
      }

      case "identity.verification_session.canceled": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        console.log(`Identity canceled for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "canceled",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
        }
        break;
      }

      case "identity.verification_session.processing": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        console.log(`Identity processing for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "processing",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);'''

content = content.replace(old_default, identity_handlers)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ Identity events added to Connect webhook!")
print("   - identity.verification_session.verified")
print("   - identity.verification_session.requires_input")
print("   - identity.verification_session.canceled")
print("   - identity.verification_session.processing")
