/**
 * Stripe Connect Demo (Express Accounts)
 *
 * This component demonstrates the full Stripe Connect integration:
 * 1. Creating Express connected accounts
 * 2. Onboarding connected accounts via Stripe-hosted flow
 * 3. Creating products on connected accounts
 * 4. Managing account status
 *
 * USAGE:
 * Add this route to your app: /connect/demo
 *
 * IMPORTANT: Make sure to set up the edge function and environment variables first.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  ExternalLink,
  Store,
  CreditCard,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

/**
 * API Helper Functions
 *
 * These functions call our edge function endpoints.
 * In production, you might want to move these to a separate service file.
 */
const api = {
  /**
   * Create a new connected account (Express)
   * @param email - Contact email for the account
   * @param country - Two-letter country code (e.g., 'US', 'GB')
   * @param businessName - Optional business/display name
   */
  createAccount: async (email, country = 'US', businessName = '') => {
    const { data, error } = await supabase.functions.invoke('stripe-connect-v2/create-account', {
      body: { email, country, businessName },
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return data;
  },

  /**
   * Create an onboarding link for an account
   * User will be redirected to Stripe's hosted onboarding flow
   */
  createAccountLink: async (accountId) => {
    const { data, error } = await supabase.functions.invoke('stripe-connect-v2/create-account-link', {
      body: {
        accountId,
        returnUrl: `${window.location.origin}/connect/demo?accountId=${accountId}&onboarding=complete`,
        refreshUrl: `${window.location.origin}/connect/demo?accountId=${accountId}&onboarding=refresh`,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return data;
  },

  /**
   * Get the status of a connected account
   * Checks charges_enabled, payouts_enabled, and requirements
   */
  getAccountStatus: async (accountId) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect-v2/get-account-status?accountId=${accountId}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result;
  },

  /**
   * Create a product on a connected account
   * Product will appear in their Stripe Dashboard
   */
  createProduct: async (accountId, name, description, priceInCents, currency = 'usd') => {
    const { data, error } = await supabase.functions.invoke('stripe-connect-v2/create-product', {
      body: { accountId, name, description, priceInCents, currency },
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return data;
  },

  /**
   * List products from a connected account
   */
  listProducts: async (accountId) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect-v2/list-products?accountId=${accountId}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result;
  },
};

/**
 * Status Badge Component
 *
 * Displays a colored badge based on status
 */
function StatusBadge({ status, label }) {
  const configs = {
    active: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    pending: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
    inactive: { color: 'bg-muted text-foreground/80', icon: XCircle },
    restricted: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
  };

  const config = configs[status] || configs.inactive;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {label || status}
    </Badge>
  );
}

/**
 * Main Demo Component
 */
export function StripeConnectV2Demo() {
  const [searchParams] = useSearchParams();

  // Form state for creating accounts
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('US');

  // Account state
  const [accountId, setAccountId] = useState(searchParams.get('accountId') || '');
  const [accountStatus, setAccountStatus] = useState(null);

  // Product form state
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [products, setProducts] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check for return from onboarding
  useEffect(() => {
    const onboarding = searchParams.get('onboarding');
    const returnedAccountId = searchParams.get('accountId');

    if (returnedAccountId) {
      setAccountId(returnedAccountId);
    }

    if (onboarding === 'complete') {
      setSuccess('Onboarding completed! Checking account status...');
      if (returnedAccountId) {
        loadAccountStatus(returnedAccountId);
      }
    } else if (onboarding === 'refresh') {
      setError('Onboarding link expired. Please click "Continue Onboarding" to try again.');
    }
  }, [searchParams]);

  // Load account status when accountId changes
  useEffect(() => {
    if (accountId) {
      loadAccountStatus(accountId);
      loadProducts(accountId);
    }
  }, [accountId]);

  /**
   * Load account status from Stripe
   */
  const loadAccountStatus = async (id) => {
    try {
      const result = await api.getAccountStatus(id);
      setAccountStatus(result);
    } catch (err) {
      console.error('Error loading account status:', err);
      setError(err.message);
    }
  };

  /**
   * Load products from the connected account
   */
  const loadProducts = async (id) => {
    try {
      const result = await api.listProducts(id);
      setProducts(result.products || []);
    } catch (err) {
      console.error('Error loading products:', err);
      // Don't show error for products - account might not have any
    }
  };

  /**
   * Create a new connected account
   */
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.createAccount(email, country, businessName);
      setAccountId(result.accountId);
      setSuccess(`Express account created: ${result.accountId}`);

      // Clear form
      setBusinessName('');
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start the onboarding flow
   */
  const handleStartOnboarding = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.createAccountLink(accountId);
      // Redirect to Stripe's onboarding
      window.location.href = result.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  /**
   * Create a new product
   */
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convert price from dollars to cents
      const priceInCents = Math.round(parseFloat(productPrice) * 100);

      await api.createProduct(accountId, productName, productDescription, priceInCents);
      setSuccess('Product created successfully!');

      // Clear form and reload products
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      loadProducts(accountId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Stripe Connect Demo
          </h1>
          <p className="text-muted-foreground">
            Express accounts with Stripe-hosted onboarding, products, and checkout
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button onClick={() => setError('')} className="ml-auto text-red-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800">{success}</p>
            <button onClick={() => setSuccess('')} className="ml-auto text-green-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 1: Create Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#2969FF] text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              Create Connected Account
            </CardTitle>
            <CardDescription>
              Create a new Stripe Express account for a seller/merchant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name (optional)</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-10 px-3 border border-border/30 rounded-lg"
                >
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="IE">Ireland</option>
                  <option value="NL">Netherlands</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="bg-[#2969FF]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Express Account
              </Button>
            </form>

            {/* Show created account ID */}
            {accountId && (
              <div className="mt-4 p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">Connected Account ID:</p>
                <code className="text-sm font-mono text-[#2969FF]">{accountId}</code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Onboarding */}
        {accountId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2969FF] text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                Onboard Account
              </CardTitle>
              <CardDescription>
                Complete Stripe's hosted onboarding to verify identity and enable payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account Status */}
              {accountStatus && (
                <div className="bg-background rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Account Status</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadAccountStatus(accountId)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Details Submitted</p>
                      <StatusBadge
                        status={accountStatus.status.detailsSubmitted ? 'active' : 'pending'}
                        label={accountStatus.status.detailsSubmitted ? 'Yes' : 'No'}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Charges Enabled</p>
                      <StatusBadge
                        status={accountStatus.status.chargesEnabled ? 'active' : 'pending'}
                        label={accountStatus.status.chargesEnabled ? 'Yes' : 'No'}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Payouts Enabled</p>
                      <StatusBadge
                        status={accountStatus.status.payoutsEnabled ? 'active' : 'pending'}
                        label={accountStatus.status.payoutsEnabled ? 'Yes' : 'No'}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Card Payments</p>
                      <StatusBadge
                        status={accountStatus.status.cardPaymentsStatus}
                        label={accountStatus.status.cardPaymentsStatus}
                      />
                    </div>
                  </div>

                  {accountStatus.status.readyToProcessPayments && (
                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                      Account is fully verified and ready to process payments!
                    </div>
                  )}

                  {/* Outstanding Requirements */}
                  {(accountStatus.requirements.currentlyDue.length > 0 ||
                    accountStatus.requirements.pastDue.length > 0) && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800 mb-2">
                        Outstanding Requirements:
                      </p>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        {accountStatus.requirements.pastDue.map((req, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            {req} (past due)
                          </li>
                        ))}
                        {accountStatus.requirements.currentlyDue.map((req, i) => (
                          <li key={i}>• {req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Disabled Reason */}
                  {accountStatus.requirements.disabledReason && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm font-medium text-red-800">
                        Account Disabled: {accountStatus.requirements.disabledReason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Onboarding Button */}
              {!accountStatus?.status?.readyToProcessPayments && (
                <Button
                  onClick={handleStartOnboarding}
                  disabled={loading}
                  className="bg-[#635BFF] hover:bg-[#635BFF]/90 gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {accountStatus?.status?.detailsSubmitted
                    ? 'Continue Onboarding'
                    : 'Start Onboarding with Stripe'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Create Products */}
        {accountId && accountStatus?.status?.readyToProcessPayments && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2969FF] text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                Create Products
              </CardTitle>
              <CardDescription>
                Add products to the connected account's catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <Input
                      id="productName"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Premium Widget"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productPrice">Price (USD)</Label>
                    <Input
                      id="productPrice"
                      type="number"
                      step="0.01"
                      min="0.50"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="29.99"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productDescription">Description</Label>
                  <Input
                    id="productDescription"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="A high-quality widget for all your needs"
                  />
                </div>
                <Button type="submit" disabled={loading} className="bg-[#2969FF]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Product
                </Button>
              </form>

              {/* Product List */}
              {products.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Products ({products.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="border rounded-lg p-3 flex items-center gap-3"
                      >
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Store className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-[#2969FF] font-semibold">
                            {product.price?.formatted || 'No price'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: View Storefront */}
        {accountId && accountStatus?.status?.readyToProcessPayments && products.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2969FF] text-white rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </div>
                View Storefront
              </CardTitle>
              <CardDescription>
                See the connected account's storefront where customers can purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={`/connect/store/${accountId}`}>
                <Button className="bg-green-600 hover:bg-green-700 gap-2">
                  <Store className="w-4 h-4" />
                  Open Storefront
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2">
                {/* IMPORTANT: In production, use a different identifier (like a slug or username)
                    instead of exposing the Stripe account ID in the URL */}
                Storefront URL: /connect/store/{accountId}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Documentation Links */}
        <Card className="bg-[#0F0F0F] text-white">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">Webhook Setup</h3>
            <p className="text-white/80 text-sm mb-4">
              To listen for account updates, set up webhooks for Connect events:
            </p>
            <pre className="bg-card/10 p-3 rounded text-xs overflow-x-auto">
              {`# Local development
stripe listen --forward-to localhost:54321/functions/v1/stripe-connect-v2/webhook

# Also forward Connect events
stripe listen --forward-connect-to localhost:54321/functions/v1/stripe-connect-v2/webhook`}
            </pre>
            <p className="text-white/60 text-xs mt-3 mb-4">
              Key events: account.updated, checkout.session.completed, payment_intent.succeeded
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href="https://docs.stripe.com/connect/express-accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#635BFF] text-sm hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Express Accounts
              </a>
              <a
                href="https://docs.stripe.com/connect/direct-charges"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#635BFF] text-sm hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Direct Charges
              </a>
              <a
                href="https://docs.stripe.com/connect/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#635BFF] text-sm hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Connect Webhooks
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default StripeConnectV2Demo;
