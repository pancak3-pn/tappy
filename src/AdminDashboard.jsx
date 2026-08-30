import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowsClockwise, BellRinging, CalendarBlank, ChartLineUp, ChatCircleText, CheckCircle, Clock, Copy, CreditCard, EnvelopeSimple, EnvelopeSimple as Inbox, Eye, GearSix, House, IdentificationCard, Info, Kanban, LinkSimple, ListBullets, LockKey, MagnifyingGlass, MapPin, Package, Palette, PaperPlaneTilt, Plus, Printer, ShieldCheck, ShoppingBag, SignOut, Star, UserCircle, Wallet, X } from '@phosphor-icons/react'
import ProfileImageUpload from './ProfileImageUpload.jsx'
import ManagedProfileCard from './ManagedProfileCard.jsx'
import './mailbox.css'
import './reports.css'
import './nfc-links.css'
import { allowedOrderTransitions } from '../shared/order-lifecycle.js'

const ORDERS_PER_PAGE = 25

const statusOptions = [
  ['pending_payment_verification','Payment verification'],
  ['pending_fulfillment','Pending fulfillment'],
  ['processing','Processing'],
  ['shipped','Shipped'],
  ['delivered','Delivered'],
  ['cancelled','Cancelled'],
]
const statusLabel = (value) => statusOptions.find(([status]) => status === value)?.[1] || value

const humanize = (value) => value?.replaceAll('_', ' ')
const money = (value) => new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP', maximumFractionDigits:0 }).format(value)
const date = (value) => new Intl.DateTimeFormat('en-PH', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value))
const shortMoney = (value) => Number(value) >= 1000 ? `P${(Number(value) / 1000).toFixed(Number(value) >= 10000 ? 0 : 1)}k` : `P${Number(value || 0)}`
const dayLabel = (value) => new Intl.DateTimeFormat('en-PH', { month:'short', day:'numeric' }).format(new Date(`${value}T00:00:00`))
const monthLabel = (value) => new Intl.DateTimeFormat('en-PH', { month:'short' }).format(new Date(`${value}-01T00:00:00`))
const emptyPage = { displayName:'', headline:'', bio:'', photoUrl:'', email:'', phone:'', location:'', accent:'forest', accentColor:'#244a3a', backgroundTexture:'clean', template:'classic', status:'draft', orderId:'', internalNotes:'', links:[{ type:'website', label:'Website', url:'' }, { type:'instagram', label:'Instagram', url:'' }, { type:'linkedin', label:'LinkedIn', url:'' }] }
const pageLinkTypes = [
  ['website','Website'], ['maps','Google Maps'], ['facebook','Facebook'], ['instagram','Instagram'],
  ['linkedin','LinkedIn'], ['reviews','Google Reviews'], ['portfolio','Portfolio'], ['booking','Booking'],
]
const defaultPageLinks = () => [['website','Website'],['instagram','Instagram'],['linkedin','LinkedIn']].map(([type,label]) => ({ type, label, url:'' }))
const pageToForm = (page) => ({ displayName:page.display_name || '', headline:page.headline || '', bio:page.bio || '', photoUrl:page.photo_url || '', email:page.email || '', phone:page.phone || '', location:page.location || '', accent:page.accent || 'forest', accentColor:page.accent_color || ({ forest:'#244a3a', ink:'#151515', blue:'#2757a5' }[page.accent] || '#244a3a'), backgroundTexture:page.background_texture || 'clean', template:page.template || 'classic', status:page.status || 'draft', orderId:page.order_id || '', internalNotes:page.internal_notes || '', links:[...(page.links || []), ...defaultPageLinks()].slice(0,3) })

