/** The app mark — same red frame and bars as the home-screen icon. */
export default function Logo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="AIYOHMETHOD">
      <rect x="1.2" y="1.2" width="21.6" height="21.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <rect x="5" y="6.4" width="12" height="3" fill="currentColor" />
      <rect x="5" y="11" width="8.5" height="3" fill="currentColor" />
      <rect x="5" y="15.6" width="13.5" height="3" fill="currentColor" />
    </svg>
  )
}
