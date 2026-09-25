import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOutAdmin } from '@/app/admin/login/actions'
import './admin.css'
import './admin-forms.css'
import './admin-orders.css'
import './admin-stock.css'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return <>{children}</>
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand"><span className="admin-brand-mark">m.</span><span>MORCHI <small>STUDIO</small></span></Link>
      <div className="admin-nav-label">GESTIÓN</div>
      <nav aria-label="Navegación administrativa">
        <Link href="/admin" className="admin-nav-item"><span>▦</span>Resumen</Link>
        <Link href="/admin/productos" className="admin-nav-item"><span>◫</span>Productos</Link>
        <Link href="/admin/pedidos" className="admin-nav-item"><span>▤</span>Pedidos</Link>
        <Link href="/admin/inventario" className="admin-nav-item"><span>▧</span>Inventario</Link>
      </nav>
      <div className="admin-sidebar-bottom"><span className="admin-status-dot"/> Tienda en línea<form action={signOutAdmin}><button className="admin-logout">Cerrar sesión</button></form></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>Panel de administración</span><div className="admin-profile"><span className="admin-avatar">{user?.email?.slice(0,1).toUpperCase() ?? 'A'}</span><span>{user?.email}</span></div></header>
      {children}
    </main>
  </div>
}
