const iconClass = 'h-4 w-4 fill-none stroke-current stroke-[1.8]'

export function InboxIcon() {
  return <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
    <path d="M4 13h4l2 2h4l2-2h4" />
  </svg>
}

export function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
    <path d="M12 21a9 9 0 1 0-7.4-3.9L3 21l4-1.5A9 9 0 0 0 12 21Z" />
    <path d="M9 8.5c.5 2.8 2 4.3 4.8 5.2l1.2-1.1 2 .9c-.3 1.6-1.3 2.5-2.9 2.5-3.5 0-6.1-2.6-6.1-6.1 0-1.5.8-2.4 2.2-2.8L11 9l-1.1 1.1" />
  </svg>
}

export function CompaniesIcon() {
  return <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
    <path d="M4 20V7l8-3v16M12 9h8v11M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2M2 20h20" />
  </svg>
}

export function PrivacyIcon() {
  return <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
    <path d="M12 3.5 18 6v5.5c0 3.5-2.2 6.8-6 8.5-3.8-1.7-6-5-6-8.5V6l6-2.5Z" />
    <path d="M9.5 12.5 11 14l3.5-4" />
  </svg>
}

export function LogoutIcon() {
  return <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
    <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10M14 8l4 4-4 4M8 12h10" />
  </svg>
}
