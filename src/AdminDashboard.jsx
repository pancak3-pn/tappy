import { useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, BellRinging, Briefcase, CalendarBlank, ChartLineUp, Copy, EnvelopeSimple, Eye, Globe, House, IdentificationCard, LinkedinLogo, LockKey, MagnifyingGlass, Plus, Printer, ShoppingBag, SignOut } from '@phosphor-icons/react'
import { SiFacebook, SiGoogle, SiGooglemaps, SiInstagram } from 'react-icons/si'

const ORDERS_PER_PAGE = 25

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
const emptyPage = { displayName:'', headline:'', bio:'', photoUrl:'', email:'', phone:'', location:'', accent:'forest', backgroundTexture:'clean', status:'draft', orderId:'', internalNotes:'', links:[{ type:'website', label:'Website', url:'' }, { type:'instagram', label:'Instagram', url:'' }, { type:'linkedin', label:'LinkedIn', url:'' }] }
const pageLinkTypes = [
  ['website','Website'], ['maps','Google Maps'], ['facebook','Facebook'], ['instagram','Instagram'],
  ['linkedin','LinkedIn'], ['reviews','Google Reviews'], ['portfolio','Portfolio'], ['booking','Booking'],
]
const pageLinkIcons = { website:Globe, maps:SiGooglemaps, facebook:SiFacebook, instagram:SiInstagram, linkedin:LinkedinLogo, reviews:SiGoogle, portfolio:Briefcase, booking:CalendarBlank }
const defaultPageLinks = () => [['website','Website'],['instagram','Instagram'],['linkedin','LinkedIn']].map(([type,label]) => ({ type, label, url:'' }))
const pageToForm = (page) => ({ displayName:page.display_name || '', headline:page.headline || '', bio:page.bio || '', photoUrl:page.photo_url || '', email:page.email || '', phone:page.phone || '', location:page.location || '', accent:page.accent || 'forest', backgroundTexture:page.background_texture || 'clean', status:page.status || 'draft', orderId:page.order_id || '', internalNotes:page.internal_notes || '', links:[...(page.links || []), ...defaultPageLinks()].slice(0,3) })

