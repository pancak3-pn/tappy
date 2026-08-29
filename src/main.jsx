import React from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import '@fontsource-variable/geist'
import '@fontsource-variable/jetbrains-mono'
import 'flag-icons/css/flag-icons.min.css'
import App from './App.jsx'
import './styles.css'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn:import.meta.env.VITE_SENTRY_DSN,
    environment:import.meta.env.MODE,
    sendDefaultPii:false,
    tracesSampleRate:import.meta.env.PROD ? 0.05 : 0,
    beforeSend(event) {
      if (event.request?.url) event.request.url = event.request.url.replace(/\/edit\/[A-Za-z0-9_-]+/g, '/edit/[redacted]')
      event.breadcrumbs?.forEach((breadcrumb) => {
        if (breadcrumb.data?.url) breadcrumb.data.url = breadcrumb.data.url.replace(/\/edit\/[A-Za-z0-9_-]+/g, '/edit/[redacted]')
      })
      if (event.user) delete event.user
      return event
    },
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><Sentry.ErrorBoundary fallback={<main className="app-error"><b>tappy.</b><h1>Something went wrong.</h1><p>The issue has been reported. Refresh the page or try again shortly.</p><button type="button" onClick={() => window.location.reload()}>Refresh</button></main>}><App /></Sentry.ErrorBoundary></React.StrictMode>,
)
