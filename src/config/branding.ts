/**
 * Branding Configuration
 * ----------------------
 * Change your app's logo, name, colors, and metadata here.
 * All components reference this single file — update once, reflected everywhere.
 */

export const branding = {
  // --- App Identity ---
  appName: 'Insight AI',
  appTagline: 'AI Research Assistant',
  appDescription:
    'Upload documents, images, or videos and ask natural-language questions. The AI agent will figure out the best way to help you.',

  // --- Logo ---
  // Change the SVG path below to swap the logo everywhere at once.
  // You can paste any 24×24 viewBox SVG <path> data here.
  // Or set logoUrl to an external image URL and logoSvgPath to '' to use an image instead.
  logoSvgPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  logoUrl: '/logo.svg', // Used for <head> favicon / og:image — change to your own file

  // --- Icon (used in sidebar, mobile header, welcome screen) ---
  // 'sparkles' | 'brain' | 'bot' | 'atom' | 'custom'
  // If 'custom', provide customIconSvg (a 24×24 SVG string)
  iconType: 'sparkles' as 'sparkles' | 'brain' | 'bot' | 'atom' | 'custom',
  customIconSvg: '',

  // --- Colors ---
  // Primary gradient (used for logo bg, send button, accents)
  // These are Tailwind class names — change to any gradient you like.
  primaryGradient: 'from-emerald-500 to-teal-600',
  primaryColor: 'emerald',       // 'emerald' | 'blue' | 'violet' | 'rose' | 'amber' | 'sky'
  primaryShadow: 'shadow-emerald-500/25',

  // --- Document context indicator ---
  docAccentColor: 'violet', // 'violet' | 'blue' | 'amber' | 'rose'

  // --- Metadata ---
  metaTitle: 'Insight AI — AI Research Assistant',
  metaDescription: 'Upload documents, images, or videos and ask any question. The AI agent will figure out the best way to help you.',
  metaKeywords: ['Insight', 'AI', 'research assistant', 'chat', 'document analysis'],
  metaAuthor: 'Insight AI Team',
  metaIconUrl: 'https://z-cdn.chatglm.cn/z-ai/static/logo.svg',
} as const;

// Derive Tailwind classes from the color name
export function getPrimaryClasses() {
  const c = branding.primaryColor;
  return {
    bg: `bg-gradient-to-br ${branding.primaryGradient}`,
    bgSolid: `bg-${c}-500`,
    text: `text-${c}-600`,
    textLight: `text-${c}-500`,
    border: `border-${c}-200`,
    borderLight: `border-${c}-300`,
    bgLight: `bg-${c}-50`,
    bgHover: `hover:bg-${c}-50/50`,
    borderHover: `hover:border-${c}-200`,
    shadow: branding.primaryShadow,
    badge: `bg-${c}-100 text-${c}-600`,
  };
}

export function getDocClasses() {
  const c = branding.docAccentColor;
  return {
    text: `text-${c}-600`,
    textLight: `text-${c}-500`,
    bg: `bg-${c}-50`,
    border: `border-${c}-200`,
    badge: `bg-${c}-100 text-${c}-600`,
    bgSolid: `bg-${c}-100`,
  };
}
