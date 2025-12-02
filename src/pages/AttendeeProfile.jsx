import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Ticket, Heart, Users, Settings, Camera, Mail, Phone, MapPin, Calendar, Edit2, Shield, Bell, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'

const mockUser = { name: 'John Doe', email: 'john@example.com', phone: '+234 801 234 5678', location: 'Lagos, Nigeria', bio: 'Event enthusiast and tech lover. Always looking for the next great experience!', memberSince: 'January 2024', eventsAttended: 12, ticketsPurchased: 24, following: 8 }

const mockTickets = [
  { id: '1', eventName: 'Lagos Tech Summit 2024', eventDate: 'December 15, 2024', ticketType: 'VIP', status: 'active', image: 'tech conference' },
  { id: '2', eventName: 'Afrobeats Festival', eventDate: 'December 25, 2024', ticketType: 'General Admission', status: 'active', image: 'music festival' },
]

const mockSaved = [
  { id: '1', eventName: 'Business Masterclass', eventDate: 'January 10, 2025', price: '₦20,000', image: 'business conference' },
  { id: '2', eventName: 'Art Gallery Opening', eventDate: 'January 15, 2025', price: 'Free', image: 'art exhibition' },
]

const mockFollowing = [
  { id: '1', name: 'Tech Events NG', events: 15, image: null },
  { id: '2', name: 'Lagos Concert Series', events: 8, image: null },
]