function SalesChart({ data = [], label, type }) {
  const maximum = Math.max(...data.map((entry) => Number(entry.revenue || 0)), 1)
  return <figure className="sales-chart"><figcaption><div><strong>{label}</strong><span>Verified GCash payments</span></div><b>{money(data.reduce((sum, entry) => sum + Number(entry.revenue || 0), 0))}</b></figcaption><div className="sales-bars" role="img" aria-label={`${label} bar graph`}>{data.map((entry) => <div className="sales-bar-column" key={entry.key}><div className="sales-bar-value">{entry.revenue ? shortMoney(entry.revenue) : ''}</div><div className="sales-bar-track"><i style={{ height:`${Math.max((Number(entry.revenue || 0) / maximum) * 100, entry.revenue ? 5 : 1)}%` }} title={`${entry.key}: ${money(entry.revenue)}, ${entry.orders} paid orders`}/></div><span>{type === 'day' ? dayLabel(entry.key) : monthLabel(entry.key)}</span></div>)}</div></figure>
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('tappy-admin-token') || '')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [orderMeta, setOrderMeta] = useState({ total:0, totalPages:1 })
  const [orderCounts, setOrderCounts] = useState({ all:0, unread:0, payment:0, fulfillment:0, inProgress:0, completed:0, cancelled:0 })
  const [paidOrders, setPaidOrders] = useState([])
  const [salesMetrics, setSalesMetrics] = useState({ revenue:0, paid:0, cards:0, average:0, daily:[], monthly:[], regions:[] })
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
  const [pageEditorTab, setPageEditorTab] = useState('profile')
  const [messageThreads, setMessageThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [messageFolder, setMessageFolder] = useState('all')
  const [messageQuery, setMessageQuery] = useState('')
  const [composingMessage, setComposingMessage] = useState(false)
  const [messageSending, setMessageSending] = useState(false)
  const [messageDraft, setMessageDraft] = useState({ orderId:'', subject:'', body:'' })
  const [feedback, setFeedback] = useState([])
  const [nfcTags, setNfcTags] = useState([])
  const [nfcDraft, setNfcDraft] = useState({ destinationType:'instagram', destinationUrl:'' })
  const [nfcSaving, setNfcSaving] = useState(false)
  const [feedbackLinkSent, setFeedbackLinkSent] = useState({})
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
  const todaySales = metrics.daily.at(-1) || { revenue:0, orders:0 }
  const monthSales = metrics.monthly.at(-1) || { revenue:0, orders:0 }
  const workQueue = orders.filter((order) => order.payment_status === 'proof_submitted' || ['pending_fulfillment','processing'].includes(order.order_status)).slice(0, 6)
  const visibleThreads = messageThreads.filter((thread) => {
    if (messageFolder === 'sent' && !thread.messages?.some((message) => message.direction === 'outbound')) return false
    const needle = messageQuery.trim().toLowerCase()
    return !needle || [thread.customer_name, thread.customer_email, thread.subject, thread.orders?.order_number].some((value) => value?.toLowerCase().includes(needle))
  })
  const selectedThread = messageThreads.find((thread) => thread.id === selectedThreadId) || visibleThreads[0] || null

  function notify(message, type = 'success') { setNotification({ message, type, id:Date.now() }) }
  function changeView(view) { setAdminView(view); setOrderTab('all'); setQuery(''); setSelectedOrder(null); if (view !== 'pages') setSelectedPageId('') }
  function showOrders(tab = 'all') { setAdminView('orders'); setOrderTab(tab); setQuery(''); setSelectedOrder(null) }
  function openOverviewOrder(order) {
    const tab = order.payment_status === 'proof_submitted' ? 'payment_review' : order.order_status === 'pending_fulfillment' ? 'to_fulfill' : ['processing','shipped'].includes(order.order_status) ? 'in_progress' : 'all'
    showOrders(tab)
    setSelectedOrder(order)
  }
  function beginSearch() { if (['overview','reports'].includes(adminView)) changeView('orders') }
  function logout(message = '') {
    sessionStorage.removeItem('tappy-admin-token')
    setToken('')
    setOrders([])
    setOrderMeta({ total:0, totalPages:1 })
    setOrderCounts({ all:0, unread:0, payment:0, fulfillment:0, inProgress:0, completed:0, cancelled:0 })
    setPaidOrders([])
    setSelectedOrder(null)
    setPages([])
    setSalesMetrics({ revenue:0, paid:0, cards:0, average:0, daily:[], monthly:[], regions:[] })
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
  async function loadMessages() {
    try {
      const result = await requestJson('/api/admin/messages')
      setMessageThreads(result.threads || [])
      setSelectedThreadId((current) => current || result.threads?.[0]?.id || '')
    } catch (requestError) { notify(requestError.message, 'error') }
  }
  async function loadNfcTags() {
    try { const result = await requestJson('/api/admin/nfc-tags'); setNfcTags(result.tags || []) }
    catch (requestError) { notify(requestError.message, 'error') }
  }
  async function createNfcTag(event) {
    event.preventDefault(); setNfcSaving(true)
    try {
      const result = await requestJson('/api/admin/nfc-tags', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(nfcDraft) })
      setNfcTags((current) => [result.tag, ...current]); setNfcDraft({ ...nfcDraft, destinationUrl:'' }); notify('Permanent NFC link created.')
    } catch (requestError) { notify(requestError.message, 'error') }
    finally { setNfcSaving(false) }
  }
  async function toggleNfcTag(tag) {
    try {
      const result = await requestJson(`/api/admin/nfc-tags/${tag.id}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ active:!tag.active }) })
      setNfcTags((current) => current.map((item) => item.id === tag.id ? { ...item, active:result.tag.active } : item)); notify(result.tag.active ? 'NFC link enabled.' : 'NFC link disabled.')
    } catch (requestError) { notify(requestError.message, 'error') }
  }
  async function deleteNfcTag(tag) {
    if (!window.confirm(`Permanently delete NFC link ${tag.code}? The written card URL will stop working.`)) return
    try {
      await requestJson(`/api/admin/nfc-tags/${tag.id}`, { method:'DELETE' })
      setNfcTags((current) => current.filter((item) => item.id !== tag.id))
      notify('NFC link deleted.')
    } catch (requestError) { notify(requestError.message, 'error') }
  }
  async function copyNfcLink(tag) {
    const link = `${window.location.origin}/t/${tag.code}`
    try { await navigator.clipboard.writeText(link); notify('NFC link copied.') }
    catch { notify(`Copy this NFC link: ${link}`, 'warning') }
  }
  function startMessage(order = null) {
    const target = order || orders[0] || null
    setMessageDraft({ orderId:target?.id || '', subject:target ? `Regarding your Tappy order ${target.order_number}` : '', body:'' })
    setComposingMessage(true)
  }
  async function sendCustomerMessage(event) {
    event.preventDefault()
    setMessageSending(true)
    try {
      const result = await requestJson('/api/admin/messages', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(messageDraft) })
      await loadMessages()
      setSelectedThreadId(result.thread.id)
      setComposingMessage(false)
      setMessageDraft({ orderId:'', subject:'', body:'' })
      notify('Customer email sent.')
    } catch (requestError) { notify(requestError.message, 'error') }
    finally { setMessageSending(false) }
  }

  function editPage(page) { setSelectedPageId(page.id); setPageForm(pageToForm(page)); setPageEditorTab('profile') }
  function newPage() { setSelectedPageId(''); setPageForm(emptyPage); setPageEditorTab('profile') }
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
  async function grantCustomerAccess(page) {
    try {
      const result = await requestJson(`/api/admin/pages/${page.id}/customer-access`, { method:'POST' })
      try { await navigator.clipboard.writeText(result.editUrl) } catch { /* Email remains the primary delivery method. */ }
      const emailNote = result.emailStatus === 'sent' ? ' Email sent and link copied.' : result.emailStatus === 'failed' ? ' Email failed; link copied.' : ' Email is not configured; link copied.'
      notify(`New customer editing link created.${emailNote}`, result.emailStatus === 'failed' ? 'warning' : 'success')
    } catch (requestError) { notify(requestError.message, 'error') }
  }
  async function revokeCustomerAccess(page) {
    try {
      await requestJson(`/api/admin/pages/${page.id}/customer-access`, { method:'DELETE' })
      notify('Customer editing access revoked.', 'warning')
    } catch (requestError) { notify(requestError.message, 'error') }
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
  async function uploadPagePhoto(imageData) {
    if (!selectedPage) throw new Error('Create the page before adding its photo.')
    const result = await requestJson(`/api/admin/pages/${selectedPage.id}/photo`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ imageData }) })
    setPageForm((current) => ({ ...current, photoUrl:result.photoUrl }))
    setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, photo_url:result.photoUrl } : page))
    notify('Profile photo updated.')
  }
  async function removePagePhoto() {
    if (!selectedPage) return
    await requestJson(`/api/admin/pages/${selectedPage.id}/photo`, { method:'DELETE' })
    setPageForm((current) => ({ ...current, photoUrl:'' }))
    setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, photo_url:null } : page))
    notify('Profile photo removed.', 'warning')
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
  useEffect(() => {
    if (!token || adminView !== 'messages') return undefined
    loadMessages()
    return undefined
  }, [token, adminView])
  useEffect(() => {
    if (!token || adminView !== 'feedback') return undefined
    requestJson('/api/admin/feedback').then((result) => setFeedback(result.feedback)).catch((requestError) => notify(requestError.message, 'error'))
    return undefined
  }, [token, adminView])
  useEffect(() => { if (token && adminView === 'nfc') loadNfcTags() }, [token, adminView])
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

  async function sendFeedbackLink(order) {
    try {
      const result = await requestJson(`/api/admin/orders/${order.id}/feedback-link`, { method:'POST' })
      setFeedbackLinkSent((current) => ({ ...current, [order.id]:true }))
      const emailNote = result.emailStatus === 'sent' ? '' : result.emailStatus === 'failed' ? ' But the email failed to send.' : ' Email delivery is not configured.'
      notify(`Feedback link sent to ${order.email}.` + emailNote, result.emailStatus === 'failed' ? 'warning' : 'success')
    } catch (requestError) { notify(requestError.message, 'error') }
  }

  async function setFeedbackStatus(entry, status) {
    try {
      const result = await requestJson(`/api/admin/feedback/${entry.id}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ status }) })
      setFeedback((current) => current.map((item) => item.id === entry.id ? { ...item, status:result.feedback.status, published_at:result.feedback.published_at } : item))
      notify(status === 'published' ? 'Feedback is now visible to everyone.' : 'Feedback is hidden from the public.')
    } catch (requestError) { notify(requestError.message, 'error') }
  }

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
    <header className="admin-header"><a className="admin-wordmark" href="/">tappy.</a><nav className="admin-nav" aria-label="Dashboard"><button type="button" className={adminView === 'overview' ? 'active' : ''} onClick={() => changeView('overview')}><House size={18}/>Overview</button><button type="button" className={adminView === 'orders' ? 'active' : ''} onClick={() => showOrders()}><ShoppingBag size={18}/>Orders</button><button type="button" className={adminView === 'messages' ? 'active' : ''} onClick={() => changeView('messages')}><ChatCircleText size={18}/>Messages</button><button type="button" className={adminView === 'pages' ? 'active' : ''} onClick={() => changeView('pages')}><IdentificationCard size={18}/>Tappy Pages</button><button type="button" className={adminView === 'nfc' ? 'active' : ''} onClick={() => changeView('nfc')}><LinkSimple size={18}/>NFC Links</button><button type="button" className={adminView === 'reports' ? 'active' : ''} onClick={() => changeView('reports')}><ChartLineUp size={18}/>Reports</button><button type="button" className={adminView === 'feedback' ? 'active' : ''} onClick={() => changeView('feedback')}><Star size={18}/>Feedback</button></nav><div className="admin-header-actions"><span>Tappy admin</span><button type="button" onClick={() => logout()}><SignOut size={17}/>Sign out</button></div></header>
    <div className="admin-topbar"><label><MagnifyingGlass size={18}/><input value={adminView === 'messages' ? messageQuery : query} onFocus={adminView === 'messages' ? undefined : beginSearch} onChange={(event) => adminView === 'messages' ? setMessageQuery(event.target.value) : setQuery(event.target.value)} placeholder={adminView === 'messages' ? 'Search messages' : 'Search orders'} aria-label={adminView === 'messages' ? 'Search messages' : 'Search orders'}/></label><div>{adminView === 'messages' && <button className="admin-topbar-new" type="button" onClick={() => startMessage()}><Plus size={17}/><b>New message</b></button>}{adminView === 'pages' && <button className="admin-topbar-new" type="button" onClick={newPage}><Plus size={17}/><b>New page</b></button>}<button type="button" className={alertsEnabled ? 'admin-alerts-active' : ''} onClick={toggleAlerts} aria-label={alertsEnabled ? 'Mute new order alerts' : 'Enable new order alerts'} title={alertsEnabled ? 'Order alerts on' : 'Enable order alerts'}><BellRinging size={18} weight={alertsEnabled ? 'fill' : 'regular'}/></button><button type="button" onClick={() => adminView === 'messages' ? loadMessages() : loadOrders()} disabled={loading} aria-label="Refresh dashboard"><ArrowsClockwise size={18}/></button><span aria-label="Tappy administrator">T</span></div></div>
    <div className="admin-shell">
      <div className={`admin-title ${adminView === 'orders' ? 'admin-orders-title' : ''}`}><div><h1>{adminView === 'overview' ? 'Overview' : adminView === 'reports' ? 'Reports' : adminView === 'pages' ? 'Tappy Pages' : adminView === 'messages' ? 'Messages' : adminView === 'nfc' ? 'NFC Links' : adminView === 'feedback' ? 'Feedback' : 'Orders'}</h1>{adminView === 'overview' && <p>{new Intl.DateTimeFormat('en-PH', { weekday:'long', month:'long', day:'numeric' }).format(new Date())}</p>}{adminView === 'orders' && <p>Manage and track all customer orders in one place.</p>}{adminView === 'messages' && <p>Customer conversations linked to their orders.</p>}{adminView === 'pages' && <p>{pages.length} managed pages</p>}{adminView === 'nfc' && <p>Create permanent links to write onto customer NFC cards.</p>}</div>{adminView === 'orders' && <div className="admin-orders-total" aria-label={`${orderCounts.all} total orders`}><i aria-hidden="true"><ShoppingBag size={24}/></i><span><b>Total orders</b><strong>{orderCounts.all}</strong><small>Across all statuses</small></span></div>}</div>
      {adminView === 'reports' && <section className="admin-sales-report" aria-labelledby="sales-report-title"><header className="admin-report-head"><div><h2 id="sales-report-title">Sales</h2></div><button type="button" onClick={() => window.print()}><Printer size={17}/>Save PDF</button></header><div className="admin-metrics" aria-label="Sales metrics"><div><i aria-hidden="true"><Wallet size={23} weight="regular"/></i><span>Revenue</span><strong>{money(metrics.revenue)}</strong><small>Paid</small></div><div><i aria-hidden="true"><ShoppingBag size={23} weight="regular"/></i><span>Orders</span><strong>{metrics.paid}</strong><small>{metrics.unread} new</small></div><div><i aria-hidden="true"><CreditCard size={23} weight="regular"/></i><span>Cards sold</span><strong>{metrics.cards}</strong><small>Units</small></div><div><i aria-hidden="true"><ChartLineUp size={23} weight="regular"/></i><span>Average</span><strong>{money(metrics.average)}</strong><small>{metrics.payment} to verify</small></div></div><div className="sales-chart-grid"><SalesChart data={metrics.daily} label="14 days" type="day"/><SalesChart data={metrics.monthly} label="6 months" type="month"/></div><footer className="admin-report-footer"><span>Tappy sales report</span><span>Generated {new Intl.DateTimeFormat('en-PH', { dateStyle:'long' }).format(new Date())}</span></footer></section>}
      {adminView === 'reports' && <section className="admin-analytics" aria-labelledby="analytics-title"><header><h2 id="analytics-title">Customer journey</h2><span>Last {analyticsMetrics.periodDays} days</span></header><div className="analytics-funnel"><div><i aria-hidden="true"><UserCircle size={22} weight="regular"/></i><span>Homepage visits</span><strong>{analyticsMetrics.homepageVisits}</strong><small>{analyticsMetrics.homepageVisitors} visitors</small></div><div><i aria-hidden="true"><MagnifyingGlass size={22} weight="regular"/></i><span>Order clicks</span><strong>{analyticsMetrics.orderClicks}</strong><small>{analyticsMetrics.homepageVisits ? Math.round((analyticsMetrics.orderClicks / analyticsMetrics.homepageVisits) * 100) : 0}% of visits</small></div><div><i aria-hidden="true"><ShoppingBag size={22} weight="regular"/></i><span>Checkout starts</span><strong>{analyticsMetrics.checkoutStarts}</strong><small>{analyticsMetrics.orderClicks ? Math.round((analyticsMetrics.checkoutStarts / analyticsMetrics.orderClicks) * 100) : 0}% of clicks</small></div><div><i aria-hidden="true"><CheckCircle size={22} weight="regular"/></i><span>Orders completed</span><strong>{analyticsMetrics.completedOrders}</strong><small>{analyticsMetrics.checkoutStarts ? Math.round((analyticsMetrics.completedOrders / analyticsMetrics.checkoutStarts) * 100) : 0}% of checkouts</small></div><div><i aria-hidden="true"><Eye size={22} weight="regular"/></i><span>Profile visits</span><strong>{analyticsMetrics.profileVisits}</strong><small>{analyticsMetrics.profileVisitors} visitors</small></div></div></section>}
      {adminView === 'reports' && <section className="admin-region-report" aria-labelledby="region-sales-title"><header><div><h2 id="region-sales-title">Paid sales by delivery region</h2><p>Verified GCash orders, all time</p></div><strong>{metrics.paid} paid {metrics.paid === 1 ? 'order' : 'orders'}</strong></header><div className="admin-region-table"><table><thead><tr><th>Region</th><th className="numeric">Paid orders</th><th className="numeric">Cards</th><th className="numeric">Revenue</th><th className="numeric">Share</th></tr></thead><tbody>{metrics.regions.map((region) => <tr key={region.region}><th scope="row">{region.region}</th><td className="numeric" data-label="Paid orders">{region.orders}</td><td className="numeric" data-label="Cards">{region.cards}</td><td className="numeric" data-label="Revenue">{money(region.revenue)}</td><td className="numeric" data-label="Share">{region.revenueShare}%</td></tr>)}</tbody><tfoot><tr><th scope="row">Total</th><td className="numeric" data-label="Paid orders">{metrics.paid}</td><td className="numeric" data-label="Cards">{metrics.cards}</td><td className="numeric" data-label="Revenue">{money(metrics.revenue)}</td><td className="numeric" data-label="Share">{metrics.paid ? '100%' : '0%'}</td></tr></tfoot></table></div></section>}
      {adminView === 'overview' && <><section className="admin-overview-brief" aria-label="Current sales summary"><div className="admin-overview-primary"><span>Paid today</span><strong>{money(todaySales.revenue)}</strong><p>{todaySales.orders} verified {todaySales.orders === 1 ? 'order' : 'orders'}</p><i aria-hidden="true"><Wallet size={30}/></i></div><dl><div><dt>Month to date</dt><dd>{money(monthSales.revenue)}<small>{monthSales.orders} paid</small></dd><i aria-hidden="true"><CalendarBlank size={21}/></i></div><div><dt>Paid orders</dt><dd>{metrics.paid}<small>All time</small></dd><i aria-hidden="true"><ShoppingBag size={21}/></i></div><div><dt>Cards sold</dt><dd>{metrics.cards}<small>Verified only</small></dd><i aria-hidden="true"><CreditCard size={21}/></i></div><div><dt>Needs review</dt><dd>{metrics.payment}<small>Payment proofs</small></dd><i aria-hidden="true"><ShieldCheck size={21}/></i></div></dl></section><section className="admin-overview-grid" aria-label="Operations overview"><article><header><div><i aria-hidden="true"><Kanban size={20}/></i><span>01</span><h2>Work queue</h2></div><button type="button" onClick={() => showOrders()}>Open orders</button></header>{workQueue.length ? workQueue.map((order) => <button type="button" className="overview-order overview-work-order" onClick={() => openOverviewOrder(order)} key={order.id}><span><b>{order.customer_name}</b><small>{order.order_number}</small></span><span><b>{order.payment_status === 'proof_submitted' ? 'Review payment' : order.order_status === 'pending_fulfillment' ? 'Prepare order' : 'Processing'}</b><small>{date(order.created_at)}</small></span></button>) : <div className="admin-overview-empty"><i aria-hidden="true"><CheckCircle size={28}/></i><span>Clear</span><b>No action needed</b><p>Payment reviews and preparation tasks will appear here.</p></div>}</article><article><header><div><i aria-hidden="true"><ListBullets size={20}/></i><span>02</span><h2>Latest orders</h2></div><button type="button" onClick={() => showOrders()}>View all</button></header>{orders.length ? orders.slice(0,6).map((order) => <button type="button" className="overview-order" onClick={() => openOverviewOrder(order)} key={order.id}><span><b>{order.order_number}</b><small>{order.customer_name}</small></span><span><b>{money(order.total)}</b><small>{humanize(order.payment_status)}</small></span></button>) : <div className="admin-overview-empty"><i aria-hidden="true"><ListBullets size={28}/></i><span>Empty</span><b>No orders yet</b><p>Customer orders will appear here.</p></div>}</article></section></>}
      {adminView === 'messages' && <section className="admin-mailbox" aria-label="Customer messages"><aside className="mailbox-folders"><h2>Mailbox</h2><button type="button" className={messageFolder === 'all' ? 'active' : ''} onClick={() => setMessageFolder('all')}><Inbox size={19}/><span>Conversations</span><small>{messageThreads.length}</small></button><button type="button" className={messageFolder === 'sent' ? 'active' : ''} onClick={() => setMessageFolder('sent')}><PaperPlaneTilt size={19}/><span>Sent</span><small>{messageThreads.filter((thread) => thread.messages?.some((message) => message.direction === 'outbound')).length}</small></button><div><b>Order support</b><p>Every conversation remains attached to its customer order.</p></div></aside><section className="mailbox-list"><header><div><h2>{messageFolder === 'sent' ? 'Sent messages' : 'Conversations'}</h2><p>{visibleThreads.length} {visibleThreads.length === 1 ? 'thread' : 'threads'}</p></div><button type="button" onClick={() => startMessage()}><Plus size={17}/>New message</button></header><label><MagnifyingGlass size={17}/><input value={messageQuery} onChange={(event) => setMessageQuery(event.target.value)} placeholder="Search customer or order"/></label><div className="mailbox-thread-list">{visibleThreads.length ? visibleThreads.map((thread) => { const lastMessage = thread.messages?.at(-1); return <button type="button" className={selectedThread?.id === thread.id ? 'active' : ''} onClick={() => setSelectedThreadId(thread.id)} key={thread.id}><i>{thread.customer_name?.charAt(0).toUpperCase()}</i><span><b>{thread.customer_name}</b><strong>{lastMessage?.subject || thread.subject}</strong><small>{lastMessage?.body_text || 'No messages yet'}</small></span><time>{lastMessage ? new Intl.DateTimeFormat('en-PH', { month:'short', day:'numeric' }).format(new Date(lastMessage.created_at)) : ''}</time></button> }) : <div className="mailbox-empty"><ChatCircleText size={26}/><b>No conversations yet</b><p>Send a message from the dashboard to start one.</p></div>}</div></section><article className="mailbox-reader">{selectedThread ? <><header><div><i>{selectedThread.customer_name?.charAt(0).toUpperCase()}</i><span><b>{selectedThread.customer_name}</b><small>{selectedThread.customer_email}</small></span></div><button type="button" onClick={() => { const order = orders.find((item) => item.id === selectedThread.order_id); setMessageDraft({ orderId:selectedThread.order_id, subject:`Re: ${selectedThread.subject}`, body:'' }); if (order || selectedThread.order_id) setComposingMessage(true) }}><ArrowLeft size={16}/>Reply</button></header><div className="mailbox-thread-head"><span>{selectedThread.orders?.order_number}</span><h2>{selectedThread.subject}</h2></div><div className="mailbox-messages">{selectedThread.messages?.map((message) => <section className={message.direction} key={message.id}><header><b>{message.direction === 'outbound' ? 'Tappy support' : selectedThread.customer_name}</b><time>{date(message.created_at)}</time></header><p>{message.body_text}</p><small data-status={message.delivery_status}>{message.delivery_status}</small></section>)}</div></> : <div className="mailbox-reader-empty"><EnvelopeSimple size={30}/><h2>Select a conversation</h2><p>Customer email history will appear here.</p></div>}{composingMessage && <form className="mailbox-compose" onSubmit={sendCustomerMessage}><header><b>New customer message</b><button type="button" onClick={() => setComposingMessage(false)} aria-label="Close composer"><X size={18}/></button></header><label>Customer order<select required value={messageDraft.orderId} onChange={(event) => { const order = orders.find((item) => item.id === event.target.value); setMessageDraft((current) => ({ ...current, orderId:event.target.value, subject:current.subject || (order ? `Regarding your Tappy order ${order.order_number}` : '') })) }}><option value="">Choose an order</option>{orders.map((order) => <option value={order.id} key={order.id}>{order.order_number} · {order.customer_name}</option>)}</select></label><label>Subject<input required maxLength="180" value={messageDraft.subject} onChange={(event) => setMessageDraft({ ...messageDraft, subject:event.target.value })}/></label><label>Message<textarea required maxLength="10000" value={messageDraft.body} onChange={(event) => setMessageDraft({ ...messageDraft, body:event.target.value })} placeholder="Write a clear message to the customer..."/></label><footer><span>{messageDraft.body.length.toLocaleString()} / 10,000</span><button className="button" type="submit" disabled={messageSending}><PaperPlaneTilt size={17}/>{messageSending ? 'Sending...' : 'Send message'}</button></footer></form>}</article></section>}
      {adminView === 'pages' && <section className="admin-pages-workspace">
        <form className="admin-page-editor" onSubmit={savePage}><header className="admin-page-commandbar"><div><label>Managed page<select value={selectedPageId} onChange={(event) => { const page = pages.find((item) => item.id === event.target.value); if (page) editPage(page); else newPage() }}><option value="">Untitled page</option>{pages.map((page) => <option value={page.id} key={page.id}>{page.display_name}</option>)}</select></label><em data-page-status={pageForm.status}>{pageForm.status}</em></div><div>{selectedPage && <a href={`/p/${selectedPage.public_id}`} target="_blank" rel="noreferrer" title="Open public page"><Eye size={17}/>Preview</a>}<button type="submit" className="button" disabled={pageSaving}>{pageSaving ? 'Saving...' : selectedPage ? 'Save page' : 'Create page'}</button></div></header>{selectedPage && <><div className="admin-profile-url"><span>Customer profile URL</span><code>{`${window.location.origin}/p/${selectedPage.public_id}`}</code><button type="button" onClick={() => copyPageLink(selectedPage)}><Copy size={16}/>Copy</button></div><div className="admin-customer-access"><div><b>Customer editing</b><span>Creates a private 90-day link and emails the paid customer.</span></div><button type="button" onClick={() => grantCustomerAccess(selectedPage)}>Send access</button><button type="button" onClick={() => revokeCustomerAccess(selectedPage)}>Revoke</button></div></>}<div className="admin-page-editor-grid"><div className="admin-page-form-panel"><nav className="admin-page-tabs" aria-label="Page editor sections">{[['profile','Profile',UserCircle],['links','Links',LinkSimple],['design','Design',Palette],['settings','Settings',GearSix]].map(([value,label,Icon]) => <button type="button" className={pageEditorTab === value ? 'active' : ''} onClick={() => setPageEditorTab(value)} key={value}><Icon size={17}/>{label}</button>)}</nav><div className="admin-page-fields">
          <label>Linked paid order<select value={pageForm.orderId} onChange={(event) => setPageForm({ ...pageForm, orderId:event.target.value })}><option value="">No linked order</option>{paidOrders.filter((order) => !pages.some((page) => page.order_id === order.id) || selectedPage?.order_id === order.id).map((order) => <option value={order.id} key={order.id}>{order.order_number} · {order.customer_name}</option>)}</select></label>
          {pageEditorTab === 'profile' && <><div className="admin-page-section-intro"><h2>Profile information</h2><p>Add the basic information people will see on the page.</p></div><div><label>Display name<input value={pageForm.displayName} maxLength="100" required placeholder="e.g. Juan Dela Cruz" onChange={(event) => setPageForm({ ...pageForm, displayName:event.target.value })}/></label><label>Role or headline<input value={pageForm.headline} maxLength="120" placeholder="e.g. Designer & Developer" onChange={(event) => setPageForm({ ...pageForm, headline:event.target.value })}/></label></div><label>Short introduction<textarea value={pageForm.bio} maxLength="360" placeholder="Write a short introduction about yourself..." onChange={(event) => setPageForm({ ...pageForm, bio:event.target.value })}/></label><div className="admin-profile-upload"><ProfileImageUpload value={pageForm.photoUrl} disabled={!selectedPage} onUpload={uploadPagePhoto} onRemove={removePagePhoto}/></div><div><label>Email<input type="email" value={pageForm.email} placeholder="you@example.com" onChange={(event) => setPageForm({ ...pageForm, email:event.target.value })}/></label><label>Phone<input value={pageForm.phone} placeholder="+63 9XX XXX XXXX" onChange={(event) => setPageForm({ ...pageForm, phone:event.target.value })}/></label></div><label>Location<input value={pageForm.location} placeholder="e.g. Manila, Philippines" onChange={(event) => setPageForm({ ...pageForm, location:event.target.value })}/></label></>}
          {pageEditorTab === 'design' && <><div className="admin-page-section-intro"><h2>Page design</h2><p>Keep the page professional while matching the customer’s identity.</p></div><div><label>Button color<span className="profile-color-control"><input type="color" value={/^#[0-9a-f]{6}$/i.test(pageForm.accentColor) ? pageForm.accentColor : '#244a3a'} aria-label="Choose button color" onChange={(event) => setPageForm({ ...pageForm, accentColor:event.target.value })}/><input value={pageForm.accentColor} maxLength="7" pattern="#[0-9A-Fa-f]{6}" aria-label="Button color hexadecimal value" onChange={(event) => { if (/^#[0-9a-f]{0,6}$/i.test(event.target.value)) setPageForm({ ...pageForm, accentColor:event.target.value }) }}/></span></label><label>Background design<select value={pageForm.backgroundTexture} onChange={(event) => setPageForm({ ...pageForm, backgroundTexture:event.target.value })}><optgroup label="Tappy essentials"><option value="clean">Minimal canvas</option><option value="linen">Soft halo</option><option value="silver">Fine pinstripe</option><option value="forest-grain">Tappy dot grid</option><option value="blueprint">Technical grid</option></optgroup><optgroup label="Experimental"><option value="minimal-gradient">Minimal gradient</option><option value="geometric-flow">Geometric flow</option><option value="soft-waves">Soft waves</option><option value="tech-circuit">Tech circuit</option><option value="dark-texture">Dark texture</option></optgroup></select></label></div><fieldset className="customer-template-picker"><legend>Page layout</legend><div className="customer-template-options">{[['classic','Classic','Centered profile'],['split','Split','Photo-led intro'],['compact','Compact','Links first']].map(([value,label,description]) => <label key={value} className={pageForm.template === value ? 'selected' : ''}><input type="radio" name="admin-template" value={value} checked={pageForm.template === value} onChange={(event) => setPageForm({ ...pageForm, template:event.target.value })}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset></>}
          {pageEditorTab === 'settings' && <><div className="admin-page-section-intro"><h2>Page settings</h2><p>Connect the paid order, control publishing, and keep private operational notes.</p></div><label>Linked paid order<select value={pageForm.orderId} onChange={(event) => setPageForm({ ...pageForm, orderId:event.target.value })}><option value="">No linked order</option>{paidOrders.filter((order) => !pages.some((page) => page.order_id === order.id) || selectedPage?.order_id === order.id).map((order) => <option value={order.id} key={order.id}>{order.order_number} · {order.customer_name}</option>)}</select></label><label>Publishing status<select value={pageForm.status} onChange={(event) => setPageForm({ ...pageForm, status:event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="disabled">Disabled</option></select></label><label>Internal notes<textarea value={pageForm.internalNotes} maxLength="1000" onChange={(event) => setPageForm({ ...pageForm, internalNotes:event.target.value })}/></label></>}
          {pageEditorTab === 'links' && <><div className="admin-page-section-intro"><h2>Public links</h2><p>Choose the destinations customers can open from this page.</p></div><fieldset className="admin-links-fieldset">{pageForm.links.map((link, index) => <div key={index}><label>Destination<select value={link.type} onChange={(event) => updatePageLink(index, 'type', event.target.value)}>{pageLinkTypes.map(([type,label]) => <option value={type} key={type}>{label}</option>)}</select></label><label>URL<input type="url" placeholder="https://" value={link.url} onChange={(event) => updatePageLink(index, 'url', event.target.value)}/></label></div>)}</fieldset></>}
        </div></div><div className="admin-page-preview"><span>Live preview</span><ManagedProfileCard page={pageForm} preview/></div></div></form>
      </section>}
      {adminView === 'nfc' && <section className="admin-nfc-workspace"><form className="admin-nfc-create" onSubmit={createNfcTag}><div><h2>Create NFC link</h2><p>The generated Tappy URL stays on the card while its destination can change later.</p></div><label>Destination<select value={nfcDraft.destinationType} onChange={(event) => setNfcDraft({ ...nfcDraft, destinationType:event.target.value })}>{[['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['maps','Google Maps'],['whatsapp','WhatsApp'],['website','Website']].map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Customer URL<input type="url" required placeholder="https://" value={nfcDraft.destinationUrl} onChange={(event) => setNfcDraft({ ...nfcDraft, destinationUrl:event.target.value })}/></label><button className="button" type="submit" disabled={nfcSaving}><Plus size={17}/>{nfcSaving ? 'Creating...' : 'Create permanent link'}</button></form><div className="admin-nfc-list"><header><div><h2>Generated links</h2><p>{nfcTags.length} {nfcTags.length === 1 ? 'link' : 'links'}</p></div></header>{nfcTags.length ? nfcTags.map((tag) => <article key={tag.id} data-active={tag.active}><div><span>{tag.destination_type}</span><strong>{`${window.location.origin}/t/${tag.code}`}</strong><small>{tag.destination_url}</small></div><dl><div><dt>Taps</dt><dd>{tag.tap_count || 0}</dd></div><div><dt>Status</dt><dd>{tag.active ? 'Active' : 'Disabled'}</dd></div></dl><div><button type="button" onClick={() => copyNfcLink(tag)}><Copy size={16}/>Copy</button><button type="button" onClick={() => toggleNfcTag(tag)}>{tag.active ? 'Disable' : 'Enable'}</button><button className="danger" type="button" onClick={() => deleteNfcTag(tag)}>Delete</button></div></article>) : <p className="admin-index-empty">No NFC links yet. Create the first permanent customer link above.</p>}</div></section>}
      {adminView === 'feedback' && <section className="admin-index admin-orders-index" aria-label="Customer feedback"><div className="admin-index-head"><div><strong>Customer feedback</strong><span>{feedback.length} {feedback.length === 1 ? 'submission' : 'submissions'}</span></div></div>{feedback.length ? <div className="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Submitted</th><th>Ratings</th><th>Comment</th><th>Status</th><th className="admin-row-action">Publish</th></tr></thead><tbody>{feedback.map((entry) => <tr key={entry.id}><td data-label="Customer"><b>{entry.orders?.customer_name || 'Unknown'}</b><small>{entry.display_name} · {entry.orders?.order_number || ''}</small></td><td data-label="Submitted">{date(entry.created_at)}</td><td data-label="Ratings"><b>{entry.rating}/5</b><small>Product {entry.product_rating}/5 · Service {entry.service_rating}/5</small></td><td data-label="Comment">{entry.comment ? <span>{entry.comment}</span> : <em>No comment</em>}</td><td data-label="Status"><em data-payment={entry.status}>{humanize(entry.status)}</em></td><td className="admin-row-action">{entry.status === 'published' ? <button type="button" aria-label="Hide feedback" onClick={() => setFeedbackStatus(entry, 'hidden')}><Eye size={17}/></button> : <button type="button" aria-label="Publish feedback" onClick={() => setFeedbackStatus(entry, 'published')}><CheckCircle size={17}/></button>}</td></tr>)}</tbody></table></div> : <p className="admin-index-empty">No feedback submitted yet. Customers receive a private feedback link after completing their order.</p>}</section>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {adminView === 'orders' && <div className="admin-order-tabs" role="tablist" aria-label="Order views">{[['all','All',orderCounts.all],['payment_review','Payment review',orderCounts.payment],['to_fulfill','To fulfill',orderCounts.fulfillment],['in_progress','In progress',orderCounts.inProgress],['completed','Completed',orderCounts.completed],['cancelled','Cancelled',orderCounts.cancelled]].map(([value,label,count]) => <button type="button" role="tab" aria-selected={orderTab === value} className={orderTab === value ? 'active' : ''} onClick={() => { setOrderTab(value); setSelectedOrder(null) }} key={value}><span>{label}</span><small>{count}</small></button>)}</div>}
      {adminView === 'orders' && (selected ? <div className="admin-resource-detail"><button className="admin-back" type="button" onClick={() => setSelectedOrder(null)}><ArrowLeft size={16}/>Back to orders</button><section className="admin-detail">
          <div className="admin-detail-head"><div><span>{selected.order_number}</span><h2>{selected.customer_name}</h2></div><strong>{money(selected.total)}</strong></div>
          <div className="admin-status-line"><span><i><CreditCard size={20}/></i>{humanize(selected.order_status)}</span><span data-payment={selected.payment_status}><i><Clock size={20}/></i>{humanize(selected.payment_status)}</span><span><i><EnvelopeSimple size={20}/></i>Order email {humanize(selected.confirmation_email_status || 'not configured')}</span>{selected.payment_reminder_last_attempt_at && <span><i><BellRinging size={20}/></i>Payment reminder {humanize(selected.payment_reminder_email_status)}</span>}{selected.payment_decision_email_type && <span>Decision email {humanize(selected.payment_decision_email_status)}</span>}{selected.delivery_email_status && selected.order_status === 'delivered' && <span>Delivery email {humanize(selected.delivery_email_status)}</span>}</div>
          <dl><div><dt><i><EnvelopeSimple size={20}/></i>Contact</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a><br/><a href={`tel:${selected.phone}`}>{selected.phone}</a><button className="admin-email-customer" type="button" onClick={() => { startMessage(selected); changeView('messages') }}><ChatCircleText size={16}/>Email customer</button></dd></div><div><dt><i><MapPin size={20}/></i>Deliver to</dt><dd>{selected.address}<br/>{selected.city}{selected.province ? `, ${selected.province}` : ''} {selected.postal_code}{selected.delivery_region && <><br/>{selected.delivery_region} delivery</>}</dd></div><div><dt><i><Package size={20}/></i>Order</dt><dd>{selected.quantity} x White Tappy card<br/>GCash QR payment</dd></div></dl>
          <div className="admin-customer-access"><div><b>Customer feedback</b><span>Emails a private, one-time feedback link to the paid customer.</span></div><button type="button" disabled={selected.payment_status !== 'paid' || feedbackLinkSent[selected.id]} onClick={() => sendFeedbackLink(selected)}>{feedbackLinkSent[selected.id] ? 'Link sent' : 'Send feedback link'}</button></div>
          {selected.payment_proof_path ? <div className="admin-proof"><div><span>Payment proof</span>{proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer"><img src={proofUrl} alt={`GCash receipt for ${selected.order_number}`}/></a> : <div className="proof-loading">{proofError || 'Loading receipt...'}</div>}</div><dl><div><dt>Reference</dt><dd>{selected.payment_reference}</dd></div><div><dt>Sender</dt><dd>{selected.payment_sender_name}<br/>{selected.payment_sender_phone}</dd></div><div><dt>Submitted</dt><dd>{selected.payment_proof_submitted_at ? date(selected.payment_proof_submitted_at) : '-'}</dd></div></dl><div className="proof-actions"><button type="button" className="button" onClick={() => setPendingDecision('paid')} disabled={loading || selected.payment_status === 'paid'}>{selected.payment_status === 'paid' ? 'Payment confirmed' : 'Confirm payment'}</button><button type="button" onClick={() => setPendingDecision('rejected')} disabled={loading || selected.payment_status === 'rejected'}>{selected.payment_status === 'rejected' ? 'Proof rejected' : 'Reject proof'}</button></div></div> : <div className="admin-proof-empty"><i><Info size={22}/></i><div><b>Awaiting payment proof</b><p>The customer has not submitted a GCash receipt yet.</p></div></div>}
          <form className="admin-update" onSubmit={updateOrder}><label>Order status<select name="orderStatus" defaultValue={selected.order_status} key={`order-${selected.id}-${selected.order_status}`}><option value={selected.order_status}>{statusLabel(selected.order_status)} · Current</option>{allowedOrderTransitions(selected.order_status).filter((value) => value !== 'pending_fulfillment' || selected.payment_status === 'paid').map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label><label className="admin-notes-field">Internal notes<textarea name="adminNotes" defaultValue={selected.admin_notes || ''} key={`notes-${selected.id}-${selected.admin_notes}`}/></label><button className="button" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save order details'}</button></form>
        </section></div> : <><div className="admin-order-tools"><label><MagnifyingGlass size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by order ID, customer, or email..." aria-label="Search orders in current view"/></label><button type="button" onClick={() => loadOrders()} disabled={loading}><ArrowsClockwise size={17}/>{loading ? 'Refreshing' : 'Refresh'}</button></div><section className="admin-index admin-orders-index" aria-label="Orders index"><div className="admin-index-head"><div><strong>{[['all','All orders'],['payment_review','Payment review'],['to_fulfill','To fulfill'],['in_progress','In progress'],['completed','Completed'],['cancelled','Cancelled']].find(([value]) => value === orderTab)?.[1]}</strong><span>{orderMeta.total} {orderMeta.total === 1 ? 'record' : 'records'}</span></div></div>{loading && !orders.length ? <p className="admin-index-empty">Loading orders...</p> : orders.length ? <>
          <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Fulfillment</th><th className="numeric">Total</th><th className="admin-row-action">Open</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className={!order.admin_read_at ? 'unread' : ''}><td data-label="Order"><button type="button" onClick={() => openOrder(order)}>{order.order_number}</button>{!order.admin_read_at && <i>New</i>}</td><td data-label="Date">{date(order.created_at)}</td><td data-label="Customer"><b>{order.customer_name}</b><small>{order.email}</small></td><td data-label="Payment"><em data-payment={order.payment_status}>{humanize(order.payment_status)}</em></td><td data-label="Fulfillment"><em data-status={order.order_status}>{humanize(order.order_status)}</em></td><td data-label="Total" className="numeric"><b>{money(order.total)}</b></td><td className="admin-row-action"><button type="button" onClick={() => openOrder(order)} aria-label={`Open ${order.order_number}`}><Eye size={17}/></button></td></tr>)}</tbody></table></div>
          {totalPages > 1 && <nav className="admin-pagination" aria-label="Order pages">
            <button type="button" onClick={() => setOrderPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page">Previous</button>
            <span aria-current={safePage > 1 ? 'page' : undefined}>Page {safePage} of {totalPages}</span>
            <button type="button" onClick={() => setOrderPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page">Next</button>
          </nav>}
        </> : <p className="admin-index-empty">No matching orders.</p>}</section></>)}
    </div>
    {notification && <div className="admin-toast" data-type={notification.type} role={notification.type === 'error' ? 'alert' : 'status'} aria-live="polite"><span>{notification.message}</span><button type="button" onClick={() => setNotification(null)} aria-label="Dismiss notification">Close</button></div>}
    {pendingDecision && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDecision('') }}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-title"><span>{selected.order_number}</span><h2 id="decision-title">{pendingDecision === 'paid' ? 'Confirm this payment?' : 'Reject this proof?'}</h2><p>{pendingDecision === 'paid' ? 'The order will move to fulfillment and the customer will receive a confirmation email.' : 'The order will stay in payment verification and the customer will receive an attention-required email.'}</p><div><button type="button" onClick={() => setPendingDecision('')}>Cancel</button><button type="button" className={pendingDecision === 'paid' ? 'button' : 'danger-button'} onClick={confirmPaymentDecision} autoFocus>{pendingDecision === 'paid' ? 'Confirm payment' : 'Reject proof'}</button></div></section></div>}
  </main>
}

