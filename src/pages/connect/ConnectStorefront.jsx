/**
 * Connected Account Storefront
 *
 * This component displays products from a connected account
 * and allows customers to purchase them using Stripe Checkout.
 *
 * URL: /connect/store/:accountId
 *
 * IMPORTANT: In production, you should use a different identifier
 * (like a username or slug) instead of exposing the Stripe account ID.
 * The account ID is used here for simplicity in this demo.
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Store,
  ShoppingCart,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

/**
 * API Helper Functions
 */
const api = {
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

  /**
   * Get account status (for display name)
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
   * Create a checkout session for a product
   */
  createCheckout: async (accountId, priceId, productName, priceInCents) => {
    const { data, error } = await supabase.functions.invoke('stripe-connect-v2/create-checkout', {
      body: {
        accountId,
        priceId,
        productName,
        priceInCents,
        quantity: 1,
        applicationFeePercent: 10, // Platform takes 10% fee
        successUrl: `${window.location.origin}/connect/checkout-success?session_id={CHECKOUT_SESSION_ID}&accountId=${accountId}`,
        cancelUrl: `${window.location.origin}/connect/store/${accountId}?cancelled=true`,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return data;
  },
};

/**
 * Product Card Component
 */
function ProductCard({ product, onBuy, loading }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="aspect-square bg-muted relative">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-[#2969FF]">
            {product.price?.formatted || 'Price not set'}
          </span>
          <Button
            size="sm"
            onClick={() => onBuy(product)}
            disabled={loading || !product.price}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-1" />
                Buy
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Storefront Component
 */
export function ConnectStorefront() {
  /**
   * IMPORTANT: Using accountId in the URL is for demo purposes only.
   * In production, use a different identifier (username, slug, etc.)
   * and look up the accountId in your database.
   */
  const { accountId } = useParams();
  const [searchParams] = useSearchParams();

  // State
  const [account, setAccount] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingProductId, setBuyingProductId] = useState(null);
  const [error, setError] = useState('');

  // Check for cancelled checkout
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      setError('Checkout was cancelled. Feel free to try again.');
    }
  }, [searchParams]);

  // Load store data
  useEffect(() => {
    if (accountId) {
      loadStoreData();
    }
  }, [accountId]);

  /**
   * Load the store's account info and products
   */
  const loadStoreData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load account info and products in parallel
      const [accountResult, productsResult] = await Promise.all([
        api.getAccountStatus(accountId),
        api.listProducts(accountId),
      ]);

      setAccount(accountResult);
      setProducts(productsResult.products || []);

      // Check if account can accept payments
      if (!accountResult.status.readyToProcessPayments) {
        setError('This store is not yet ready to accept payments.');
      }
    } catch (err) {
      console.error('Error loading store:', err);
      setError(err.message || 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle buying a product
   *
   * This creates a Stripe Checkout session and redirects the customer.
   * The payment uses Direct Charges, meaning:
   * - The connected account is the merchant of record
   * - The platform takes an application fee (10% in this demo)
   */
  const handleBuy = async (product) => {
    if (!product.price) return;

    setBuyingProductId(product.id);
    setError('');

    try {
      const result = await api.createCheckout(
        accountId,
        product.price.id,
        product.name,
        product.price.amount
      );

      // Redirect to Stripe Checkout
      window.location.href = result.url;
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err.message || 'Failed to start checkout');
      setBuyingProductId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading store...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b border-border/20 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/connect/demo"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#2969FF]" />
                  {account?.displayName || 'Store'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {products.length} product{products.length !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>

            {/* Status Badge */}
            {account?.status?.readyToProcessPayments ? (
              <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Accepting Payments
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Setup Required
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onBuy={handleBuy}
                loading={buyingProductId === product.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No Products Yet
            </h2>
            <p className="text-muted-foreground mb-6">
              This store hasn't added any products yet.
            </p>
            <Link to="/connect/demo">
              <Button variant="outline">
                Back to Demo
              </Button>
            </Link>
          </div>
        )}

        {/* Platform Fee Notice */}
        {products.length > 0 && (
          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>
              Payments are processed securely through Stripe.
              <br />
              Platform fee: 10% per transaction.
            </p>
          </div>
        )}
      </main>

      {/* Footer with Documentation Note */}
      <footer className="border-t border-border/20 bg-card mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            {/* IMPORTANT: This comment explains the URL structure */}
            Demo storefront using account ID in URL. In production, use a username or slug instead.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ConnectStorefront;
