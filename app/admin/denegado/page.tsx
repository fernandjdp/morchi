import Link from 'next/link'
import { signOutAdmin } from '@/app/admin/login/actions'

export default function Denegado() {
  return <main className="admin-denied"><p className="admin-kicker">ACCESO RESTRINGIDO</p><h1 className="admin-heading">Tu cuenta no tiene permiso</h1><p className="admin-subtitle">Solicitá al propietario que habilite el rol administrador.</p><form action={signOutAdmin} style={{marginTop:22}}><button className="admin-button">Cerrar sesión</button> <Link href="/" style={{fontSize:12,marginLeft:12}}>Volver a la tienda</Link></form></main>
}
