import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '@/utils/api'
import styles from './Layout.module.css'

const NAV = [
  { to: '/',             label: 'Overview' },
  { to: '/retrieve',     label: 'Retrieve' },
  { to: '/edit',         label: 'Edit' },
  { to: '/authenticate', label: 'Authenticate' },
  { to: '/compose',      label: 'Compose' },
  { to: '/explain',      label: 'Explain' },
  { to: '/history',      label: 'History' },
]

export default function Layout() {
  const loc = useLocation()
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
  })

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <NavLink to="/" className={styles.logo}>
          Persens <span>Material Intelligence</span>
        </NavLink>

        <div className={styles.links}>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className={styles.status}>
          <span
            className={`${styles.dot} ${health ? styles.dotOnline : styles.dotOffline}`}
          />
          <span className={styles.statusText}>
            {health ? `${health.materials} materials` : 'connecting…'}
          </span>
        </div>
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
