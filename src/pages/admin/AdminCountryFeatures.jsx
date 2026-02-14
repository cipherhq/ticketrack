import { useState, useEffect } from 'react';
import { 
  Settings, Globe, Check, X, Search, Filter, 
  CreditCard, Calendar, Ticket, Mail, TrendingUp, 
  Smartphone, Shield, RefreshCw, Save, Loader2,
  AlertCircle, CheckCircle, Eye, EyeOff, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const CATEGORY_ICONS = {
  payments: CreditCard,
  events: Calendar,
  tickets: Ticket,
  communication: Mail,
  marketing: TrendingUp,
  advanced: Settings,
  mobile: Smartphone,
  compliance: Shield,
};

export function AdminCountryFeatures() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState(new Set());
  const [changeLog, setChangeLog] = useState([]);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(new Map());
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareCountries, setCompareCountries] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load countries
      const { data: countriesData, error: countriesError } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (countriesError) {
        console.error('Countries error:', countriesError);
        setCountries([]);
      } else {
        setCountries(countriesData || []);
      }

      // Load feature categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('feature_categories')
        .select('*')
        .order('sort_order');

      if (categoriesError) {
        console.error('Categories error:', categoriesError);
        setCategories([]);
      } else {
        setCategories(categoriesData || []);
      }

      // Load all country features with countries and categories
      const { data: featuresData, error: featuresError } = await supabase
        .from('country_features')
        .select(`
          *,
          countries:country_code (code, name, default_currency)
        `)
        .order('country_code, category, feature_name');

      if (featuresError) {
        console.error('Features error:', featuresError);
        setFeatures([]);
      } else {
        setFeatures(featuresData || []);
      }

      // Load recent change logs
      const { data: logsData, error: logsError } = await supabase
        .from('admin_feature_logs')
        .select(`
          *,
          countries:country_code (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) {
        console.error('Logs error:', logsError);
        setChangeLog([]);
      } else {
        setChangeLog(logsData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays as fallbacks
      setCountries([]);
      setCategories([]);
      setFeatures([]);
      setChangeLog([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter features based on selected country, category, and search
  const filteredFeatures = features.filter(feature => {
    if (selectedCountry && selectedCountry !== 'all' && feature.country_code !== selectedCountry) return false;
    if (selectedCategory !== 'all' && feature.category !== selectedCategory) return false;
    if (searchTerm && !feature.feature_name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !feature.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Group features by country for display
  const groupedFeatures = filteredFeatures.reduce((acc, feature) => {
    if (!acc[feature.country_code]) {
      acc[feature.country_code] = [];
    }
    acc[feature.country_code].push(feature);
    return acc;
  }, {});

  // Get feature statistics
  const getFeatureStats = () => {
    const stats = {
      totalFeatures: features.length,
      enabledFeatures: features.filter(f => f.is_enabled).length,
      countriesWithFeatures: new Set(features.map(f => f.country_code)).size,
      categoriesActive: new Set(features.map(f => f.category)).size,
    };
    return stats;
  };

  // Toggle feature for a country
  const toggleFeature = async (countryCode, featureName, currentValue, reason = '') => {
    const key = `${countryCode}-${featureName}`;
    const newValue = !currentValue;
    
    // Add to pending changes
    const newPendingChanges = new Map(pendingChanges);
    newPendingChanges.set(key, {
      countryCode,
      featureName,
      oldValue: currentValue,
      newValue,
      reason: reason || `${newValue ? 'Enabled' : 'Disabled'} by admin`
    });
    setPendingChanges(newPendingChanges);

    // Update local state immediately for UI feedback
    setFeatures(prev => prev.map(f => 
      f.country_code === countryCode && f.feature_name === featureName 
        ? { ...f, is_enabled: newValue }
        : f
    ));
  };

  // Save all pending changes
  const saveAllChanges = async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    try {
      const updates = [];
      const logs = [];

      for (const [key, change] of pendingChanges) {
        updates.push({
          country_code: change.countryCode,
          feature_name: change.featureName,
          is_enabled: change.newValue,
          updated_at: new Date().toISOString()
        });

        logs.push({
          admin_user_id: user?.id,
          country_code: change.countryCode,
          feature_name: change.featureName,
          old_value: change.oldValue,
          new_value: change.newValue,
          reason: change.reason
        });
      }

      // Update features
      for (const update of updates) {
        await supabase
          .from('country_features')
          .update({ 
            is_enabled: update.is_enabled,
            updated_at: update.updated_at 
          })
          .match({ 
            country_code: update.country_code, 
            feature_name: update.feature_name 
          });
      }

      // Log changes
      if (logs.length > 0) {
        await supabase
          .from('admin_feature_logs')
          .insert(logs);
      }

      setPendingChanges(new Map());
      await loadData(); // Refresh data
      
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Bulk enable/disable features
  const bulkToggleFeatures = async (enable, reason = '') => {
    if (selectedFeatures.size === 0) return;

    const newPendingChanges = new Map(pendingChanges);
    
    selectedFeatures.forEach(featureKey => {
      const [countryCode, featureName] = featureKey.split('-');
      const feature = features.find(f => f.country_code === countryCode && f.feature_name === featureName);
      
      if (feature && feature.is_enabled !== enable) {
        newPendingChanges.set(featureKey, {
          countryCode,
          featureName,
          oldValue: feature.is_enabled,
          newValue: enable,
          reason: reason || `Bulk ${enable ? 'enabled' : 'disabled'} by admin`
        });
      }
    });

    setPendingChanges(newPendingChanges);
    setSelectedFeatures(new Set());
    setBulkEditMode(false);

    // Update local state
    setFeatures(prev => prev.map(f => {
      const key = `${f.country_code}-${f.feature_name}`;
      if (selectedFeatures.has(key)) {
        return { ...f, is_enabled: enable };
      }
      return f;
    }));
  };

  // Copy features from one country to another
  const copyCountryFeatures = async (fromCountry, toCountry) => {
    const fromFeatures = features.filter(f => f.country_code === fromCountry);
    const newPendingChanges = new Map(pendingChanges);

    fromFeatures.forEach(feature => {
      const key = `${toCountry}-${feature.feature_name}`;
      const toFeature = features.find(f => f.country_code === toCountry && f.feature_name === feature.feature_name);
      
      if (toFeature && toFeature.is_enabled !== feature.is_enabled) {
        newPendingChanges.set(key, {
          countryCode: toCountry,
          featureName: feature.feature_name,
          oldValue: toFeature.is_enabled,
          newValue: feature.is_enabled,
          reason: `Copied from ${fromCountry}`
        });
      }
    });

    setPendingChanges(newPendingChanges);

    // Update local state
    setFeatures(prev => prev.map(f => {
      if (f.country_code === toCountry) {
        const sourceFeature = fromFeatures.find(sf => sf.feature_name === f.feature_name);
        if (sourceFeature) {
          return { ...f, is_enabled: sourceFeature.is_enabled };
        }
      }
      return f;
    }));
  };

  const stats = getFeatureStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Country Feature Management</h2>
          <p className="text-muted-foreground">Control which features are available in each country</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChangeLog(!showChangeLog)}
            className="rounded-xl"
          >
            <Eye className="w-4 h-4 mr-2" />
            Change Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setComparisonMode(!comparisonMode)}
            className="rounded-xl"
          >
            <Users className="w-4 h-4 mr-2" />
            Compare
          </Button>
          <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {pendingChanges.size > 0 && (
            <Button 
              onClick={saveAllChanges} 
              disabled={saving}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes ({pendingChanges.size})
            </Button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Features</p>
                <p className="text-2xl font-semibold">{stats.totalFeatures}</p>
              </div>
              <Settings className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enabled</p>
                <p className="text-2xl font-semibold text-green-600">{stats.enabledFeatures}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Countries</p>
                <p className="text-2xl font-semibold">{stats.countriesWithFeatures}</p>
              </div>
              <Globe className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-semibold">{stats.categoriesActive}</p>
              </div>
              <Filter className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Changes Alert */}
      {pendingChanges.size > 0 && (
        <Card className="border-orange-300 bg-orange-50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <div className="flex-1">
              <p className="font-medium text-orange-800">Unsaved Changes</p>
              <p className="text-sm text-orange-700">
                You have {pendingChanges.size} pending changes. Remember to save them.
              </p>
            </div>
            <Button
              onClick={saveAllChanges}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
            >
              Save Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <Label>Search Features</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by feature name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
            <div className="min-w-48">
              <Label>Country</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-48">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => {
                    const Icon = CATEGORY_ICONS[category.name] || Settings;
                    return (
                      <SelectItem key={category.name} value={category.name}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {bulkEditMode && (
        <Card className="border-blue-300 bg-blue-50 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  {selectedFeatures.size} features selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleFeatures(true)}
                  className="rounded-xl"
                >
                  Enable All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleFeatures(false)}
                  className="rounded-xl"
                >
                  Disable All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkEditMode(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features by Country */}
      <div className="space-y-4">
        {loading ? (
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <Loader2 className="w-12 h-12 text-[#2969FF] mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading country features...</p>
            </CardContent>
          </Card>
        ) : countries.length === 0 || features.length === 0 ? (
          <Card className="border-orange-300 bg-orange-50 rounded-2xl">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
              <h3 className="font-medium text-orange-800 mb-2">Setup Required</h3>
              <p className="text-orange-700 mb-4">
                Country features database tables are not set up yet.
              </p>
              <p className="text-sm text-orange-600">
                Please run the database deployment script in Supabase SQL Editor first.
              </p>
            </CardContent>
          </Card>
        ) : Object.keys(groupedFeatures).length === 0 ? (
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <Filter className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">No features match your current filters</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedFeatures).map(([countryCode, countryFeatures]) => {
            const country = countries.find(c => c.code === countryCode);
            const enabledCount = countryFeatures.filter(f => f.is_enabled).length;
            const totalCount = countryFeatures.length;

            return (
              <Card key={countryCode} className="border-border/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-[#2969FF]" />
                      <span>{country?.name || countryCode}</span>
                      <Badge variant="outline">
                        {enabledCount}/{totalCount} enabled
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkEditMode(!bulkEditMode)}
                        className="rounded-xl"
                      >
                        Bulk Edit
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {countryFeatures.map((feature) => {
                      const featureKey = `${feature.country_code}-${feature.feature_name}`;
                      const isPending = pendingChanges.has(featureKey);
                      const Icon = CATEGORY_ICONS[feature.category] || Settings;

                      return (
                        <div
                          key={featureKey}
                          className={`p-4 border rounded-xl transition-colors ${
                            isPending 
                              ? 'border-orange-300 bg-orange-50' 
                              : 'border-border/10 bg-card hover:border-[#2969FF]/20'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {bulkEditMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedFeatures.has(featureKey)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedFeatures);
                                    if (e.target.checked) {
                                      newSelected.add(featureKey);
                                    } else {
                                      newSelected.delete(featureKey);
                                    }
                                    setSelectedFeatures(newSelected);
                                  }}
                                  className="rounded"
                                />
                              )}
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium capitalize">
                                {feature.feature_name.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <Switch
                              checked={feature.is_enabled}
                              onCheckedChange={() => toggleFeature(
                                feature.country_code, 
                                feature.feature_name, 
                                feature.is_enabled
                              )}
                            />
                          </div>
                          {feature.description && (
                            <p className="text-xs text-muted-foreground mb-2">
                              {feature.description}
                            </p>
                          )}
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              feature.is_enabled 
                                ? 'border-green-300 text-green-700' 
                                : 'border-red-300 text-red-700'
                            }`}
                          >
                            {feature.category}
                          </Badge>
                          {isPending && (
                            <Badge className="ml-2 bg-orange-100 text-orange-800 text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Change Log Dialog */}
      <Dialog open={showChangeLog} onOpenChange={setShowChangeLog}>
        <DialogContent className="max-w-4xl max-h-[80vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Feature Change Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto max-h-[60vh]">
            {changeLog.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No changes logged yet</p>
            ) : (
              changeLog.map((log) => (
                <div key={log.id} className="p-3 border rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={log.new_value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {log.new_value ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <span className="font-medium">
                        {log.feature_name.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        in {log.countries?.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="text-sm text-muted-foreground">{log.reason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}