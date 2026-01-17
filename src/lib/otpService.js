import { supabase } from './supabase';
import { termiiService } from './termii';
import { generateSecureOTP } from '@/utils/crypto';

class OTPService {
  constructor() {
    this.maxAttempts = 3;
    this.otpLength = 6;
    this.expiryMinutes = 5;
  }

  // Generate and send OTP
  async generateOTP(userId, phoneNumber, purpose = 'login') {
    try {
      // Clean up expired OTPs first
      await this.cleanupExpiredOTPs(userId);

      // Check rate limiting (max 3 OTPs per hour)
      const { data: recentOTPs } = await supabase
        .from('user_otp')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (recentOTPs && recentOTPs.length >= 3) {
        throw new Error('Too many OTP requests. Please wait before requesting again.');
      }

      // Generate 6-digit OTP using cryptographically secure random number
      const otp = generateSecureOTP(this.otpLength);
      const otpHash = await this.hashOTP(otp);
      const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

      // Store OTP in database
      const { data: otpRecord, error } = await supabase
        .from('user_otp')
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          otp_code: otp, // In production, don't store plaintext
          otp_hash: otpHash,
          expires_at: expiresAt.toISOString(),
          purpose,
          max_attempts: this.maxAttempts
        })
        .select()
        .single();

      if (error) throw error;

      // Send SMS via Termii
      const message = `Your Ticketrack verification code is: ${otp}. Valid for ${this.expiryMinutes} minutes. Do not share this code.`;
      
      const smsResult = await termiiService.sendSMS(phoneNumber, message);
      
      if (!smsResult.success) {
        // Clean up OTP record if SMS failed
        await supabase
          .from('user_otp')
          .delete()
          .eq('id', otpRecord.id);
        
        throw new Error('Failed to send OTP SMS');
      }

      // Log security event
      await this.logSecurityEvent(userId, 'otp_generated', {
        purpose,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        messageId: smsResult.messageId
      });

      return {
        success: true,
        otpId: otpRecord.id,
        expiresAt: expiresAt.toISOString(),
        message: 'OTP sent successfully'
      };

    } catch (error) {
      console.error('OTP Generation Error:', error);
      
      // Log failed attempt
      await this.logSecurityEvent(userId, 'otp_generation_failed', {
        error: error.message,
        phoneNumber: this.maskPhoneNumber(phoneNumber)
      }, 'medium');

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify OTP
  async verifyOTP(userId, otpCode, purpose = 'login') {
    try {
      // Find valid OTP
      const { data: otpRecord, error } = await supabase
        .from('user_otp')
        .select('*')
        .eq('user_id', userId)
        .eq('purpose', purpose)
        .eq('is_verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !otpRecord) {
        await this.logSecurityEvent(userId, 'otp_verification_failed', {
          reason: 'No valid OTP found',
          purpose
        }, 'medium');
        
        return {
          success: false,
          error: 'Invalid or expired OTP'
        };
      }

      // Check attempts limit
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await this.markOTPAsUsed(otpRecord.id);
        
        await this.logSecurityEvent(userId, 'otp_max_attempts_exceeded', {
          otpId: otpRecord.id,
          attempts: otpRecord.attempts
        }, 'high');

        return {
          success: false,
          error: 'Maximum verification attempts exceeded'
        };
      }

      // Increment attempt count
      await supabase
        .from('user_otp')
        .update({ 
          attempts: otpRecord.attempts + 1 
        })
        .eq('id', otpRecord.id);

      // Verify OTP
      const isValid = await this.compareOTP(otpCode, otpRecord.otp_hash) || 
                      otpCode === otpRecord.otp_code; // Fallback for development

      if (!isValid) {
        await this.logSecurityEvent(userId, 'otp_verification_failed', {
          otpId: otpRecord.id,
          attempts: otpRecord.attempts + 1,
          reason: 'Invalid code'
        }, 'medium');

        return {
          success: false,
          error: 'Invalid verification code'
        };
      }

      // Mark OTP as verified
      await this.markOTPAsUsed(otpRecord.id);

      // Log successful verification
      await this.logSecurityEvent(userId, 'otp_verified', {
        otpId: otpRecord.id,
        purpose
      }, 'low');

      return {
        success: true,
        message: 'OTP verified successfully'
      };

    } catch (error) {
      console.error('OTP Verification Error:', error);
      
      await this.logSecurityEvent(userId, 'otp_verification_error', {
        error: error.message,
        purpose
      }, 'high');

      return {
        success: false,
        error: 'Verification failed'
      };
    }
  }

  // Check if user has valid OTP session
  async hasValidOTPSession(userId, purpose = 'login') {
    try {
      const { data } = await supabase
        .from('user_otp')
        .select('id')
        .eq('user_id', userId)
        .eq('purpose', purpose)
        .eq('is_verified', true)
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Valid for 30 mins
        .limit(1);

      return data && data.length > 0;
    } catch (error) {
      console.error('OTP Session Check Error:', error);
      return false;
    }
  }

  // Cleanup expired OTPs
  async cleanupExpiredOTPs(userId = null) {
    try {
      let query = supabase
        .from('user_otp')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      await query;
    } catch (error) {
      console.error('OTP Cleanup Error:', error);
    }
  }

  // Mark OTP as used
  async markOTPAsUsed(otpId) {
    await supabase
      .from('user_otp')
      .update({
        is_verified: true,
        used_at: new Date().toISOString()
      })
      .eq('id', otpId);
  }

  // Hash OTP for secure storage
  async hashOTP(otp) {
    // In production, use proper hashing (bcrypt, argon2, etc.)
    return btoa(otp + 'salt');
  }

  // Compare OTP with hash
  async compareOTP(otp, hash) {
    // In production, use proper comparison
    return btoa(otp + 'salt') === hash;
  }

  // Mask phone number for logging
  maskPhoneNumber(phone) {
    if (!phone || phone.length < 8) return '***';
    return `${phone.substring(0, 3)}****${phone.substring(phone.length - 4)}`;
  }

  // Log security events
  async logSecurityEvent(userId, eventType, metadata = {}, riskLevel = 'low') {
    try {
      await supabase.rpc('log_security_event', {
        p_user_id: userId,
        p_event_type: eventType,
        p_event_category: 'authentication',
        p_description: `OTP ${eventType.replace('otp_', '').replace('_', ' ')}`,
        p_risk_level: riskLevel,
        p_metadata: metadata
      });
    } catch (error) {
      console.error('Security Logging Error:', error);
    }
  }

  // Validate phone number format
  isValidPhoneNumber(phone) {
    // Basic international phone number validation
    const phoneRegex = /^\+?[1-9]\d{8,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // Format phone number for sending
  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Handle Nigerian numbers
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  }
}

export const otpService = new OTPService();