function SalesChart({ data = [], label, type }) {
  const maximum = Math.max(...data.map((entry) => Number(entry.revenue || 0)), 1)
  return <figure className="sales-chart"><figcaption><div><strong>{label}</strong><span>Verified GCash payments</span></div><b>{money(data.reduce((sum, entry) => sum + Number(entry.revenue || 0), 0))}</b></figcaption><div className="sales-bars" role="img" aria-label={`${label} bar graph`}>{data.map((entry) => <div className="sales-bar-column" key={entry.key}><div className="sales-bar-value">{entry.revenue ? shortMoney(entry.revenue) : ''}</div><div className="sales-bar-track"><i style={{ height:`${Math.max((Number(entry.revenue || 0) / maximum) * 100, entry.revenue ? 5 : 1)}%` }} title={`${entry.key}: ${money(entry.revenue)}, ${entry.orders} paid orders`}/></div><span>{type === 'day' ? dayLabel(entry.key) : monthLabel(entry.key)}</span></div>)}</div></figure>
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('tappy-admin-token') || '')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [orderMeta, setOrderMeta] = useState({ total:0, totalPages:1 })
  const [orderCounts, setOrderCounts] = useState({ unread:0, payment:0, fulfillment:0 })
  const [paidOrders, setPaidOrders] = useState([])
  const [salesMetrics, setSalesMetrics] = useState({ revenue:0, paid:0, cards:0, average:0, daily:[], monthly:[] })
  const [analyticsMetrics, setAnalyticsMetrics] = useState({ periodDays:30, homepageVisits:0, homepageVisitors:0, orderClicks:0, checkoutStarts:0, completedOrders:0, profileVisits:0, profileVisitors:0, topProfiles:[] })
  const [adminView, setAdminView] = useState('overview')
  const [orderTab, setOrderTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState(null)
  const [proofUrl, setProofUrl] = useState('')
  const [proofError, setProofError] = useState('')
  const [pendingDecision, setPendingDecision] = useState('')
  const [pages, setPages] = useState([])
  const [selectedPageId, setSelectedPageId] = useState('')
  const [pageForm, setPageForm] = useState(emptyPage)
  const [pageSaving, setPageSaving] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const alertsEnabledRef = useRef(false)
  const audioContextRef = useRef(null)
  const knownUnreadRef = useRef(0)
  const ordersInitializedRef = useRef(false)

  const totalPages = Math.max(1, orderMeta.totalPages)
  const safePage = Math.min(orderPage, totalPages)
  const selected = selectedOrder
  const selectedPage = selectedPageId ? pages.find((page) => page.id === selectedPageId) || null : null
  const metrics = {
    ...salesMetrics,
    unread:orderCounts.unread,
    payment:orderCounts.payment,
    fulfillment:orderCounts.fulfillment,
  }

  function notify(message, type = 'success') { setNotification({ message, type, id:Date.now() }) }
  function changeView(view) { setAdminView(view); setOrderTab('all'); setQuery(''); setSelectedOrder(null); if (view !== 'pages') setSelectedPageId('') }
  function showOrders(tab = 'all') { setAdminView('orders'); setOrderTab(tab); setQuery(''); setSelectedOrder(null) }
  function beginSearch() { if (['overview','reports'].includes(adminView)) changeView('orders') }
  function logout(message = '') {
    sessionStorage.removeItem('tappy-admin-token')
    setToken('')
    setOrders([])
    setOrderMeta({ total:0, totalPages:1 })
    setOrderCounts({ unread:0, payment:0, fulfillment:0 })
    setPaidOrders([])
    setSelectedOrder(null)
    setPages([])
    setSalesMetrics({ revenue:0, paid:0, cards:0, average:0, daily:[], monthly:[] })
    setAnalyticsMetrics({ periodDays:30, homepageVisits:0, homepageVisitors:0, orderClicks:0, checkoutStarts:0, completedOrders:0, profileVisits:0, profileVisitors:0, topProfiles:[] })
    alertsEnabledRef.current = false
    setAlertsEnabled(false)
    knownUnreadRef.current = 0
    ordersInitializedRef.current = false
    if (message) setError(message)
  }

  async function playOrderAlert(message) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        const context = audioContextRef.current || new AudioContext()
        audioContextRef.current = context
        if (context.state === 'suspended') await context.resume()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(740, context.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + .14)
        gain.gain.setValueAtTime(.0001, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .02)
        gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .3)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + .31)
      }
    } catch { /* Browser audio is optional. */ }

    notify(message)
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotice = new Notification('New Tappy order', { body:message, icon:'/assets/app-icon.png', tag:'tappy-new-order' })
      browserNotice.onclick = () => { window.focus(); showOrders(); browserNotice.close() }
    }
  }

  async function toggleAlerts() {
    if (alertsEnabledRef.current) {
      alertsEnabledRef.current = false
      setAlertsEnabled(false)
      notify('Order alerts muted.', 'warning')
      return
    }
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext && !audioContextRef.current) audioContextRef.current = new AudioContext()
      if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume()
    } catch { /* The visible alert remains available if audio is unavailable. */ }
    alertsEnabledRef.current = true
    setAlertsEnabled(true)
    const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported'
    notify(notificationPermission === 'denied' ? 'Sound alerts enabled. Browser notifications are blocked.' : 'Order alerts enabled.')
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

  async function loadOrders(activeToken = token, quiet = false) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const headers = { authorization:`Bearer ${activeToken}` }
      const params = new URLSearchParams({ status:orderTab, page:String(safePage), limit:String(ORDERS_PER_PAGE) })
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
      const queueRequest = fetch(`/api/admin/orders?${params}`, { headers })
      const countsRequest = fetch('/api/admin/order-counts', { headers }).catch(() => null)
      const salesRequest = fetch('/api/admin/sales-metrics', { headers }).catch(() => null)
      const analyticsRequest = fetch('/api/admin/analytics', { headers }).catch(() => null)
      const [response, countsResponse, salesResponse, analyticsResponse] = await Promise.all([queueRequest, countsRequest, salesRequest, analyticsRequest])
      const result = await response.json()
      const countsResult = countsResponse ? await countsResponse.json() : null
      const salesResult = salesResponse ? await salesResponse.json() : null
      const analyticsResult = analyticsResponse ? await analyticsResponse.json() : null
      if (response.status === 401 || countsResponse?.status === 401 || salesResponse?.status === 401 || analyticsResponse?.status === 401) return logout('Your admin session expired.')
      if (!response.ok) throw new Error(result.error || 'Orders could not be loaded.')
      const previousUnread = knownUnreadRef.current
      const currentUnread = countsResult?.counts?.unread ?? 0
      knownUnreadRef.current = currentUnread
      ordersInitializedRef.current = true
      setOrders(result.orders)
      setOrderMeta({ total:result.total ?? result.orders.length, totalPages:result.totalPages ?? 1 })
      if (countsResult?.counts) setOrderCounts(countsResult.counts)
      if (ordersInitializedRef.current && currentUnread > previousUnread && alertsEnabledRef.current) {
        const diff = currentUnread - previousUnread
        playOrderAlert(`${diff} new order${diff === 1 ? '' : 's'} received.`)
      }
      if (salesResponse?.ok && salesResult?.metrics) setSalesMetrics(salesResult.metrics)
      else if (!quiet) notify('Orders loaded. Sales reporting is temporarily unavailable.', 'warning')
      if (analyticsResponse?.ok && analyticsResult?.analytics) setAnalyticsMetrics(analyticsResult.analytics)
      else if (!quiet) notify('Run Supabase migration 009 to enable visitor analytics.', 'warning')
    } catch (requestError) { setError(requestError.message) }
    finally { if (!quiet) setLoading(false) }
  }

  async function loadPages() {
    try {
      const result = await requestJson('/api/admin/pages')
      setPages(result.pages)
      if (selectedPageId) {
        const refreshed = result.pages.find((page) => page.id === selectedPageId)
        if (refreshed) setPageForm(pageToForm(refreshed))
      }
    } catch (requestError) { notify(requestError.message, 'error') }
  }

  function editPage(page) { setSelectedPageId(page.id); setPageForm(pageToForm(page)) }
  function newPage() { setSelectedPageId(''); setPageForm(emptyPage) }
  function updatePageLink(index, field, value) { setPageForm((current) => ({ ...current, links:current.links.map((link, linkIndex) => {
    if (linkIndex !== index) return link
    if (field === 'type') return { ...link, type:value, label:pageLinkTypes.find(([type]) => type === value)?.[1] || 'Website' }
    return { ...link, [field]:value }
  }) })) }
  async function copyPageLink(page) {
    const url = `${window.location.origin}/p/${page.public_id}`
    try {
      await navigator.clipboard.writeText(url)
      notify('Profile link copied.')
    } catch { notify(`Copy this profile link: ${url}`, 'warning') }
  }
  async function savePage(event) {
    event.preventDefault()
    setPageSaving(true)
    try {
      const result = await requestJson(selectedPage ? `/api/admin/pages/${selectedPage.id}` : '/api/admin/pages', {
        method:selectedPage ? 'PATCH' : 'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify(pageForm),
      })
      setPages((current) => selectedPage ? current.map((page) => page.id === result.page.id ? result.page : page) : [result.page, ...current])
      setSelectedPageId(result.page.id)
      setPageForm(pageToForm(result.page))
      notify(selectedPage ? 'Tappy Page updated.' : 'Tappy Page created.')
    } catch (requestError) { notify(requestError.message, 'error') }
    finally { setPageSaving(false) }
  }

  async function patchOrder(body, orderId = selected.id) {
    const result = await requestJson(`/api/admin/orders/${orderId}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body) })
    setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order))
    setSelectedOrder((current) => current && current.id === result.order.id ? result.order : current)
    if (body.paymentStatus !== undefined) requestJson('/api/admin/sales-metrics').then((salesResult) => setSalesMetrics(salesResult.metrics)).catch(() => {})
    requestJson('/api/admin/order-counts').then((countsResult) => setOrderCounts(countsResult.counts)).catch(() => {})
    return result
  }

  function openOrder(order) {
    setSelectedOrder(order)
    if (!order.admin_read_at) patchOrder({ markRead:true }, order.id).catch((requestError) => notify(requestError.message, 'error'))
  }

  useEffect(() => {
    if (!token) return undefined
    const debounce = window.setTimeout(() => setDebouncedQuery(query), 350)
    return () => window.clearTimeout(debounce)
  }, [query, token])
  useEffect(() => {
    if (!token) return undefined
    loadOrders(token)
    const interval = window.setInterval(() => loadOrders(token, true), 30000)
    return () => window.clearInterval(interval)
  }, [token, orderTab, debouncedQuery, orderPage])
  useEffect(() => {
    if (!token || adminView !== 'pages') return undefined
    loadPages()
    requestJson('/api/admin/orders?paid=1&limit=100').then((result) => setPaidOrders(result.orders)).catch(() => {})
    return undefined
  }, [token, adminView])
  useEffect(() => { setOrderPage(1) }, [orderTab, debouncedQuery])
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
    <header className="admin-header"><a className="admin-wordmark" href="/">tappy.</a><nav className="admin-nav" aria-label="Dashboard"><button type="button" className={adminView === 'overview' ? 'active' : ''} onClick={() => changeView('overview')}><House size={18}/>Overview</button><button type="button" className={adminView === 'orders' ? 'active' : ''} onClick={() => showOrders()}><ShoppingBag size={18}/>Orders</button><button type="button" className={adminView === 'pages' ? 'active' : ''} onClick={() => changeView('pages')}><IdentificationCard size={18}/>Tappy Pages</button><button type="button" className={adminView === 'reports' ? 'active' : ''} onClick={() => changeView('reports')}><ChartLineUp size={18}/>Reports</button></nav><div className="admin-header-actions"><span>Tappy admin</span><button type="button" onClick={() => logout()}><SignOut size={17}/>Sign out</button></div></header>
    <div className="admin-topbar"><label><MagnifyingGlass size={18}/><input value={query} onFocus={beginSearch} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" aria-label="Search orders"/></label><div>{adminView === 'pages' && <button className="admin-topbar-new" type="button" onClick={newPage}><Plus size={17}/><b>New page</b></button>}<button type="button" className={alertsEnabled ? 'admin-alerts-active' : ''} onClick={toggleAlerts} aria-label={alertsEnabled ? 'Mute new order alerts' : 'Enable new order alerts'} title={alertsEnabled ? 'Order alerts on' : 'Enable order alerts'}><BellRinging size={18} weight={alertsEnabled ? 'fill' : 'regular'}/></button><button type="button" onClick={() => loadOrders()} disabled={loading} aria-label="Refresh dashboard"><ArrowsClockwise size={18}/></button><span aria-label="Tappy administrator">T</span></div></div>
    <div className="admin-shell">
      <div className="admin-title"><div><h1>{adminView === 'overview' ? 'Overview' : adminView === 'reports' ? 'Reports' : adminView === 'pages' ? 'Tappy Pages' : 'Orders'}</h1>{adminView === 'orders' && <p>{orderMeta.total} total orders</p>}{adminView === 'pages' && <p>{pages.length} managed pages</p>}</div></div>
      {['overview','reports'].includes(adminView) && <section className="admin-sales-report" aria-labelledby="sales-report-title"><header className="admin-report-head"><div><h2 id="sales-report-title">Sales</h2></div><button type="button" onClick={() => window.print()}><Printer size={17}/>Save PDF</button></header><div className="admin-metrics" aria-label="Sales metrics"><div><span>Revenue</span><strong>{money(metrics.revenue)}</strong><small>Paid</small></div><div><span>Orders</span><strong>{metrics.paid}</strong><small>{metrics.unread} new</small></div><div><span>Cards sold</span><strong>{metrics.cards}</strong><small>Units</small></div><div><span>Average</span><strong>{money(metrics.average)}</strong><small>{metrics.payment} to verify</small></div></div><div className="sales-chart-grid"><SalesChart data={metrics.daily} label="14 days" type="day"/><SalesChart data={metrics.monthly} label="6 months" type="month"/></div><footer className="admin-report-footer"><span>Tappy sales report</span><span>Generated {new Intl.DateTimeFormat('en-PH', { dateStyle:'long' }).format(new Date())}</span></footer></section>}
      {adminView === 'reports' && <section className="admin-analytics" aria-labelledby="analytics-title"><header><h2 id="analytics-title">Customer journey</h2><span>Last {analyticsMetrics.periodDays} days</span></header><div className="analytics-funnel"><div><span>Homepage visits</span><strong>{analyticsMetrics.homepageVisits}</strong><small>{analyticsMetrics.homepageVisitors} visitors</small></div><div><span>Order clicks</span><strong>{analyticsMetrics.orderClicks}</strong><small>{analyticsMetrics.homepageVisits ? Math.round((analyticsMetrics.orderClicks / analyticsMetrics.homepageVisits) * 100) : 0}% of visits</small></div><div><span>Checkout starts</span><strong>{analyticsMetrics.checkoutStarts}</strong><small>{analyticsMetrics.orderClicks ? Math.round((analyticsMetrics.checkoutStarts / analyticsMetrics.orderClicks) * 100) : 0}% of clicks</small></div><div><span>Orders completed</span><strong>{analyticsMetrics.completedOrders}</strong><small>{analyticsMetrics.checkoutStarts ? Math.round((analyticsMetrics.completedOrders / analyticsMetrics.checkoutStarts) * 100) : 0}% of checkouts</small></div><div><span>Profile visits</span><strong>{analyticsMetrics.profileVisits}</strong><small>{analyticsMetrics.profileVisitors} visitors</small></div></div></section>}
      {adminView === 'overview' && <section className="admin-overview-grid" aria-label="Operations overview"><article><header><h2>Attention</h2><span>Live</span></header><button type="button" onClick={() => showOrders('payment_review')}><span>Payment proofs</span><strong>{metrics.payment}</strong></button><button type="button" onClick={() => showOrders('to_fulfill')}><span>To fulfill</span><strong>{metrics.fulfillment}</strong></button><button type="button" onClick={() => showOrders()}><span>Unread</span><strong>{metrics.unread}</strong></button></article><article><header><h2>Recent orders</h2><button type="button" onClick={() => showOrders()}>View all</button></header>{orders.slice(0,5).map((order) => <button type="button" className="overview-order" onClick={() => { showOrders(); setSelectedOrder(order) }} key={order.id}><span><b>{order.order_number}</b><small>{order.customer_name}</small></span><span><b>{money(order.total)}</b><small>{humanize(order.payment_status)}</small></span></button>)}</article></section>}
      {adminView === 'pages' && <section className="admin-pages-workspace">
        <aside className="admin-pages-list"><header><strong>Managed pages</strong><button type="button" onClick={newPage}><Plus size={16}/></button></header>{pages.length ? pages.map((page) => <button type="button" className={selectedPageId === page.id ? 'active' : ''} onClick={() => editPage(page)} key={page.id}><span><b>{page.display_name}</b><small>{page.orders?.order_number || 'No linked order'}</small></span><em data-page-status={page.status}>{page.status}</em></button>) : <p>No pages yet.</p>}</aside>
        <form className="admin-page-editor" onSubmit={savePage}><header><div><span>{selectedPage ? 'Edit managed page' : 'Create managed page'}</span><h2>{pageForm.displayName || 'Untitled page'}</h2></div>{selectedPage && <div><a href={`/p/${selectedPage.public_id}`} target="_blank" rel="noreferrer" title="Open public page" aria-label="Open public profile"><Eye size={17}/></a></div>}</header>{selectedPage && <div className="admin-profile-url"><span>Customer profile URL</span><code>{`${window.location.origin}/p/${selectedPage.public_id}`}</code><button type="button" onClick={() => copyPageLink(selectedPage)}><Copy size={16}/>Copy</button></div>}<div className="admin-page-editor-grid"><div className="admin-page-fields">
          <label>Linked paid order<select value={pageForm.orderId} onChange={(event) => setPageForm({ ...pageForm, orderId:event.target.value })}><option value="">No linked order</option>{paidOrders.filter((order) => !pages.some((page) => page.order_id === order.id) || selectedPage?.order_id === order.id).map((order) => <option value={order.id} key={order.id}>{order.order_number} · {order.customer_name}</option>)}</select></label>
          <div><label>Display name<input value={pageForm.displayName} maxLength="100" required onChange={(event) => setPageForm({ ...pageForm, displayName:event.target.value })}/></label><label>Role or headline<input value={pageForm.headline} maxLength="120" onChange={(event) => setPageForm({ ...pageForm, headline:event.target.value })}/></label></div>
          <label>Short introduction<textarea value={pageForm.bio} maxLength="360" onChange={(event) => setPageForm({ ...pageForm, bio:event.target.value })}/></label>
          <label>Profile image URL<input type="url" placeholder="https://" value={pageForm.photoUrl} onChange={(event) => setPageForm({ ...pageForm, photoUrl:event.target.value })}/></label>
          <div><label>Email<input type="email" value={pageForm.email} onChange={(event) => setPageForm({ ...pageForm, email:event.target.value })}/></label><label>Phone<input value={pageForm.phone} onChange={(event) => setPageForm({ ...pageForm, phone:event.target.value })}/></label></div>
          <label>Location<input value={pageForm.location} onChange={(event) => setPageForm({ ...pageForm, location:event.target.value })}/></label>
          <div><label>Accent<select value={pageForm.accent} onChange={(event) => setPageForm({ ...pageForm, accent:event.target.value })}><option value="forest">Tappy forest</option><option value="ink">Monochrome</option><option value="blue">Cobalt</option></select></label><label>Background design<select value={pageForm.backgroundTexture} onChange={(event) => setPageForm({ ...pageForm, backgroundTexture:event.target.value })}><option value="clean">Clean white</option><option value="linen">Soft linen</option><option value="silver">Brushed silver</option><option value="forest-grain">Forest grain</option><option value="blueprint">Blueprint grid</option></select></label></div>
          <label>Status<select value={pageForm.status} onChange={(event) => setPageForm({ ...pageForm, status:event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="disabled">Disabled</option></select></label>
          <fieldset><legend>Public links</legend>{pageForm.links.map((link, index) => <div key={index}><label>Destination<select value={link.type} onChange={(event) => updatePageLink(index, 'type', event.target.value)}>{pageLinkTypes.map(([type,label]) => <option value={type} key={type}>{label}</option>)}</select></label><label>URL<input type="url" placeholder="https://" value={link.url} onChange={(event) => updatePageLink(index, 'url', event.target.value)}/></label></div>)}</fieldset>
          <label>Internal notes<textarea value={pageForm.internalNotes} maxLength="1000" onChange={(event) => setPageForm({ ...pageForm, internalNotes:event.target.value })}/></label>
          <button className="button" type="submit" disabled={pageSaving}>{pageSaving ? 'Saving...' : selectedPage ? 'Save page' : 'Create page'}</button>
        </div><div className="admin-page-preview" data-accent={pageForm.accent}><span>Live preview</span><div data-background={pageForm.backgroundTexture}>{pageForm.photoUrl ? <img src={pageForm.photoUrl} alt=""/> : <i>{pageForm.displayName.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase() || 'TP'}</i>}<h3>{pageForm.displayName || 'Customer name'}</h3><p>{pageForm.headline || 'Role or business'}</p>{pageForm.bio && <small>{pageForm.bio}</small>}{pageForm.phone && <button type="button">Call now</button>}<nav aria-label="Profile actions">{pageForm.email && <span title="Email" data-link-type="email"><EnvelopeSimple size={17}/></span>}{pageForm.links.filter((link) => link.url).map((link, index) => { const Icon = pageLinkIcons[link.type] || Globe; return <span key={`${link.type}-${index}`} title={link.label} data-link-type={link.type}><Icon size={17}/></span> })}</nav></div></div></div></form>
      </section>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {adminView === 'orders' && <div className="admin-order-tabs" role="tablist" aria-label="Order views">{[['all','All'],['payment_review','Payment review'],['to_fulfill','To fulfill'],['in_progress','In progress'],['completed','Completed'],['cancelled','Cancelled']].map(([value,label]) => <button type="button" role="tab" aria-selected={orderTab === value} className={orderTab === value ? 'active' : ''} onClick={() => { setOrderTab(value); setSelectedOrder(null) }} key={value}>{label}</button>)}</div>}
      {adminView === 'orders' && (selected ? <div className="admin-resource-detail"><button className="admin-back" type="button" onClick={() => setSelectedOrder(null)}>Back to orders</button><section className="admin-detail">
          <div className="admin-detail-head"><div><span>{selected.order_number}</span><h2>{selected.customer_name}</h2></div><strong>{money(selected.total)}</strong></div>
          <div className="admin-status-line"><span>{humanize(selected.order_status)}</span><span data-payment={selected.payment_status}>{humanize(selected.payment_status)}</span><span>Order email: {humanize(selected.confirmation_email_status || 'not configured')}</span>{selected.payment_decision_email_type && <span>Decision email: {humanize(selected.payment_decision_email_status)}</span>}{selected.delivery_email_status && selected.order_status === 'delivered' && <span>Delivery email: {humanize(selected.delivery_email_status)}</span>}</div>
          <dl><div><dt>Contact</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a><br/><a href={`tel:${selected.phone}`}>{selected.phone}</a></dd></div><div><dt>Deliver to</dt><dd>{selected.address}<br/>{selected.city}{selected.province ? `, ${selected.province}` : ''} {selected.postal_code}{selected.delivery_region && <><br/>{selected.delivery_region} delivery</>}</dd></div><div><dt>Order</dt><dd>{selected.quantity} x White Tappy card<br/>GCash QR payment</dd></div></dl>
          {selected.payment_proof_path ? <div className="admin-proof"><div><span>Payment proof</span>{proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer"><img src={proofUrl} alt={`GCash receipt for ${selected.order_number}`}/></a> : <div className="proof-loading">{proofError || 'Loading receipt...'}</div>}</div><dl><div><dt>Reference</dt><dd>{selected.payment_reference}</dd></div><div><dt>Sender</dt><dd>{selected.payment_sender_name}<br/>{selected.payment_sender_phone}</dd></div><div><dt>Submitted</dt><dd>{selected.payment_proof_submitted_at ? date(selected.payment_proof_submitted_at) : '-'}</dd></div></dl><div className="proof-actions"><button type="button" className="button" onClick={() => setPendingDecision('paid')} disabled={loading || selected.payment_status === 'paid'}>{selected.payment_status === 'paid' ? 'Payment confirmed' : 'Confirm payment'}</button><button type="button" onClick={() => setPendingDecision('rejected')} disabled={loading || selected.payment_status === 'rejected'}>{selected.payment_status === 'rejected' ? 'Proof rejected' : 'Reject proof'}</button></div></div> : <div className="admin-proof-empty"><b>Awaiting payment proof</b><p>The customer has not submitted a GCash receipt yet.</p></div>}
          <form className="admin-update" onSubmit={updateOrder}><label>Order status<select name="orderStatus" defaultValue={selected.order_status} key={`order-${selected.id}-${selected.order_status}`}>{statusOptions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="admin-notes-field">Internal notes<textarea name="adminNotes" defaultValue={selected.admin_notes || ''} key={`notes-${selected.id}-${selected.admin_notes}`}/></label><button className="button" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save order details'}</button></form>
        </section></div> : <section className="admin-index" aria-label="Orders index"><div className="admin-index-head"><strong>{[['all','All orders'],['payment_review','Payment review'],['to_fulfill','To fulfill'],['in_progress','In progress'],['completed','Completed'],['cancelled','Cancelled']].find(([value]) => value === orderTab)?.[1]}</strong><span>{orderMeta.total} records</span></div>{loading && !orders.length ? <p className="admin-index-empty">Loading orders...</p> : orders.length ? <>
          <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Fulfillment</th><th className="numeric">Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className={!order.admin_read_at ? 'unread' : ''}><td><button type="button" onClick={() => openOrder(order)}>{order.order_number}</button>{!order.admin_read_at && <i>New</i>}</td><td>{date(order.created_at)}</td><td><b>{order.customer_name}</b><small>{order.email}</small></td><td><em data-payment={order.payment_status}>{humanize(order.payment_status)}</em></td><td><em data-status={order.order_status}>{humanize(order.order_status)}</em></td><td className="numeric"><b>{money(order.total)}</b></td></tr>)}</tbody></table></div>
          {totalPages > 1 && <nav className="admin-pagination" aria-label="Order pages">
            <button type="button" onClick={() => setOrderPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page">Previous</button>
            <span aria-current={safePage > 1 ? 'page' : undefined}>Page {safePage} of {totalPages}</span>
            <button type="button" onClick={() => setOrderPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page">Next</button>
          </nav>}
        </> : <p className="admin-index-empty">No matching orders.</p>}</section>)}
    </div>
    {notification && <div className="admin-toast" data-type={notification.type} role={notification.type === 'error' ? 'alert' : 'status'} aria-live="polite"><span>{notification.message}</span><button type="button" onClick={() => setNotification(null)} aria-label="Dismiss notification">Close</button></div>}
    {pendingDecision && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDecision('') }}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-title"><span>{selected.order_number}</span><h2 id="decision-title">{pendingDecision === 'paid' ? 'Confirm this payment?' : 'Reject this proof?'}</h2><p>{pendingDecision === 'paid' ? 'The order will move to fulfillment and the customer will receive a confirmation email.' : 'The order will stay in payment verification and the customer will receive an attention-required email.'}</p><div><button type="button" onClick={() => setPendingDecision('')}>Cancel</button><button type="button" className={pendingDecision === 'paid' ? 'button' : 'danger-button'} onClick={confirmPaymentDecision} autoFocus>{pendingDecision === 'paid' ? 'Confirm payment' : 'Reject proof'}</button></div></section></div>}
  </main>
}
