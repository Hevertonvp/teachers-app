// Marca do app: três barras ascendentes (evolução/desenvolvimento individual — o PDI é o coração
// do sistema) com um marco no topo da mais alta, representando uma meta alcançada. Substitui o
// antigo badge de texto "GP" em Header.jsx/LoginPage.jsx/PrimeiroAcessoPage.jsx — mesmo símbolo em
// todo o app, só o tamanho muda.
export const Logo = ({ size = 40, className = '', rounded = true }) => {
  const gradientId = 'logo-bars-gradient';
  const bgGradientId = 'logo-bg-gradient';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Gestão Pedagógica"
    >
      <defs>
        <linearGradient id={bgGradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>
        <linearGradient id={gradientId} x1="0" y1="30" x2="0" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx={rounded ? 10 : 0} fill={`url(#${bgGradientId})`} />
      <rect x="8.5" y="22" width="6" height="8" rx="3" fill={`url(#${gradientId})`} />
      <rect x="17" y="16" width="6" height="14" rx="3" fill={`url(#${gradientId})`} />
      <rect x="25.5" y="10" width="6" height="20" rx="3" fill={`url(#${gradientId})`} />
      <circle cx="28.5" cy="6" r="2.6" fill="#99f6e4" />
    </svg>
  );
};
