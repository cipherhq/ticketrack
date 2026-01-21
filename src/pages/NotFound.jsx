import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F6FA] to-white flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-[150px] md:text-[200px] font-bold text-[#2969FF]/10 leading-none select-none">
            404
          </div>
          <div className="relative -mt-20 md:-mt-28">
            <div className="w-24 h-24 md:w-32 md:h-32 mx-auto bg-[#2969FF] rounded-2xl flex items-center justify-center shadow-xl">
              <Calendar className="w-12 h-12 md:w-16 md:h-16 text-white" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-4">
          Page Not Found
        </h1>
        <p className="text-[#0F0F0F]/60 text-lg mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12 px-6"
          >
            <Link to="/">
              <Home className="w-5 h-5 mr-2" />
              Go Home
            </Link>
          </Button>
          
          <Button
            asChild
            variant="outline"
            className="border-[#0F0F0F]/10 text-[#0F0F0F] rounded-xl h-12 px-6"
          >
            <Link to="/events">
              <Search className="w-5 h-5 mr-2" />
              Browse Events
            </Link>
          </Button>
        </div>

        {/* Back Link */}
        <button
          onClick={() => window.history.back()}
          className="mt-8 text-[#0F0F0F]/40 hover:text-[#2969FF] transition-colors inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back to previous page
        </button>
      </div>
    </div>
  )
}
