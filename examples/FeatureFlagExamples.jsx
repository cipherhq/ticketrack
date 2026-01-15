// Feature Flag Usage Examples
// This file demonstrates how to use the country-based feature flag system

import React from 'react';
import { useCountryFeatures, FeatureGate, usePaymentFeatures, useCommunicationFeatures } from '@/hooks/useCountryFeatures';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Example 1: Basic Feature Check in Component
export function EventCreationForm({ currency = 'NGN' }) {
  const { 
    isFeatureEnabled,
    canCreateVirtualEvents,
    canUseVenueDesigner,
    country 
  } = useCountryFeatures(currency);

  return (
    <div className="space-y-4">
      <h2>Create Event ({country})</h2>
      
      {/* Basic feature check */}
      {isFeatureEnabled('recurring_events') && (
        <div>
          <label>
            <input type="checkbox" />
            Make this a recurring event
          </label>
        </div>
      )}

      {/* Using shortcut methods */}
      {canCreateVirtualEvents && (
        <div>
          <label>
            <input type="radio" name="type" value="virtual" />
            Virtual Event
          </label>
        </div>
      )}

      {canUseVenueDesigner && (
        <Button>Design Venue Layout</Button>
      )}
    </div>
  );
}

// Example 2: Using FeatureGate Component
export function PaymentOptions({ currency = 'NGN' }) {
  return (
    <div className="space-y-4">
      <h3>Payment Options</h3>
      
      {/* Single feature gate */}
      <FeatureGate feature="payment_processing" currency={currency}>
        <Card>
          <CardContent className="p-4">
            <h4>Accept Payments</h4>
            <p>Enable paid ticketing for your events</p>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Multiple features (any one enabled) */}
      <FeatureGate 
        feature={['apple_wallet', 'google_wallet']} 
        currency={currency}
        fallback={<p>Digital wallets not available in your country</p>}
      >
        <Card>
          <CardContent className="p-4">
            <h4>Digital Wallets</h4>
            <p>Let customers save tickets to their phone</p>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Multiple features (all required) */}
      <FeatureGate 
        feature={['payment_processing', 'refunds']} 
        currency={currency}
        requireAll={true}
        fallback={<p>Refunds not available</p>}
      >
        <Card>
          <CardContent className="p-4">
            <h4>Refund Policy</h4>
            <p>Configure automatic refunds</p>
          </CardContent>
        </Card>
      </FeatureGate>
    </div>
  );
}

// Example 3: Using Specialized Hooks
export function CommunicationSettings({ currency = 'NGN' }) {
  const paymentFeatures = usePaymentFeatures(currency);
  const commFeatures = useCommunicationFeatures(currency);

  return (
    <div className="space-y-4">
      <h3>Marketing Tools</h3>
      
      {/* Email is usually available everywhere */}
      {commFeatures.email_campaigns && (
        <Button>Create Email Campaign</Button>
      )}

      {/* SMS mainly for Nigeria */}
      {commFeatures.sms_campaigns && (
        <Button>Send SMS Campaign</Button>
      )}

      {/* WhatsApp for Nigeria and Ghana */}
      {commFeatures.whatsapp_campaigns && (
        <Button>WhatsApp Marketing</Button>
      )}

      {/* Payment features */}
      <div className="mt-6">
        <h4>Payment Features Available:</h4>
        <ul>
          {paymentFeatures.payment_processing && <li>✅ Payment Processing</li>}
          {paymentFeatures.refunds && <li>✅ Refunds</li>}
          {paymentFeatures.payouts && <li>✅ Automated Payouts</li>}
          {paymentFeatures.subscription_billing && <li>✅ Subscription Billing</li>}
        </ul>
      </div>
    </div>
  );
}

// Example 4: Conditional Navigation/Menu Items
export function NavigationMenu({ currency = 'NGN' }) {
  const { 
    isFeatureEnabled, 
    canSendSMS, 
    canUseIoT, 
    canAccessAPI,
    country 
  } = useCountryFeatures(currency);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', always: true },
    { name: 'Events', path: '/events', always: true },
    { name: 'SMS Campaigns', path: '/sms', show: canSendSMS },
    { name: 'Venue IoT', path: '/iot', show: canUseIoT },
    { name: 'API Access', path: '/api', show: canAccessAPI },
    { name: 'Affiliates', path: '/affiliates', show: isFeatureEnabled('affiliate_program') },
  ];

  return (
    <nav>
      <p className="text-sm text-gray-600">Features for {country}</p>
      <ul>
        {menuItems.map(item => (
          (item.always || item.show) && (
            <li key={item.name}>
              <a href={item.path}>{item.name}</a>
            </li>
          )
        ))}
      </ul>
    </nav>
  );
}

