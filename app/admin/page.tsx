import Link from 'next/link'
import { requireAdmin } from '@/features/backoffice/auth'
import { getDashboardData } from '@/features/backoffice/queries/dashboard'

export const dynamic = 'force-dynamic'
const currency = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(cents / 100)
const percent = (value: number | null) => value === null ? 'Sin período anterior' : `${value >= 0 ? '+' : ''}${value}% vs período anterior`

function Chart({ points }: { points: Awaited<ReturnType<typeof getDashboardData>>['chart'] }) {
  const coordinates = points.map((p) => `${p.x},${p.y}`).join(' ')
  return <svg className="admin-chart" viewBox="0 0 640 185" role="img" aria-label="Ventas cobradas de los últimos catorce días">
    <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#91b39a" stopOpacity=".32"/><stop offset="100%" stopColor="#91b39a" stopOpacity="0"/></linearGradient></defs>
    {[30,70,110,150].map((y) => <line key={y} x1="12" x2="635" y1={y} y2={y} className="admin-chart-grid"/>)}
    <polygon className="admin-chart-fill" points={`14,160 ${coordinates} 625,160`}/><polyline className="admin-chart-line" points={coordinates}/>
    {[0,3,6,9,13].map((i) => <text key={i} x={points[i].x} y="179" className="admin-chart-label">{points[i].date.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</text>)}
  </svg>
}

export default async function AdminDashboard({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await requireAdmin()
  const query=await searchParams
  const requested=Number(query.days)
  const days=[7,30,90].includes(requested)?requested:30
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null
  let issue = ''
  try { data = await getDashboardData(days) } catch (error) { issue = error instanceof Error ? error.message : 'No se pudieron cargar los datos.' }
  return <div className="admin-content">
    <div className="admin-page-head"><div><div className="admin-kicker">TU NEGOCIO EN FOCO</div><h1 className="admin-heading">Resumen</h1><p className="admin-subtitle">Así se mueve Morchi en los últimos {days} días.</p></div><nav className="admin-period" aria-label="Período de métricas">{[7,30,90].map(period=><Link key={period} href={`/admin?days=${period}`} aria-current={period===days?'page':undefined} className={period===days?'active':''}> {period} días </Link>)}</nav></div>
    {issue && <div className="admin-notice">{issue} Revisá la conexión de Supabase y aplicá las migraciones.</div>}
    {data?.truncated && <div className="admin-notice">Hay más de 5.000 pedidos recientes; las métricas están limitadas al lote más reciente. Se necesita una consulta agregada en base de datos para el volumen completo.</div>}
    <section className="admin-grid" aria-label="Indicadores de ventas">
      <Stat label="Ventas netas cobradas" value={data ? currency(data.revenue) : '—'} note={data ? percent(data.revenueChange) : 'Importe neto de descuentos'} icon="$"/>
      <Stat label="Ventas realizadas" value={data ? data.sales.toLocaleString('es-AR') : '—'} note={data ? percent(data.salesChange) : 'Pagos aprobados'} icon="↗"/>
      <Stat label="Pedidos recibidos" value={data ? data.orders.toLocaleString('es-AR') : '—'} note={`${data?.pending ?? '—'} por preparar`} icon="▤"/>
      <Stat label="Unidades vendidas" value={data ? data.units.toLocaleString('es-AR') : '—'} note={`${data?.lowStock ?? '—'} variantes con stock bajo`} icon="◫"/>
    </section>
    <section className="admin-panels">
      <div className="admin-panel"><div className="admin-panel-head"><div><h2 className="admin-panel-title">Ventas en el tiempo</h2><div className="admin-panel-caption">Ingresos cobrados · últimos 14 días · ARS</div></div><span className="admin-pill">30 días</span></div>{data ? <Chart points={data.chart}/> : <div className="admin-empty">Las métricas aparecerán al conectar la tienda.</div>}</div>
      <div className="admin-panel"><div className="admin-panel-head"><div><h2 className="admin-panel-title">Productos en tendencia</h2><div className="admin-panel-caption">Unidades vendidas · últimos {days} días</div></div><Link href="/admin/productos" className="admin-panel-caption">Ver catálogo →</Link></div>
        {data?.trends.length ? <div className="admin-products">{data.trends.map(([name, quantity], index) => <div className="admin-trend" key={name}><div className="admin-rank">0{index+1}</div><div><div className="admin-trend-name">{name}</div><div className="admin-trend-bar"><i style={{width:`${Math.max(12,quantity / data.trends[0][1] * 100)}%`}}/></div></div><div className="admin-trend-value">{quantity} u.</div></div>)}</div> : <div className="admin-empty">Todavía no hay ventas aprobadas en este período.</div>}
      </div>
    </section>
    <section className="admin-panel admin-section"><div className="admin-panel-head"><div><h2 className="admin-panel-title">Todo listo para seguir</h2><div className="admin-panel-caption">Accesos rápidos a la operación diaria</div></div></div><div className="admin-toolbar"><Link className="admin-button" href="/admin/productos">＋ Cargar producto</Link><Link className="admin-button" href="/admin/pedidos" style={{background:'#edf2ed',color:'#345342'}}>Ver pedidos →</Link></div></section>
    <p className="admin-panel-caption" style={{marginTop:16}}>Ventas netas cobradas = pagos aprobados menos descuentos. No representa margen contable.</p>
  </div>
}

function Stat({label,value,note,icon}:{label:string;value:string;note:string;icon:string}) { return <article className="admin-card"><div className="admin-stat-label">{label}<span className="admin-stat-icon">{icon}</span></div><div className="admin-stat-value">{value}</div><div className="admin-stat-note">{note}</div></article> }
