import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { User, Mail, Phone, MapPin, Camera, Shield, Bell, CreditCard, LogOut } from 'lucide-react'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, signOut, updateProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [countries, setCountries] = useState([])
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    country_code: ''
  })

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/profile')
      return
    }
    fetchCountries()
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        country_code: profile.country_code || ''
      })
    }
  }, [user, profile])

  const fetchCountries = async () => {
    const { data } = await supabase
      .from('countries')
      .select('*')
      .eq('is_active', true)
    if (data) setCountries(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const { error } = await updateProfile(formData)

    if (error) {
      setError(error.message || 'Failed to update profile')
    } else {
      setSuccess('Profile updated successfully!')
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-primary-100 mt-2">Manage your account settings</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <Card className="p-6">
              {/* Avatar */}
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                  <User className="w-12 h-12 text-primary-500" />
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-lg">{profile?.full_name || 'User'}</h3>
                <p className="text-gray-500 text-sm">{user.email}</p>
              </div>

              {/* Quick Links */}
              <nav className="space-y-1">
                <a href="#profile" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 text-primary-500 font-medium">
                  <User className="w-5 h-5" />
                  Profile Settings
                </a>
                <a href="#notifications" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50">
                  <Bell className="w-5 h-5" />
                  Notifications
                </a>
                <a href="#security" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50">
                  <Shield className="w-5 h-5" />
                  Security
                </a>
                <a href="#payment" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50">
                  <CreditCard className="w-5 h-5" />
                  Payment Methods
                </a>
              </nav>

              <hr className="my-4" />

              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 w-full"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </Card>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2">
            {success && (
              <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl mb-6">
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6">
                {error}
              </div>
            )}

            <Card className="p-6" id="profile">
              <h2 className="text-xl font-bold mb-6">Profile Settings</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="pl-10"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="email"
                      value={user.email}
                      className="pl-10 bg-gray-50"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-10"
                      placeholder="+234 801 234 5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Select
                      value={formData.country_code}
                      onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      className="pl-10"
                    >
                      <option value="">Select your country</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <Button type="submit" loading={loading}>
                  Save Changes
                </Button>
              </form>
            </Card>

            {/* Security Section */}
            <Card className="p-6 mt-6" id="security">
              <h2 className="text-xl font-bold mb-6">Security</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-gray-500">Last changed: Never</p>
                  </div>
                  <Button variant="outline" size="sm">Change Password</Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-500">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" size="sm">Enable</Button>
                </div>
              </div>
            </Card>

            {/* Danger Zone */}
            <Card className="p-6 mt-6 border-red-200">
              <h2 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h2>
              <p className="text-gray-600 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button variant="danger">Delete Account</Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
