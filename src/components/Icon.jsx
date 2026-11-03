export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></>,
    report: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 16v-3m4 3V8m4 8v-5"/></>,
    price: <><path d="m3 11 8-8h9v9l-8 8a2 2 0 0 1-3 0l-6-6a2 2 0 0 1 0-3Z"/><circle cx="16" cy="7" r="1"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.report}</svg>;
}
