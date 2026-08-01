import { branding } from '@/config/branding';

const iconPaths: Record<string, string> = {
  sparkles:
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
  brain: 'M12 2a6 6 0 0 0-4.24 1.76A5.98 5.98 0 0 0 2 9.5 6 6 0 0 0 5 15.24 4.5 4.5 0 0 0 7.5 22a4.5 4.5 0 0 0 4.5-4.5 4.5 4.5 0 0 0 4.5 4.5A4.5 4.5 0 0 0 19 15.24 6 6 0 0 0 22 9.5a5.98 5.98 0 0 0-5.76-5.74A6 6 0 0 0 12 2z',
  bot: 'M12 8V4H8v4H4v4h4v4h4v-4h4V8h-4zm-2 8H8v-2h2v2zm0-4H8V8h2v4zm4 0h-2V8h2v4z',
  atom:
    'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4.93 4.93a10 10 0 0 1 14.14 0M1.76 12a10 10 0 0 1 .68-3.68M1.76 12a10 10 0 0 0 .68 3.68M4.93 19.07a10 10 0 0 0 14.14 0M22.24 12a10 10 0 0 1-.68 3.68M22.24 12a10 10 0 0 0-.68-3.68',
  custom: '',
};

interface AppIconProps {
  size?: number;
  className?: string;
}

/**
 * Centralized app icon component.
 * Change the icon type in src/config/branding.ts → iconType.
 * Or set iconType to 'custom' and provide customIconSvg.
 */
export function AppIcon({ size = 16, className = '' }: AppIconProps) {
  const { iconType, customIconSvg, logoSvgPath } = branding;
  const d = iconType === 'custom' ? customIconSvg : (iconPaths[iconType] || iconPaths.sparkles);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d ? <path d={d} /> : <path d={logoSvgPath} />}
    </svg>
  );
}

/**
 * App logo component (the layered icon, used in the Z.ai original logo.svg style).
 * Renders the three-layer stack icon from branding.logoSvgPath.
 */
export function AppLogo({ size = 24, className = '' }: AppIconProps) {
  const { logoSvgPath } = branding;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={logoSvgPath} />
    </svg>
  );
}
