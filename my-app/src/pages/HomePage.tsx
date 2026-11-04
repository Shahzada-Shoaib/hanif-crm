import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return <main className="grid min-h-screen place-items-center bg-white p-5">
    <Button size="lg" asChild className="min-w-28">
      <Link to="/login">Login</Link>
    </Button>
  </main>
}
