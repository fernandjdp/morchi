import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signInAdmin } from './actions'

export default async function AdminLogin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.app_metadata?.role === 'admin') redirect('/admin')
  const query = await searchParams
  return <main className="admin-login"><section className="admin-login-card">
    <div className="admin-brand-mark">m.</div><p className="admin-kicker">MORCHI · BACKOFFICE</p>
    <h1>Hola de nuevo</h1><p className="admin-subtitle" style={{marginBottom:24}}>Ingresá con tu cuenta de administración.</p>
    {query.error === 'credentials' && <p className="admin-error">No pudimos validar el correo y la contraseña.</p>}
    {query.error === 'access' && <p className="admin-error">Esta cuenta no tiene acceso al backoffice.</p>}
    <form action={signInAdmin}>
      <label>Correo electrónico<input name="email" type="email" autoComplete="username" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="admin-button" type="submit" style={{justifyContent:'center',marginTop:6}}>Ingresar al panel</button>
    </form>
  </section></main>
}