// Example 5: Country-Specific Business Logic
export function EventPricingCalculator({ currency = 'NGN', eventPrice = 100 }) {
  const { 
    supportsTaxReporting, 
    requiresKYC, 
    isFeatureEnabled,
    country 
  } = useCountryFeatures(currency);

  // Different fee structures by country
  const getFees = () => {
    const baseFee = eventPrice * 0.05; // 5% base fee
    let processingFee = 0;
    let taxes = 0;

    // Country-specific logic
    if (country === 'NG') {
      processingFee = eventPrice * 0.015; // 1.5% for Nigeria (Paystack)
    } else if (country === 'US' || country === 'GB') {
      processingFee = eventPrice * 0.029; // 2.9% for US/UK (Stripe)
      if (supportsTaxReporting) {
        taxes = eventPrice * 0.08; // 8% tax in US/UK
      }
    }

    return { baseFee, processingFee, taxes };
  };

  const { baseFee, processingFee, taxes } = getFees();
  const totalFees = baseFee + processingFee + taxes;

  return (
    <div className="p-4 border rounded-lg">
      <h4>Pricing Breakdown ({country})</h4>
      <div className="space-y-2 text-sm">
        <div>Event Price: {currency} {eventPrice}</div>
        <div>Platform Fee: {currency} {baseFee.toFixed(2)}</div>
        <div>Processing Fee: {currency} {processingFee.toFixed(2)}</div>
        {supportsTaxReporting && taxes > 0 && (
          <div>Taxes: {currency} {taxes.toFixed(2)}</div>
        )}
        <div className="font-bold">
          Total Fees: {currency} {totalFees.toFixed(2)}
        </div>
      </div>

      {requiresKYC && (
        <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            ⚠️ KYC verification required for payouts in {country}
          </p>
        </div>
      )}
    </div>
  );
}

// Example 6: Compliance and Legal Features
export function ComplianceNotice({ currency = 'NGN' }) {
  const { 
    requiresGDPR, 
    supportsTaxReporting, 
    requiresKYC,
    country 
  } = useCountryFeatures(currency);

  if (!requiresGDPR && !supportsTaxReporting && !requiresKYC) {
    return null; // No compliance requirements
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="font-medium text-blue-900">
        Compliance Requirements for {country}
      </h4>
      <ul className="mt-2 space-y-1 text-sm text-blue-800">
        {requiresGDPR && (
          <li>• GDPR compliance required for data processing</li>
        )}
        {supportsTaxReporting && (
          <li>• Automated tax reporting enabled</li>
        )}
        {requiresKYC && (
          <li>• KYC verification required for organizers</li>
        )}
      </ul>
    </div>
  );
}

// Example 7: Advanced Usage - Feature-based Component Loading
export function DynamicFeatureLoader({ currency = 'NGN' }) {
  const { checkFeatures, country } = useCountryFeatures(currency);

  const features = checkFeatures([
    'venue_management',
    'iot_integration', 
    'api_access',
    'white_label'
  ]);

  return (
    <div className="space-y-4">
      <h3>Advanced Features ({country})</h3>
      
      {features.venue_management && (
        <Card>
          <CardContent className="p-4">
            <h4>Venue Designer</h4>
            <p>Design your event venue layout</p>
          </CardContent>
        </Card>
      )}

      {features.iot_integration && (
        <Card>
          <CardContent className="p-4">
            <h4>IoT Monitoring</h4>
            <p>Real-time venue monitoring with sensors</p>
          </CardContent>
        </Card>
      )}

      {features.api_access && (
        <Card>
          <CardContent className="p-4">
            <h4>Developer API</h4>
            <p>Integrate with third-party applications</p>
          </CardContent>
        </Card>
      )}

      {features.white_label && (
        <Card>
          <CardContent className="p-4">
            <h4>White Label Solution</h4>
            <p>Brand the platform with your company logo</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Usage in your main app:
/*
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';

function App() {
  return (
    <FeatureFlagsProvider currency="NGN">
      <EventCreationForm />
      <PaymentOptions currency="NGN" />
      <CommunicationSettings currency="GBP" />
    </FeatureFlagsProvider>
  );
}
*/