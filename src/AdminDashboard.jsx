import { useEffect, useState } from 'react'
import { ArrowsClockwise, ChartLineUp, House, LockKey, MagnifyingGlass, Printer, ShoppingBag, SignOut } from '@phosphor-icons/react'

const statusOptions = [
  ['pending_payment_verification','Payment verification'],
  ['pending_fulfillment','Pending fulfillment'],
  ['processing','Processing'],
  ['shipped','Shipped'],
  ['delivered','Delivered'],
  ['cancelled','Cancelled'],
]

const humanize = (value) => value?.replaceAll('_', ' ')
const money = (value) => new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP', maximumFractionDigits:0 }).format(value)
const date = (value) => new Intl.DateTimeFormat('en-PH', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value))
const shortMoney = (value) => Number(value) >= 1000 ? `P${(Number(value) / 1000).toFixed(Number(value) >= 10000 ? 0 : 1)}k` : `P${Number(value || 0)}`
const dayLabel = (value) => new Intl.DateTimeFormat('en-PH', { month:'short', day:'numeric' }).format(new Date(`${value}T00:00:00`))
const monthLabel = (value) => new Intl.DateTimeFormat('en-PH', { month:'short' }).format(new Date(`${value}-01T00:00:00`))

function SalesChart({ data = [], label, type }) {
  const maximum = Math.max(...data.map((entry) => Number(entry.revenue || 0)), 1)
  return <figure className="sales-chart"><figcaption><div><strong>{label}</strong><span>Verified GCash payments</span></div><b>{money(data.reduce((sum, entry) => sum + Number(entry.revenue || 0), 0))}</b></figcaption><div className="sales-bars" role="img" aria-label={`${label} bar graph`}>{data.map((entry) => <div className="sales-bar-column" key={entry.key}><div className="sales-bar-value">{entry.revenue ? shortMoney(entry.revenue) : ''}</div><div className="sales-bar-track"><i style={{ height:`${Math.max((Number(entry.revenue || 0) / maximum) * 100, entry.revenue ? 5 : 1)}%` }} title={`${entry.key}: ${money(entry.revenue)}, ${entry.orders} paid orders`}/></div><span>{type === 'day' ? dayLabel(entry.key) : monthLabel(entry.key)}</span></div>)}</div></figure>
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('tappy-admin-token') || '')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [salesMetrics, setSalesMetrics] = useState({ revenue:0, paid:0, cards:0, average:0, daily:[], monthly:[] })
  const [adminView, setAdminView] = useState('overview')
  const [orderTab, setOrderTab] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState(null)
  const [proofUrl, setProofUrl] = useState('')
  const [proofError, setProofError] = useState('')
  const [pendingDecision, setPendingDecision] = useState('')

  const scopedOrders = orders.filter((order) => orderTab === 'payment_review' ? order.payment_status === 'proof_submitted' : orderTab === 'to_fulfill' ? order.order_status === 'pending_fulfillment' : orderTab === 'in_progress' ? ['processing','shipped'].includes(order.order_status) : orderTab === 'completed' ? order.order_status === 'delivered' : orderTab === 'cancelled' ? order.order_status === 'cancelled' : true)
  const visibleOrders = scopedOrders.filter((order) => `${order.order_number} ${order.customer_name} ${order.email}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = selectedId ? orders.find((order) => order.id === selectedId) || null : null
  const metrics = {
    ...salesMetrics,
    unread:orders.filter((order) => !order.admin_read_at).length,
    payment:orders.filter((order) => order.payment_status === 'proof_submitted').length,
    fulfillment:orders.filter((order) => ['pending_fulfillment','processing'].includes(order.order_status)).length,
  }

  function notify(message, type = 'success') { setNotification({ message, type, id:Date.now() }) }
  function changeView(view) { setAdminView(view); setOrderTab('all'); setQuery(''); setSelectedId('') }
  function showOrders(tab = 'all') { setAdminView('orders'); setOrderTab(tab); setQuery(''); setSelectedId('') }
  function beginSearch() { if (['overview','reports'].includes(adminView)) changeView('orders') }
  function logout(message = '') {
    sessionStorage.removeItem('tappy-admin-token')
    setToken('')
    setOrders([])
    setSalesMetrics({ revenue:0, paid:0, cards:0, average:0, daily:[], monthly:[] })
    if (message) setError(message)
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { ...options, headers:{ authorization:`Bearer ${token}`, ...options.headers } })
    const result = await response.json()
    if (response.status === 401) {
      logout('Your admin session expired.')
      throw new Error('Your admin session expired.')
    }
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
    return result
  }

  async function loadOrders(activeToken = token) {
    setLoading(true)
    setError('')
    try {
      const headers = { authorization:`Bearer ${activeToken}` }
      const queueRequest = fetch('/api/admin/orders?status=all', { headers })
      const salesRequest = fetch('/api/admin/sales-metrics', { headers }).catch(() => null)
      const [response, salesResponse] = await Promise.all([queueRequest, salesRequest])
      const result = await response.json()
      const salesResult = salesResponse ? await salesResponse.json() : null
      if (response.status === 401 || salesResponse?.status === 401) return logout('Your admin session expired.')
      if (!response.ok) throw new Error(result.error || 'Orders could not be loaded.')
      setOrders(result.orders)
      if (salesResponse?.ok && salesResult?.metrics) setSalesMetrics(salesResult.metrics)
      else notify('Orders loaded. Sales reporting is temporarily unavailable.', 'warning')
      if (selectedId && !result.orders.some((order) => order.id === selectedId)) setSelectedId('')
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  async function patchOrder(body, orderId = selected.id) {
    const result = await requestJson(`/api/admin/orders/${orderId}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body) })
    setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order))
    if (body.paymentStatus !== undefined) requestJson('/api/admin/sales-metrics').then((salesResult) => setSalesMetrics(salesResult.metrics)).catch(() => {})
    return result
  }

  function openOrder(order) {
    setSelectedId(order.id)
    if (!order.admin_read_at) patchOrder({ markRead:true }, order.id).catch((requestError) => notify(requestError.message, 'error'))
  }

  useEffect(() => { if (token) loadOrders() }, [token])
  useEffect(() => {
    if (!notification) return undefined
    const timeout = window.setTimeout(() => setNotification(null), 5200)
    return () => window.clearTimeout(timeout)
  }, [notification])
  useEffect(() => {
    if (!pendingDecision) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => { if (event.key === 'Escape') setPendingDecision('') }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [pendingDecision])
  useEffect(() => {
    let active = true
    setProofUrl('')
    setProofError('')
    if (!selected?.payment_proof_path || !token) return () => { active = false }
    requestJson(`/api/admin/orders/${selected.id}/payment-proof`).then((result) => { if (active) setProofUrl(result.url) }).catch((requestError) => { if (active) setProofError(requestError.message) })
    return () => { active = false }
  }, [selected?.id, selected?.payment_proof_path, token])

  async function login(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Sign in failed.')
      sessionStorage.setItem('tappy-admin-token', result.token)
      setToken(result.token)
      setPassword('')
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  async function updateOrder(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    setLoading(true)
    try {
      const result = await patchOrder(body)
      if (result.emailType === 'delivered') {
        const emailNote = result.emailStatus === 'sent' ? ' Customer delivery email sent.' : result.emailStatus === 'failed' ? ' Delivery email failed to send.' : ' Delivery email is not configured.'
        notify('Order marked as delivered.' + emailNote, result.emailStatus === 'failed' ? 'warning' : 'success')
      } else notify('Order details saved.')
    }
    catch (requestError) { notify(requestError.message, 'error') }
    finally { setLoading(false) }
  }

  async function confirmPaymentDecision() {
    const paymentStatus = pendingDecision
    const approved = paymentStatus === 'paid'
    setPendingDecision('')
    setLoading(true)
    try {
      const result = await patchOrder({ paymentStatus, orderStatus:approved ? 'pending_fulfillment' : 'pending_payment_verification' })
      const emailNote = result.emailStatus === 'sent' ? ' Customer email sent.' : result.emailStatus === 'failed' ? ' Customer email failed to send.' : ' Customer email is not configured.'
      notify((approved ? 'Payment confirmed. Order moved to fulfillment.' : 'Payment proof rejected.') + emailNote, result.emailStatus === 'failed' ? 'warning' : approved ? 'success' : 'warning')
    } catch (requestError) { notify(requestError.message, 'error') }
    finally { setLoading(false) }
  }

  if (!token) return <main className="admin-login"><a className="admin-wordmark" href="/">tappy.</a><form onSubmit={login}><LockKey size={27}/><h1>Order desk.</h1><p>Private access for Tappy operations.</p><label>Admin password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus/></label><button className="button" type="submit" disabled={loading}>{loading ? 'Checking...' : 'Sign in'}</button>{error && <p className="admin-error" role="alert">{error}</p>}</form></main>

  return <main className="admin-page">
    <header className="admin-header"><a className="admin-wordmark" href="/">tappy.</a><nav className="admin-nav" aria-label="Dashboard"><button type="button" className={adminView === 'overview' ? 'active' : ''} onClick={() => changeView('overview')}><House size={18}/>Overview</button><button type="button" className={adminView === 'orders' ? 'active' : ''} onClick={() => showOrders()}><ShoppingBag size={18}/>Orders</button><button type="button" className={adminView === 'reports' ? 'active' : ''} onClick={() => changeView('reports')}><ChartLineUp size={18}/>Reports</button></nav><div className="admin-header-actions"><span>Tappy admin</span><button type="button" onClick={() => logout()}><SignOut size={17}/>Sign out</button></div></header>
    <div className="admin-topbar"><label><MagnifyingGlass size={18}/><input value={query} onFocus={beginSearch} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" aria-label="Search orders"/></label><div><button type="button" onClick={() => loadOrders()} disabled={loading} aria-label="Refresh dashboard"><ArrowsClockwise size={18}/></button><span aria-label="Tappy administrator">T</span></div></div>
    <div className="admin-shell">
      <div className="admin-title"><div><h1>{adminView === 'overview' ? 'Overview' : adminView === 'reports' ? 'Reports' : 'Orders'}</h1>{adminView === 'orders' && <p>{visibleOrders.length} of {orders.length}</p>}</div></div>
      {['overview','reports'].includes(adminView) && <section className="admin-sales-report" aria-labelledby="sales-report-title"><header className="admin-report-head"><div><h2 id="sales-report-title">Sales</h2></div><button type="button" onClick={() => window.print()}><Printer size={17}/>Save PDF</button></header><div className="admin-metrics" aria-label="Sales metrics"><div><span>Revenue</span><strong>{money(metrics.revenue)}</strong><small>Paid</small></div><div><span>Orders</span><strong>{metrics.paid}</strong><small>{metrics.unread} new</small></div><div><span>Cards sold</span><strong>{metrics.cards}</strong><small>Units</small></div><div><span>Average</span><strong>{money(metrics.average)}</strong><small>{metrics.payment} to verify</small></div></div><div className="sales-chart-grid"><SalesChart data={metrics.daily} label="14 days" type="day"/><SalesChart data={metrics.monthly} label="6 months" type="month"/></div><footer className="admin-report-footer"><span>Tappy sales report</span><span>Generated {new Intl.DateTimeFormat('en-PH', { dateStyle:'long' }).format(new Date())}</span></footer></section>}
      {adminView === 'overview' && <section className="admin-overview-grid" aria-label="Operations overview"><article><header><h2>Attention</h2><span>Live</span></header><button type="button" onClick={() => showOrders('payment_review')}><span>Payment proofs</span><strong>{metrics.payment}</strong></button><button type="button" onClick={() => showOrders('to_fulfill')}><span>To fulfill</span><strong>{metrics.fulfillment}</strong></button><button type="button" onClick={() => showOrders()}><span>Unread</span><strong>{metrics.unread}</strong></button></article><article><header><h2>Recent orders</h2><button type="button" onClick={() => showOrders()}>View all</button></header>{orders.slice(0,5).map((order) => <button type="button" className="overview-order" onClick={() => { showOrders(); setSelectedId(order.id) }} key={order.id}><span><b>{order.order_number}</b><small>{order.customer_name}</small></span><span><b>{money(order.total)}</b><small>{humanize(order.payment_status)}</small></span></button>)}</article></section>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {adminView === 'orders' && <div className="admin-order-tabs" role="tablist" aria-label="Order views">{[['all','All'],['payment_review','Payment review'],['to_fulfill','To fulfill'],['in_progress','In progress'],['completed','Completed'],['cancelled','Cancelled']].map(([value,label]) => <button type="button" role="tab" aria-selected={orderTab === value} className={orderTab === value ? 'active' : ''} onClick={() => { setOrderTab(value); setSelectedId('') }} key={value}>{label}</button>)}</div>}
      {adminView === 'orders' && (selected ? <div className="admin-resource-detail"><button className="admin-back" type="button" onClick={() => setSelectedId('')}>Back to orders</button><section className="admin-detail">
          <div className="admin-detail-head"><div><span>{selected.order_number}</span><h2>{selected.customer_name}</h2></div><strong>{money(selected.total)}</strong></div>
          <div className="admin-status-line"><span>{humanize(selected.order_status)}</span><span data-payment={selected.payment_status}>{humanize(selected.payment_status)}</span><span>Order email: {humanize(selected.confirmation_email_status || 'not configured')}</span>{selected.payment_decision_email_type && <span>Decision email: {humanize(selected.payment_decision_email_status)}</span>}{selected.delivery_email_status && selected.order_status === 'delivered' && <span>Delivery email: {humanize(selected.delivery_email_status)}</span>}</div>
          <dl><div><dt>Contact</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a><br/><a href={`tel:${selected.phone}`}>{selected.phone}</a></dd></div><div><dt>Deliver to</dt><dd>{selected.address}<br/>{selected.city} {selected.postal_code}</dd></div><div><dt>Order</dt><dd>{selected.quantity} x White Tappy card<br/>GCash QR payment</dd></div></dl>
          {selected.payment_proof_path ? <div className="admin-proof"><div><span>Payment proof</span>{proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer"><img src={proofUrl} alt={`GCash receipt for ${selected.order_number}`}/></a> : <div className="proof-loading">{proofError || 'Loading receipt...'}</div>}</div><dl><div><dt>Reference</dt><dd>{selected.payment_reference}</dd></div><div><dt>Sender</dt><dd>{selected.payment_sender_name}<br/>{selected.payment_sender_phone}</dd></div><div><dt>Submitted</dt><dd>{selected.payment_proof_submitted_at ? date(selected.payment_proof_submitted_at) : '-'}</dd></div></dl><div className="proof-actions"><button type="button" className="button" onClick={() => setPendingDecision('paid')} disabled={loading || selected.payment_status === 'paid'}>{selected.payment_status === 'paid' ? 'Payment confirmed' : 'Confirm payment'}</button><button type="button" onClick={() => setPendingDecision('rejected')} disabled={loading || selected.payment_status === 'rejected'}>{selected.payment_status === 'rejected' ? 'Proof rejected' : 'Reject proof'}</button></div></div> : <div className="admin-proof-empty"><b>Awaiting payment proof</b><p>The customer has not submitted a GCash receipt yet.</p></div>}
          <form className="admin-update" onSubmit={updateOrder}><label>Order status<select name="orderStatus" defaultValue={selected.order_status} key={`order-${selected.id}-${selected.order_status}`}>{statusOptions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="admin-notes-field">Internal notes<textarea name="adminNotes" defaultValue={selected.admin_notes || ''} key={`notes-${selected.id}-${selected.admin_notes}`}/></label><button className="button" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save order details'}</button></form>
        </section></div> : <section className="admin-index" aria-label="Orders index"><div className="admin-index-head"><strong>{[['all','All orders'],['payment_review','Payment review'],['to_fulfill','To fulfill'],['in_progress','In progress'],['completed','Completed'],['cancelled','Cancelled']].find(([value]) => value === orderTab)?.[1]}</strong><span>{visibleOrders.length} records</span></div>{loading && !orders.length ? <p className="admin-index-empty">Loading orders...</p> : visibleOrders.length ? <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Fulfillment</th><th className="numeric">Total</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id} className={!order.admin_read_at ? 'unread' : ''}><td><button type="button" onClick={() => openOrder(order)}>{order.order_number}</button>{!order.admin_read_at && <i>New</i>}</td><td>{date(order.created_at)}</td><td><b>{order.customer_name}</b><small>{order.email}</small></td><td><em data-payment={order.payment_status}>{humanize(order.payment_status)}</em></td><td><em data-status={order.order_status}>{humanize(order.order_status)}</em></td><td className="numeric"><b>{money(order.total)}</b></td></tr>)}</tbody></table></div> : <p className="admin-index-empty">No matching orders.</p>}</section>)}
    </div>
    {notification && <div className="admin-toast" data-type={notification.type} role={notification.type === 'error' ? 'alert' : 'status'} aria-live="polite"><span>{notification.message}</span><button type="button" onClick={() => setNotification(null)} aria-label="Dismiss notification">Close</button></div>}
    {pendingDecision && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDecision('') }}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-title"><span>{selected.order_number}</span><h2 id="decision-title">{pendingDecision === 'paid' ? 'Confirm this payment?' : 'Reject this proof?'}</h2><p>{pendingDecision === 'paid' ? 'The order will move to fulfillment and the customer will receive a confirmation email.' : 'The order will stay in payment verification and the customer will receive an attention-required email.'}</p><div><button type="button" onClick={() => setPendingDecision('')}>Cancel</button><button type="button" className={pendingDecision === 'paid' ? 'button' : 'danger-button'} onClick={confirmPaymentDecision} autoFocus>{pendingDecision === 'paid' ? 'Confirm payment' : 'Reject proof'}</button></div></section></div>}
  </main>
}