export function AttendeeProfile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(mockUser)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: user.name, email: user.email, phone: user.phone, location: user.location, bio: user.bio })

  const handleSave = () => {
    setUser({ ...user, ...editForm })
    setIsEditing(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="relative inline-block mb-4">
                  <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                    <AvatarImage src={null} />
                    <AvatarFallback className="bg-[#2969FF] text-white text-2xl">{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#2969FF] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#2969FF]/90">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-[#0F0F0F]">{user.name}</h2>
                <p className="text-[#0F0F0F]/60 text-sm">Member since {user.memberSince}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="text-center p-3 bg-[#F4F6FA] rounded-xl"><div className="text-xl font-bold text-[#0F0F0F]">{user.eventsAttended}</div><div className="text-xs text-[#0F0F0F]/60">Events</div></div>
                <div className="text-center p-3 bg-[#F4F6FA] rounded-xl"><div className="text-xl font-bold text-[#0F0F0F]">{user.ticketsPurchased}</div><div className="text-xs text-[#0F0F0F]/60">Tickets</div></div>
                <div className="text-center p-3 bg-[#F4F6FA] rounded-xl"><div className="text-xl font-bold text-[#0F0F0F]">{user.following}</div><div className="text-xs text-[#0F0F0F]/60">Following</div></div>
              </div>

              <Separator className="mb-4" />

              <nav className="space-y-1">
                {[{ icon: User, label: 'Profile', active: true }, { icon: Ticket, label: 'My Tickets', onClick: () => navigate('/tickets') }, { icon: Heart, label: 'Saved Events' }, { icon: Users, label: 'Following' }, { icon: Settings, label: 'Settings' }].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <button key={index} onClick={item.onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${item.active ? 'bg-[#2969FF]/10 text-[#2969FF]' : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'}`}>
                      <Icon className="w-5 h-5" /><span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>

              <Separator className="my-4" />

              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
                <LogOut className="w-5 h-5" /><span>Sign Out</span>
              </button>
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-3">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
              <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Profile</TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Tickets</TabsTrigger>
              <TabsTrigger value="saved" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Saved</TabsTrigger>
              <TabsTrigger value="following" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Following</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-[#0F0F0F]">Personal Information</CardTitle>
                  <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="rounded-xl border-[#0F0F0F]/10">
                    <Edit2 className="w-4 h-4 mr-2" />{isEditing ? 'Cancel' : 'Edit'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="rounded-xl" /></div>
                        <div className="space-y-2"><Label>Email</Label><Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="rounded-xl" /></div>
                        <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="rounded-xl" /></div>
                        <div className="space-y-2"><Label>Location</Label><Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="rounded-xl" /></div>
                      </div>
                      <div className="space-y-2"><Label>Bio</Label><Input value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} className="rounded-xl" /></div>
                      <Button onClick={handleSave} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">Save Changes</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[{ icon: Mail, label: 'Email', value: user.email }, { icon: Phone, label: 'Phone', value: user.phone }, { icon: MapPin, label: 'Location', value: user.location }].map((item, index) => {
                        const Icon = item.icon
                        return (
                          <div key={index} className="flex items-center gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center"><Icon className="w-5 h-5 text-[#2969FF]" /></div>
                            <div><p className="text-sm text-[#0F0F0F]/60">{item.label}</p><p className="text-[#0F0F0F]">{item.value}</p></div>
                          </div>
                        )
                      })}
                      <div className="p-4 bg-[#F4F6FA] rounded-xl"><p className="text-sm text-[#0F0F0F]/60 mb-1">Bio</p><p className="text-[#0F0F0F]">{user.bio}</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets">
              <div className="space-y-4">
                {mockTickets.map(ticket => (
                  <Card key={ticket.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex gap-4">
                        <div className="w-32 h-24 flex-shrink-0"><ImageWithFallback src={`https://source.unsplash.com/300x200/?${ticket.image}`} alt={ticket.eventName} className="w-full h-full object-cover" /></div>
                        <div className="flex-1 p-4">
                          <h3 className="font-semibold text-[#0F0F0F] mb-1">{ticket.eventName}</h3>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-2"><Calendar className="w-4 h-4" />{ticket.eventDate}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-lg">{ticket.ticketType}</Badge>
                            <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg capitalize">{ticket.status}</Badge>
                          </div>
                        </div>
                        <div className="p-4"><Button variant="outline" onClick={() => navigate('/tickets')} className="rounded-xl border-[#0F0F0F]/10">View</Button></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="saved">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mockSaved.map(event => (
                  <Card key={event.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                    <div className="aspect-video"><ImageWithFallback src={`https://source.unsplash.com/600x400/?${event.image}`} alt={event.eventName} className="w-full h-full object-cover" /></div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-[#0F0F0F] mb-2">{event.eventName}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 mb-3"><Calendar className="w-4 h-4" />{event.eventDate}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#2969FF]">{event.price}</span>
                        <Button size="sm" className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">Get Tickets</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="following">
              <div className="space-y-4">
                {mockFollowing.map(organizer => (
                  <Card key={organizer.id} className="border-[#0F0F0F]/10 rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-12 h-12"><AvatarFallback className="bg-[#2969FF]/10 text-[#2969FF]">{organizer.name[0]}</AvatarFallback></Avatar>
                          <div><h3 className="font-semibold text-[#0F0F0F]">{organizer.name}</h3><p className="text-sm text-[#0F0F0F]/60">{organizer.events} events</p></div>
                        </div>
                        <Button variant="outline" className="rounded-xl border-[#0F0F0F]/10">Following</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader><CardTitle className="text-[#0F0F0F] flex items-center gap-2"><Bell className="w-5 h-5" />Notifications</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {['Email notifications', 'SMS notifications', 'Event reminders', 'Marketing updates'].map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                        <span className="text-[#0F0F0F]">{item}</span>
                        <input type="checkbox" defaultChecked={index < 3} className="w-5 h-5 accent-[#2969FF]" />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-[#0F0F0F]/10 rounded-2xl">
                  <CardHeader><CardTitle className="text-[#0F0F0F] flex items-center gap-2"><Shield className="w-5 h-5" />Security</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" className="w-full rounded-xl border-[#0F0F0F]/10 justify-start">Change Password</Button>
                    <Button variant="outline" className="w-full rounded-xl border-[#0F0F0F]/10 justify-start">Enable Two-Factor Authentication</Button>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50 rounded-2xl">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-red-600 mb-2">Danger Zone</h3>
                    <p className="text-sm text-red-600/70 mb-4">Once you delete your account, there is no going back.</p>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-100 rounded-xl">Delete Account</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
